import type { LessonBlock } from "@/lib/courses/blocks"
import { newBlockId } from "@/lib/courses/blocks"

export type PlantillaLeccion = {
  id: string
  nombre: string
  descripcion: string
  bloques: LessonBlock[]
}

/**
 * Plantillas de lección para arrancar sin pantalla vacía.
 * Cada bloque pasa el contrato de parseLessonContent (validación compartida
 * con el servidor): solo se incluyen bloques válidos sin datos del diccionario
 * (audio, vocabulario y palabra se agregan con el picker).
 */
export const PLANTILLAS_LECCION: PlantillaLeccion[] = [
  {
    id: "texto",
    nombre: "Texto simple",
    descripcion: "Un bloque de texto para empezar a escribir.",
    bloques: [
      { id: newBlockId(), type: "text", html: "<p>Escribí aquí el contenido de la lección…</p>" },
    ],
  },
  {
    id: "quiz",
    nombre: "Quiz",
    descripcion: "Un quiz con una pregunta de ejemplo.",
    bloques: [
      {
        id: newBlockId(),
        type: "quiz",
        passScore: 70,
        questions: [
          {
            prompt: "¿Cuál es la respuesta correcta?",
            options: [{ text: "Opción correcta", correct: true }, { text: "Opción incorrecta", correct: false }],
          },
        ],
      },
    ],
  },
  {
    id: "vacia",
    nombre: "Vacía",
    descripcion: "Empezar desde cero.",
    bloques: [],
  },
]

export function plantillaPorId(id: string): PlantillaLeccion | undefined {
  return PLANTILLAS_LECCION.find((p) => p.id === id)
}

