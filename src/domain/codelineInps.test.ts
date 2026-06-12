import { describe, it, expect } from 'vitest'
import { generaCodeline, codelineAffidabile } from './codelineInps'

/**
 * Casi su matricola fittizia 99999999 (sede 7009, soggetto 10), con codeline
 * attese generate dall'algoritmo ufficiale Circolare 123/1998:
 *   - importo dovuto in euro interi nei primi 10 byte (0 per rata 6 = saldo/acconto)
 *   - controcodice modulo 99 a blocchi
 *   - check digit finale IBM base 11
 * Verificano la stabilità dell'algoritmo (regressione), non dipendono da dati reali.
 */
const CASI_F24: { anno: number; rata: number; importoEuro: number; atteso: string }[] = [
  { anno: 2025, rata: 4, importoEuro: 725, atteso: '99999999251104330' }, // 4ª rata 2025
  { anno: 2026, rata: 1, importoEuro: 735, atteso: '99999999261101755' }, // 1ª rata 2026
  { anno: 2026, rata: 2, importoEuro: 735, atteso: '99999999261102760' }, // 2ª rata 2026
  { anno: 2026, rata: 3, importoEuro: 735, atteso: '99999999261103774' }, // 3ª rata 2026
  { anno: 2026, rata: 4, importoEuro: 735, atteso: '99999999261104789' }, // 4ª rata 2026
  { anno: 2025, rata: 6, importoEuro: 0, atteso: '99999999251106274' },   // saldo 2025
  { anno: 2026, rata: 6, importoEuro: 0, atteso: '99999999261106323' },   // 1° acconto 2026
]

describe('generaCodeline — modelli F24 (Circolare 123/1998)', () => {
  for (const { anno, rata, importoEuro, atteso } of CASI_F24) {
    it(`anno ${anno} rata ${rata} imp ${importoEuro}€ → ${atteso}`, () => {
      expect(generaCodeline({ matricola: '99999999', anno, codiceSoggetto: '10', rata, importoEuro })).toBe(atteso)
    })
  }
})

/**
 * Codeline dal calcolatore del Cassetto INPS, con il suo importo di default
 * (100 €), soggetto 10, anno 2025, rata 0. Coprono matricole arbitrarie,
 * incluse quelle "impossibili" per il vecchio modello additivo.
 */
const CASI_CALCOLATORE: [string, string][] = [
  ['99999999', '99999999251100220'],
  ['88888888', '88888888251100104'],
  ['12345678', '12345678251100963'],
  ['00130045', '00130045251100269'],
  ['90130045', '90130045251100006'],
  ['64646464', '64646464251100679'],
  ['50505050', '50505050251100245'],
]

describe('generaCodeline — calcolatore Cassetto (importo 100 €)', () => {
  for (const [matricola, atteso] of CASI_CALCOLATORE) {
    it(`${matricola} → ${atteso}`, () => {
      expect(generaCodeline({ matricola, anno: 2025, codiceSoggetto: '10', rata: 0, importoEuro: 100 })).toBe(atteso)
    })
  }
})

describe('generaCodeline — dominio', () => {
  it('matricola non valida → null', () => {
    expect(generaCodeline({ matricola: '123', anno: 2025, codiceSoggetto: '10', rata: 0 })).toBeNull()
  })
  it('rata fuori range → null', () => {
    expect(generaCodeline({ matricola: '99999999', anno: 2025, codiceSoggetto: '10', rata: 9 })).toBeNull()
  })
  it('rata 6 forza importo 0 (ignora importoEuro)', () => {
    expect(generaCodeline({ matricola: '99999999', anno: 2025, codiceSoggetto: '10', rata: 6, importoEuro: 9999 }))
      .toBe('99999999251106274')
  })
  it('titolare sede 7009 è affidabile', () => {
    expect(codelineAffidabile({ matricola: '99999999', anno: 2025, codiceSoggetto: '10', rata: 0 })).toBe(true)
  })
})
