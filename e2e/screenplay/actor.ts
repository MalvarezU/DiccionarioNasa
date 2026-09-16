/**
 * Patrón Screenplay para E2E Piiyaak.
 *
 * - Actor: quién actúa (Visitante, Usuario, Administradora...).
 * - Habilidad: qué puede usar (NavegarLaWeb, LlamarLaApi).
 * - Task (tasks/): acción de negocio (CrearCurso, AñadirLeccion...).
 * - Question (questions/): valor observable (CantidadDeLecciones...).
 *
 * Las Questions devuelven valores; la aserción queda en el spec con `expect`.
 * Los locators viven dentro de Tasks/Questions (una sola fuente).
 */

/** Acción de negocio que un Actor ejecuta con sus habilidades. */
export interface Task {
  descripcion: string;
  ejecutar(actor: Actor): Promise<void>;
}

/** Valor observable del sistema que un Actor puede consultar. */
export interface Question<T> {
  descripcion: string;
  responder(actor: Actor): Promise<T>;
}

export class Actor {
  private habilidades = new Map<string, unknown>();

  private constructor(readonly nombre: string) {}

  static llamado(nombre: string): Actor {
    return new Actor(nombre);
  }

  con(habilidad: object): this {
    this.habilidades.set(habilidad.constructor.name, habilidad);
    return this;
  }

  usa<T extends object>(tipo: new (...args: never[]) => T): T {
    const h = this.habilidades.get(tipo.name);
    if (!h) throw new Error(`${this.nombre} no tiene la habilidad ${tipo.name}`);
    return h as T;
  }

  async intenta(...tasks: Task[]): Promise<void> {
    for (const t of tasks) await t.ejecutar(this);
  }

  async pregunta<T>(q: Question<T>): Promise<T> {
    return q.responder(this);
  }
}
