import { describe, it, expect } from 'vitest'
import { isBisestile, giorniInAnno, giorniInMese, giorniPermanenza, validaPeriodo } from './dates'

describe('isBisestile', () => {
  it('2024 è bisestile', () => expect(isBisestile(2024)).toBe(true))
  it('2025 non è bisestile', () => expect(isBisestile(2025)).toBe(false))
  it('2000 è bisestile (divisibile per 400)', () => expect(isBisestile(2000)).toBe(true))
  it('1900 non è bisestile (divisibile per 100 ma non 400)', () => expect(isBisestile(1900)).toBe(false))
})

describe('giorniInAnno', () => {
  it('2024: 366', () => expect(giorniInAnno(2024)).toBe(366))
  it('2025: 365', () => expect(giorniInAnno(2025)).toBe(365))
})

describe('giorniInMese', () => {
  it('febbraio 2024: 29', () => expect(giorniInMese(2, 2024)).toBe(29))
  it('febbraio 2025: 28', () => expect(giorniInMese(2, 2025)).toBe(28))
  it('gennaio: 31', () => expect(giorniInMese(1, 2024)).toBe(31))
  it('aprile: 30', () => expect(giorniInMese(4, 2024)).toBe(30))
})

describe('giorniPermanenza', () => {
  it('anno intero 2024', () => expect(giorniPermanenza(1, 1, 12, 31, 2024)).toBe(366))
  it('anno intero 2025', () => expect(giorniPermanenza(1, 1, 12, 31, 2025)).toBe(365))
  it('stesso mese', () => expect(giorniPermanenza(3, 1, 3, 31, 2025)).toBe(31))
  it('gen-mar 2025', () => expect(giorniPermanenza(1, 1, 3, 31, 2025)).toBe(31 + 28 + 31))
  it('gen 1 - mar 15 2025', () => expect(giorniPermanenza(1, 1, 3, 15, 2025)).toBe(31 + 28 + 15))
})

describe('validaPeriodo', () => {
  it('periodo valido (anno intero) → null', () =>
    expect(validaPeriodo(1, 1, 12, 31, 2025)).toBeNull())

  it('29 febbraio valido in anno bisestile', () =>
    expect(validaPeriodo(2, 29, 12, 31, 2024)).toBeNull())

  it('29 febbraio NON valido in anno non bisestile', () =>
    expect(validaPeriodo(2, 29, 12, 31, 2025)).toMatch(/non valido/))

  it('31 aprile non valido (aprile ha 30 giorni)', () =>
    expect(validaPeriodo(4, 31, 12, 31, 2025)).toMatch(/non valido/))

  it('giorno di inizio > 31 non valido', () =>
    expect(validaPeriodo(1, 59, 12, 31, 2025)).toMatch(/inizio non valido/))

  it('giorno di fine > giorni del mese non valido', () =>
    expect(validaPeriodo(1, 1, 12, 44, 2025)).toMatch(/fine non valido/))

  it('giorno < 1 non valido', () =>
    expect(validaPeriodo(1, 0, 12, 31, 2025)).toMatch(/inizio non valido/))

  it('fine prima di inizio (mesi invertiti) → errore di ordine', () =>
    expect(validaPeriodo(6, 1, 3, 1, 2025)).toMatch(/precede/))

  it('fine prima di inizio nello stesso mese → errore di ordine', () =>
    expect(validaPeriodo(3, 20, 3, 10, 2025)).toMatch(/precede/))
})
