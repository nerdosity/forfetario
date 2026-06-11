import { describe, it, expect } from 'vitest'
import { generaCodeline } from './codelineInps'

/**
 * Casi reali raccolti dallo strumento ufficiale INPS "Calcolo Codeline"
 * (Cassetto previdenziale Artigiani e Commercianti), causale AF, soggetto 10.
 * Validano la formula della codeline ricostruita per reverse engineering.
 * Formato: [matricola, anno, rata, codelineAttesa(17 cifre)].
 */
const CASI: [string, number, number, string][] = [
  ['10130045', 2025, 0, '10130045251100565'],
  ['00130045', 2025, 0, '00130045251100269'],
  ['20130045', 2025, 0, '20130045251100861'],
  ['90130045', 2025, 0, '90130045251100006'],
  ['10030045', 2025, 0, '10030045251100364'],
  ['10930045', 2025, 0, '10930045251100191'],
  ['10100045', 2025, 0, '10100045251100504'],
  ['10190045', 2025, 0, '10190045251100682'],
  ['10131045', 2025, 0, '10131045251100660'],
  ['10139045', 2025, 0, '10139045251100488'],
  ['10130945', 2025, 0, '10130945251100656'],
  ['10130005', 2025, 0, '10130005251100948'],
  ['10130095', 2025, 0, '10130095251100590'],
  ['10130049', 2025, 0, '10130049251100720'],
  ['10130045', 2020, 0, '10130045201100316'],
  ['10130045', 2022, 0, '10130045221100419'],
  ['10130045', 2024, 0, '10130045241100511'],
  ['10130045', 2026, 0, '10130045261100614'],
  ['10130045', 2025, 1, '10130045251101570'],
  ['10130045', 2025, 2, '10130045251102584'],
  ['10130045', 2025, 3, '10130045251103599'],
  ['10130045', 2025, 4, '10130045251104609'],
]

describe('generaCodeline — validazione contro INPS', () => {
  for (const [matricola, anno, rata, atteso] of CASI) {
    it(`${matricola} ${anno} rata ${rata} → ${atteso}`, () => {
      expect(generaCodeline({ matricola, anno, codiceSoggetto: '10', rata })).toBe(atteso)
    })
  }

  it('fuori dominio (anno 2027): null', () => {
    expect(generaCodeline({ matricola: '10130045', anno: 2027, codiceSoggetto: '10', rata: 0 })).toBeNull()
  })

  it('fuori dominio (rata 5): null', () => {
    expect(generaCodeline({ matricola: '10130045', anno: 2025, codiceSoggetto: '10', rata: 5 })).toBeNull()
  })

  it('matricola non valida: null', () => {
    expect(generaCodeline({ matricola: '123', anno: 2025, codiceSoggetto: '10', rata: 0 })).toBeNull()
  })
})
