import type { Actor, Task } from "../actor";
import { LlamarLaApi } from "../habilidades";

export interface ModuloSemilla {
  titulo: string;
  lecciones: string[];
}

export interface CursoSemilla {
  titulo: string;
  modulos: ModuloSemilla[];
  /** Publicado directo (default: borrador; publicar por UI usa PublicarCursoAbierto). */
  publicado?: boolean;
  /** Bloqueo secuencial (default true: módulo N exige completar el N-1). */
  secuencial?: boolean;
}

/**
 * DADO pesado por API: crea un curso completo (módulos + lecciones) sin UI.
 * Lo BAJO PRUEBA sigue yendo por UI; esto solo planta el escenario rápido
 * (cada POST por UI con la BD lenta cuesta 10-30 s de renders y esperas).
 */
export class PrepararCurso implements Task {
  descripcion: string;
  private constructor(private semilla: CursoSemilla) {
    const n = semilla.modulos.reduce((a, m) => a + m.lecciones.length, 0);
    this.descripcion = `preparar curso "${semilla.titulo}" (${semilla.modulos.length} módulos, ${n} lecciones)`;
  }
  static con(semilla: CursoSemilla): PrepararCurso {
    return new PrepararCurso(semilla);
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { request } = actor.usa(LlamarLaApi);
    const rc = await request.post("/api/courses", {
      data: {
        title: this.semilla.titulo,
        status: this.semilla.publicado ? "PUBLISHED" : "DRAFT",
        sequential: this.semilla.secuencial ?? true,
      },
    });
    if (!rc.ok()) throw new Error(`POST /api/courses → ${rc.status()}`);
    const { course } = await rc.json();
    for (const m of this.semilla.modulos) {
      const rm = await request.post("/api/modules", {
        data: { courseId: course.id, title: m.titulo },
      });
      if (!rm.ok()) throw new Error(`POST /api/modules → ${rm.status()}`);
      const { module } = await rm.json();
      for (const l of m.lecciones) {
        const rl = await request.post(`/api/modules/${module.id}/lessons`, {
          data: { title: l },
        });
        if (!rl.ok()) throw new Error(`POST lessons → ${rl.status()}: ${await rl.text()}`);
      }
    }
  }
}
