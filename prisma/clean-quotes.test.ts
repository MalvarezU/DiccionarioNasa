import { describe, it, expect } from 'vitest'
import { unescapeCsvField, isCsvCorrupted } from './clean-quotes'

describe('unescapeCsvField', () => {
  it('limpia caso asimétrico del seed ("""Nido" → Nido)', () => {
    expect(unescapeCsvField('"""Nido"')).toBe('Nido')
  })

  it('limpia caso simétrico del usuario ("""perro"",""gato" → perro","gato)', () => {
    expect(unescapeCsvField('"""perro"",""gato"')).toBe('perro","gato')
  })

  it('limpia JSON de examples del seed (""…""" → JSON válido)', () => {
    const dirty = '[{""spanish"":"""",""nasaYuwe"":""Extremidad""}]'
    const clean = unescapeCsvField(dirty)!
    expect(clean).toBe('[{"spanish":"","nasaYuwe":"Extremidad"}]')
    expect(() => JSON.parse(clean)).not.toThrow()
    expect(JSON.parse(clean)).toEqual([{ spanish: '', nasaYuwe: 'Extremidad' }])
  })

  it('preserva strings limpios sin cambios', () => {
    expect(unescapeCsvField('Nido')).toBe('Nido')
    expect(unescapeCsvField('Luna')).toBe('Luna')
    expect(unescapeCsvField('')).toBe('')
    expect(unescapeCsvField(null)).toBe(null)
    expect(unescapeCsvField(undefined)).toBe(undefined)
  })

  it('preserva strings con comillas intencionales que no siguen el patrón', () => {
    expect(unescapeCsvField('"Nido"')).toBe('"Nido"')
    expect(unescapeCsvField('algo "con" comillas')).toBe('algo "con" comillas')
  })

  it('es idempotente', () => {
    const dirty = '"""Pie"'
    const once = unescapeCsvField(dirty)
    const twice = unescapeCsvField(once)
    expect(once).toBe('Pie')
    expect(twice).toBe('Pie')
  })

  it('maneja el caso degenerado """""" (5 comillas → ", agresivo para ""Nido"")', () => {
    expect(unescapeCsvField('"""""')).toBe('"')
  })
})

describe('isCsvCorrupted', () => {
  it('detecta los 3 patrones del seed', () => {
    expect(isCsvCorrupted('"""Nido"')).toBe(true)
    expect(isCsvCorrupted('"""perro"",""gato"')).toBe(true)
    expect(isCsvCorrupted('[{""spanish"":"""",""nasaYuwe"":""Extremidad""}]')).toBe(true)
  })

  it('no marca strings limpios como corruptos', () => {
    expect(isCsvCorrupted('Nido')).toBe(false)
    expect(isCsvCorrupted('Luna')).toBe(false)
    expect(isCsvCorrupted('')).toBe(false)
    expect(isCsvCorrupted(null)).toBe(false)
  })
})
