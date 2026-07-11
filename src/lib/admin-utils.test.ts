import { describe, it, expect } from "vitest"
import {
  formatNumber,
  formatDate,
  formatDateShort,
  formatTimeAgo,
  getActionLabel,
  getActionColor,
  getEntityLabel,
  getResponsible,
  WORD_CATEGORIES,
  WORD_STATUSES,
  VALID_AUDIO_TYPES,
  VALID_AUDIO_EXTENSIONS,
  MAX_AUDIO_SIZE,
} from "./admin-utils"

describe("admin-utils", () => {
  describe("formatNumber", () => {
    it("formats a number with es-CO locale", () => {
      const result = formatNumber(1234567)
      expect(result).toMatch(/1\.234\.567|1,234,567/)
    })

    it("formats 0", () => {
      const result = formatNumber(0)
      expect(result).toBe("0")
    })
  })

  describe("formatDate", () => {
    it("formats an ISO date string", () => {
      const result = formatDate("2024-03-15T10:30:00Z")
      expect(result).toContain("2024")
    })
  })

  describe("formatDateShort", () => {
    it("formats an ISO date string without year", () => {
      const result = formatDateShort("2024-03-15T10:30:00Z")
      expect(result).not.toContain("2024")
    })
  })

  describe("formatTimeAgo", () => {
    it("returns 'ahora' for very recent time", () => {
      const result = formatTimeAgo(new Date().toISOString())
      expect(result).toBe("ahora")
    })

    it("returns 'hace X min' for minutes ago", () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString()
      expect(formatTimeAgo(fiveMinAgo)).toBe("hace 5 min")
    })

    it("returns 'hace Xh' for hours ago", () => {
      const threeHrAgo = new Date(Date.now() - 3 * 3600000).toISOString()
      expect(formatTimeAgo(threeHrAgo)).toBe("hace 3h")
    })

    it("returns 'hace Xd' for days ago", () => {
      const threeDayAgo = new Date(Date.now() - 3 * 86400000).toISOString()
      expect(formatTimeAgo(threeDayAgo)).toBe("hace 3d")
    })

    it("falls back to formatDateShort for > 7 days", () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString()
      const result = formatTimeAgo(tenDaysAgo)
      expect(result).not.toContain("hace")
    })
  })

  describe("getActionLabel", () => {
    it("returns Spanish label for known actions", () => {
      expect(getActionLabel("CREATE")).toBe("Creación")
      expect(getActionLabel("UPDATE")).toBe("Edición")
      expect(getActionLabel("DELETE")).toBe("Eliminación")
      expect(getActionLabel("IMPORT")).toBe("Importación")
      expect(getActionLabel("SUGGEST")).toBe("Sugerencia")
    })

    it("returns the raw action for unknown actions", () => {
      expect(getActionLabel("UNKNOWN")).toBe("UNKNOWN")
    })
  })

  describe("getActionColor", () => {
    it("returns color class for known actions", () => {
      expect(getActionColor("CREATE")).toContain("text-secondary")
      expect(getActionColor("DELETE")).toContain("text-destructive")
    })

    it("returns default color for unknown actions", () => {
      expect(getActionColor("UNKNOWN")).toContain("text-muted-foreground")
    })
  })

  describe("getEntityLabel", () => {
    it("returns Spanish label for known entities", () => {
      expect(getEntityLabel("DictionaryWord")).toBe("Palabra")
      expect(getEntityLabel("User")).toBe("Usuario")
      expect(getEntityLabel("Favorite")).toBe("Favorito")
      expect(getEntityLabel("AuditLog")).toBe("Log")
    })

    it("returns the raw entity for unknown entities", () => {
      expect(getEntityLabel("Unknown")).toBe("Unknown")
    })
  })

  describe("getResponsible", () => {
    it("always returns 'admin (MVP)' regardless of userId", () => {
      expect(getResponsible("user-1")).toBe("admin (MVP)")
      expect(getResponsible(null)).toBe("admin (MVP)")
    })
  })

  describe("WORD_CATEGORIES", () => {
    it("contains sustantivo and verbo", () => {
      const values = WORD_CATEGORIES.map((c) => c.value)
      expect(values).toContain("sustantivo")
      expect(values).toContain("verbo")
    })

    it("each category has value and label", () => {
      for (const cat of WORD_CATEGORIES) {
        expect(cat.value).toBeDefined()
        expect(cat.label).toBeDefined()
      }
    })
  })

  describe("WORD_STATUSES", () => {
    it("contains DRAFT, PUBLISHED, and ARCHIVED", () => {
      const values = WORD_STATUSES.map((s) => s.value)
      expect(values).toContain("DRAFT")
      expect(values).toContain("PUBLISHED")
      expect(values).toContain("ARCHIVED")
    })
  })

  describe("audio constants", () => {
    it("VALID_AUDIO_TYPES includes mp3 and wav", () => {
      expect(VALID_AUDIO_TYPES).toContain("audio/mpeg")
      expect(VALID_AUDIO_TYPES).toContain("audio/wav")
    })

    it("VALID_AUDIO_EXTENSIONS includes .mp3 and .wav", () => {
      expect(VALID_AUDIO_EXTENSIONS).toContain(".mp3")
      expect(VALID_AUDIO_EXTENSIONS).toContain(".wav")
    })

    it("MAX_AUDIO_SIZE is 10 MB", () => {
      expect(MAX_AUDIO_SIZE).toBe(10 * 1024 * 1024)
    })
  })
})