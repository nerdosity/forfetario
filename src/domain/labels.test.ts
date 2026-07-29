import { describe, it, expect } from 'vitest'
import { formatEuro, formatPercent, labelTipo } from './labels'

/**
 * Il separatore delle migliaia di it-IT è il punto; lo spazio prima del simbolo
 * di valuta è uno spazio insecabile stretto (U+202F), non uno spazio normale:
 * i confronti si fanno normalizzando, non con uguaglianze fragili.
 */
const soloCifre = (testo: string) => testo.replace(/[^\d.,]/g, '')

describe('formatEuro', () => {
  it('formatta con separatore delle migliaia i valori a 4 cifre intere', () => {
    // Regressione: con `useGrouping` implicito la locale it-IT applica
    // minimumGroupingDigits=2 e produce "5398,02 €", senza separatore.
    expect(soloCifre(formatEuro(5_398.02))).toBe('5.398,02')
    expect(formatEuro(5_398.02)).toContain('5.398,02')
  })

  it('gli altri importi a 4 cifre osservati nel diagramma hanno il separatore', () => {
    for (const [valore, atteso] of [
      [4_059.49, '4.059,49'],
      [2_902.02, '2.902,02'],
      [2_496.0, '2.496,00'],
      [1_000, '1.000,00'],
      [9_999.99, '9.999,99'],
    ] as const) {
      expect(soloCifre(formatEuro(valore))).toBe(atteso)
    }
  })

  it('formatta coerentemente valori a 4 e a 5 cifre nello stesso insieme', () => {
    // Il difetto era proprio la disomogeneità: alcuni importi con separatore,
    // altri senza, nella stessa etichetta.
    const tutti = [5_398.02, 34_554.58, 51_574.0, 42_116.49].map(formatEuro)
    for (const testo of tutti) expect(testo).toMatch(/\d\.\d{3}/)
  })

  it('sotto le mille non inserisce separatori', () => {
    expect(soloCifre(formatEuro(999.5))).toBe('999,50')
    expect(soloCifre(formatEuro(0))).toBe('0,00')
  })

  it('mostra sempre due decimali', () => {
    expect(soloCifre(formatEuro(12))).toBe('12,00')
    expect(soloCifre(formatEuro(1_234.5))).toBe('1.234,50')
  })

  it('usa la virgola come separatore decimale e include il simbolo euro', () => {
    const testo = formatEuro(1_234.56)
    expect(testo).toContain('1.234,56')
    expect(testo).toContain('€')
  })

  it('null e undefined valgono zero', () => {
    expect(soloCifre(formatEuro(null))).toBe('0,00')
    expect(soloCifre(formatEuro(undefined))).toBe('0,00')
  })

  it('formatta i milioni con tutti i separatori', () => {
    expect(soloCifre(formatEuro(1_234_567.89))).toBe('1.234.567,89')
  })
})

describe('formatPercent', () => {
  it('arrotonda a un decimale', () => expect(formatPercent(0.2378)).toBe('23,8%'))
  it('rispetta il numero di decimali richiesto', () =>
    expect(formatPercent(0.2378, 2)).toBe('23,78%'))
  it('i valori non finiti diventano zero', () => expect(formatPercent(NaN)).toBe('0,0%'))
  it('null vale zero', () => expect(formatPercent(null)).toBe('0,0%'))
})

describe('labelTipo', () => {
  it('etichetta le tre gestioni', () => {
    expect(labelTipo('separata')).toBe('Gestione Separata')
    expect(labelTipo('artigiani')).toBe('Artigiani')
    expect(labelTipo('commercianti')).toBe('Commercianti')
  })
})
