import { vi, describe, it, expect } from "vitest"
import { useState } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type { LessonBlock } from "@/lib/courses/blocks"

vi.mock("./text-editor", () => ({
  EditorTextoRico: ({ value, onChange, ariaLabel }: { value: string; onChange: (v: string) => void; ariaLabel?: string }) => (
    <textarea
      aria-label={ariaLabel ?? "Texto"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}))

vi.mock("@/components/media/audio-picker", () => ({
  AudioPicker: ({ onSubida, etiqueta }: { onSubida: (u: string) => void; etiqueta?: string }) => (
    <button type="button" onClick={() => onSubida("https://r2/audio.opus")}>
      Subir {etiqueta ?? "audio"}
    </button>
  ),
}))

import { FormQuiz, FormListening } from "./block-forms-interactive"

const quizBlock: Extract<LessonBlock, { type: "quiz" }> = {
  id: "q1",
  type: "quiz",
  passScore: 70,
  questions: [
    {
      prompt: "¿Agua?",
      options: [
        { text: "yu", correct: true },
        { text: "kwe", correct: false },
      ],
    },
  ],
}

const listeningBlock: Extract<LessonBlock, { type: "listening" }> = {
  id: "l1",
  type: "listening",
  media: { source: "upload", url: "https://r2/audio.opus" },
  question: "¿Qué escuchaste?",
  options: [
    { text: "yu", correct: true },
    { text: "kwe", correct: false },
  ],
}

describe("FormQuiz", () => {
  it("renderiza el slider con passScore actual", () => {
    const onChange = vi.fn()
    render(<FormQuiz block={quizBlock} onChange={onChange} errores={[]} />)
    const slider = screen.getByLabelText("Porcentaje de aprobación") as HTMLInputElement
    expect(slider.value).toBe("70")
    expect(screen.getByText("70%")).toBeDefined()
  })

  it("el slider actualiza passScore", async () => {
    const { fireEvent } = await import("@testing-library/react")
    const onChange = vi.fn()
    render(<FormQuiz block={quizBlock} onChange={onChange} errores={[]} />)
    const slider = screen.getByLabelText("Porcentaje de aprobación")
    fireEvent.change(slider, { target: { value: "85" } })
    expect(onChange).toHaveBeenCalled()
    const ultimo = onChange.mock.calls[onChange.mock.calls.length - 1]![0] as any
    expect(ultimo.passScore).toBe(85)
  })

  it("la pregunta es editable via EditorTextoRico", async () => {
    function Wrapper() {
      const [b, setB] = useState<Extract<LessonBlock, { type: "quiz" }>>(quizBlock)
      return <FormQuiz block={b} onChange={setB as any} errores={[]} />
    }
    const user = userEvent.setup()
    render(<Wrapper />)
    const input = screen.getByLabelText("Pregunta 1") as HTMLTextAreaElement
    await user.clear(input)
    await user.type(input, "Nueva pregunta")
    expect(input.value).toBe("Nueva pregunta")
  })

  it("chips de opciones renderizan con la correcta marcada", () => {
    const onChange = vi.fn()
    render(<FormQuiz block={quizBlock} onChange={onChange} errores={[]} />)
    const chips = screen.getAllByLabelText("Texto de la opción")
    expect(chips).toHaveLength(2)
    expect(screen.getByRole("button", { name: "Correcta" })).toBeDefined()
    expect(screen.getByRole("button", { name: "Marcar" })).toBeDefined()
  })

  it("marcar otra opción como correcta deja solo una correcta", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<FormQuiz block={quizBlock} onChange={onChange} errores={[]} />)
    const marcar = screen.getByRole("button", { name: "Marcar" })
    await user.click(marcar)
    const ultimo = onChange.mock.calls[onChange.mock.calls.length - 1]![0] as any
    const correctas = ultimo.questions[0].options.filter((o: any) => o.correct).length
    expect(correctas).toBe(1)
    expect(ultimo.questions[0].options[1].correct).toBe(true)
    expect(ultimo.questions[0].options[0].correct).toBe(false)
  })

  it("agregar opción añade una vacía (≤6)", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<FormQuiz block={quizBlock} onChange={onChange} errores={[]} />)
    await user.click(screen.getByRole("button", { name: /Opción/ }))
    const ultimo = onChange.mock.calls[onChange.mock.calls.length - 1]![0] as any
    expect(ultimo.questions[0].options).toHaveLength(3)
    expect(ultimo.questions[0].options[2]).toEqual({ text: "", correct: false })
  })

  it("quitar opción la elimina", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<FormQuiz block={quizBlock} onChange={onChange} errores={[]} />)
    const quitar = screen.getAllByRole("button", { name: "Quitar opción" })[1]!
    await user.click(quitar)
    const ultimo = onChange.mock.calls[onChange.mock.calls.length - 1]![0] as any
    expect(ultimo.questions[0].options).toHaveLength(1)
  })

  it("agregar pregunta añade con 2 opciones default", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<FormQuiz block={quizBlock} onChange={onChange} errores={[]} />)
    await user.click(screen.getByRole("button", { name: /Pregunta/ }))
    const ultimo = onChange.mock.calls[onChange.mock.calls.length - 1]![0] as any
    expect(ultimo.questions).toHaveLength(2)
    expect(ultimo.questions[1].options).toHaveLength(2)
  })

  it("quitar pregunta deshabilitado si queda 1", () => {
    const onChange = vi.fn()
    render(<FormQuiz block={quizBlock} onChange={onChange} errores={[]} />)
    const btn = screen.getByRole("button", { name: /Quitar pregunta 1/ })
    expect(btn).toBeDisabled()
  })

  it("explicación colapsada: escribir actualiza explanation", async () => {
    function Wrapper() {
      const [b, setB] = useState<Extract<LessonBlock, { type: "quiz" }>>(quizBlock)
      return <FormQuiz block={b} onChange={setB as any} errores={[]} />
    }
    const user = userEvent.setup()
    render(<Wrapper />)
    const details = screen.getByText("Explicación (opcional)").closest("details") as HTMLDetailsElement
    details.open = true
    const textarea = await screen.findByLabelText("Explicación de la pregunta 1") as HTMLTextAreaElement
    await user.type(textarea, "Porque sí")
    expect(textarea.value).toContain("Porque sí")
  })

  it("aviso de validación cuando no hay exactamente una correcta", () => {
    const bad: typeof quizBlock = {
      ...quizBlock,
      questions: [{ prompt: "p", options: [{ text: "a", correct: false }, { text: "b", correct: false }] }],
    }
    render(<FormQuiz block={bad} onChange={vi.fn()} errores={[]} />)
    expect(screen.getByText(/marcá exactamente una correcta/)).toBeDefined()
  })
})

describe("FormListening", () => {
  it("sin url muestra el AudioPicker", () => {
    const block = { ...listeningBlock, media: { source: "upload" as const } }
    render(<FormListening block={block as any} onChange={vi.fn()} errores={[]} />)
    expect(screen.getByRole("button", { name: /Subir Audio del ejercicio/i })).toBeDefined()
  })

  it("con url muestra preview y botón Reemplazar", () => {
    const onChange = vi.fn()
    render(<FormListening block={listeningBlock} onChange={onChange} errores={[]} />)
    const audio = document.querySelector("audio") as HTMLAudioElement
    expect(audio.src).toContain("audio.opus")
    const btn = screen.getByRole("button", { name: "Reemplazar" })
    // clicking Reemplazar limpia la url
    // (no click aquí para no disparar; solo verificar presencia)
    expect(btn).toBeDefined()
  })

  it("Reemplazar limpia media.url", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<FormListening block={listeningBlock} onChange={onChange} errores={[]} />)
    await user.click(screen.getByRole("button", { name: "Reemplazar" }))
    const ultimo = onChange.mock.calls[onChange.mock.calls.length - 1]![0] as any
    expect(ultimo.media.url).toBeUndefined()
  })

  it("la pregunta es editable via EditorTextoRico", async () => {
    function Wrapper() {
      const [b, setB] = useState<Extract<LessonBlock, { type: "listening" }>>(listeningBlock)
      return <FormListening block={b} onChange={setB as any} errores={[]} />
    }
    const user = userEvent.setup()
    render(<Wrapper />)
    const input = screen.getByLabelText(/Pregunta del bloque/) as HTMLTextAreaElement
    await user.clear(input)
    await user.type(input, "Nueva")
    expect(input.value).toBe("Nueva")
  })

  it("agregar opción añade una vacía", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<FormListening block={listeningBlock} onChange={onChange} errores={[]} />)
    await user.click(screen.getByRole("button", { name: /Opción/ }))
    const ultimo = onChange.mock.calls[onChange.mock.calls.length - 1]![0] as any
    expect(ultimo.options).toHaveLength(3)
    expect(ultimo.options[2]).toEqual({ text: "", correct: false })
  })

  it("aviso de validación cuando no hay exactamente una correcta", () => {
    const bad = { ...listeningBlock, options: [{ text: "a", correct: false }, { text: "b", correct: false }] }
    render(<FormListening block={bad as any} onChange={vi.fn()} errores={[]} />)
    expect(screen.getByText(/marcá exactamente una correcta/)).toBeDefined()
  })
})
