import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { EditWordAudio } from "./EditWordAudio"
import type { useWordAudio } from "./use-word-audio"

type Audio = ReturnType<typeof useWordAudio>

function fakeAudio(overrides: Partial<Audio>): Audio {
  return {
    audioUrl: null,
    audioFile: null,
    audioPreview: null,
    isUploadingAudio: false,
    audioError: null,
    isDragOver: false,
    audioChanged: false,
    originalAudioUrl: null,
    fileInputRef: { current: null },
    resetAudio: vi.fn(),
    handleAudioSelect: vi.fn(),
    handleDrop: vi.fn(),
    handleDragOver: vi.fn(),
    handleDragLeave: vi.fn(),
    handleFileInputChange: vi.fn(),
    removeAudio: vi.fn(),
    clearAudio: vi.fn(),
    ...overrides,
  } as unknown as Audio
}

describe("EditWordAudio — estados explicitos", () => {
  beforeEach(() => vi.clearAllMocks())

  it("sin audio: dropzone de subida, sin Quitar ni Descartar", () => {
    render(<EditWordAudio audio={fakeAudio({})} />)
    expect(screen.getByText(/subir audio/i)).toBeTruthy()
    expect(screen.queryByRole("button", { name: /^quitar$/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /descartar/i })).toBeNull()
  })

  it("con audio original sin cambio: Quitar llama clearAudio", () => {
    const clearAudio = vi.fn()
    render(
      <EditWordAudio
        audio={fakeAudio({ audioUrl: "https://cdn.test/a.ogg", originalAudioUrl: "https://cdn.test/a.ogg", clearAudio })}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: /^quitar$/i }))
    expect(clearAudio).toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: /descartar/i })).toBeNull()
  })

  it("con cambio: Descartar llama removeAudio", () => {
    const removeAudio = vi.fn()
    render(
      <EditWordAudio
        audio={fakeAudio({
          audioUrl: "https://cdn.test/nuevo.ogg",
          originalAudioUrl: "https://cdn.test/viejo.ogg",
          audioChanged: true,
          removeAudio,
        })}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: /descartar/i }))
    expect(removeAudio).toHaveBeenCalled()
  })
})
