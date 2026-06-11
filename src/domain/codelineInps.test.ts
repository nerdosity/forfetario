import { describe, it, expect } from 'vitest'
import { generaCodeline, codelineAffidabile } from './codelineInps'

/**
 * Casi reali dai modelli F24 precompilati INPS (sede 7009, soggetto 10,
 * matricola 10130045). Algoritmo ufficiale Circolare 123/1998:
 *   - importo dovuto in euro interi nei primi 10 byte (0 per rata 6 = saldo/acconto)
 *   - controcodice modulo 99 a blocchi
 *   - check digit finale IBM base 11
 */
const CASI_F24: { anno: number; rata: number; importoEuro: number; atteso: string }[] = [
  { anno: 2025, rata: 4, importoEuro: 725, atteso: '10130045251104676' }, // 4ª rata 2025
  { anno: 2026, rata: 1, importoEuro: 735, atteso: '10130045261101101' }, // 1ª rata 2026
  { anno: 2026, rata: 2, importoEuro: 735, atteso: '10130045261102116' }, // 2ª rata 2026
  { anno: 2026, rata: 3, importoEuro: 735, atteso: '10130045261103120' }, // 3ª rata 2026
  { anno: 2026, rata: 4, importoEuro: 735, atteso: '10130045261104135' }, // 4ª rata 2026
  { anno: 2025, rata: 6, importoEuro: 0, atteso: '10130045251106615' },   // saldo 2025
  { anno: 2026, rata: 6, importoEuro: 0, atteso: '10130045261106669' },   // 1° acconto 2026
]

describe('generaCodeline — modelli F24 reali (Circolare 123/1998)', () => {
  for (const { anno, rata, importoEuro, atteso } of CASI_F24) {
    it(`anno ${anno} rata ${rata} imp ${importoEuro}€ → ${atteso}`, () => {
      expect(generaCodeline({ matricola: '10130045', anno, codiceSoggetto: '10', rata, importoEuro })).toBe(atteso)
    })
  }
})

/**
 * Codeline dal calcolatore del Cassetto INPS, con il suo importo di default
 * (100 €), soggetto 10, anno 2025, rata 0. Coprono matricole arbitrarie,
 * incluse quelle "impossibili" per il vecchio modello additivo.
 */
const CASI_CALCOLATORE: [string, string][] = [
  ['10130045', '10130045251100565'],
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
    expect(generaCodeline({ matricola: '10130045', anno: 2025, codiceSoggetto: '10', rata: 9 })).toBeNull()
  })
  it('rata 6 forza importo 0 (ignora importoEuro)', () => {
    expect(generaCodeline({ matricola: '10130045', anno: 2025, codiceSoggetto: '10', rata: 6, importoEuro: 9999 }))
      .toBe('10130045251106615')
  })
  it('titolare sede 7009 è affidabile', () => {
    expect(codelineAffidabile({ matricola: '10130045', anno: 2025, codiceSoggetto: '10', rata: 0 })).toBe(true)
  })
})
