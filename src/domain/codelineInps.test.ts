import { describe, it, expect } from 'vitest'
import { generaCodeline, codelineAffidabile } from './codelineInps'

/**
 * Casi reali dallo strumento ufficiale INPS (Cassetto Artigiani e Commercianti),
 * causale AF, soggetto 10, anno 2025, rata 0. L'algoritmo a coppie è esatto
 * quando ≤1 coppia della matricola differisce dal riferimento 10130045.
 */
const CASI_AFFIDABILI: [string, string][] = [
  ['10130045', '10130045251100565'], // riferimento
  ['00130045', '00130045251100269'], // coppia0 diversa
  ['90130045', '90130045251100006'],
  ['10930045', '10930045251100191'], // coppia1 diversa
  ['10100045', '10100045251100504'], // coppia2 diversa
  ['10130945', '10130945251100656'], // coppia3 diversa
  ['10130049', '10130049251100720'],
  ['50130045', '50130045251100776'],
  ['10130005', '10130005251100948'],
]

describe('generaCodeline — casi affidabili (≤1 coppia diversa)', () => {
  for (const [matricola, atteso] of CASI_AFFIDABILI) {
    it(`${matricola} → ${atteso}`, () => {
      expect(generaCodeline({ matricola, anno: 2025, codiceSoggetto: '10', rata: 0 })).toBe(atteso)
    })
    it(`${matricola} è segnalata affidabile`, () => {
      expect(codelineAffidabile({ matricola, anno: 2025, codiceSoggetto: '10', rata: 0 })).toBe(true)
    })
  }
})

describe('generaCodeline — dominio', () => {
  it('matricola non valida → null', () => {
    expect(generaCodeline({ matricola: '123', anno: 2025, codiceSoggetto: '10', rata: 0 })).toBeNull()
  })
  it('soggetto diverso da titolare → null', () => {
    expect(generaCodeline({ matricola: '10130045', anno: 2025, codiceSoggetto: '11', rata: 0 })).toBeNull()
  })
  it('matricola con più coppie diverse: NON affidabile (carry non modellato)', () => {
    expect(codelineAffidabile({ matricola: '99999999', anno: 2025, codiceSoggetto: '10', rata: 0 })).toBe(false)
  })
})
