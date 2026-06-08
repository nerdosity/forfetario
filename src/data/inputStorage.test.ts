import { describe, it, expect, beforeEach, vi } from 'vitest'
import { caricaInput, salvaInput, pulisciInput } from './inputStorage'
import { regimeVuoto } from '@/domain/regimeFactory'
import { anniDisponibili } from '@/data/taxData'
import type { CalcoloInput } from '@/domain/types'

// localStorage non esiste in ambiente node: lo mockiamo con una Map.
beforeEach(() => {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  })
})

function inputDiEsempio(): CalcoloInput {
  return {
    anno: anniDisponibili()[0],
    regimiCorrente: [
      { ...regimeVuoto(), tipo: 'artigiani', aliquota: 5, coefficiente: 78, fatturato: 42000, riduzioneContributi: '35' },
    ],
    regimiPrecedente: [{ ...regimeVuoto(), fatturato: 30000 }],
    contributiVersatiDuranteAnno: 1234.56,
    contributiVersatiDuranteAnnoPrecedente: 1000,
    accontiImposteVersatiPerAnnoCorrente: 200,
    accontiImposteVersatiPerAnnoPrecedente: 150,
    accontiContributiSeparataVersatiPerAnnoCorrente: 80,
    accontiContributiEccedenzaArtCommVersatiPerAnnoCorrente: 90,
  }
}

describe('inputStorage', () => {
  it('round-trip: salva e ricarica tutti i campi scalari', () => {
    const input = inputDiEsempio()
    salvaInput(input)
    const caricato = caricaInput(inputDiEsempio())!

    // ogni chiave di CalcoloInput, eccetto i regimi (verificati a parte)
    for (const k of Object.keys(input) as (keyof CalcoloInput)[]) {
      if (k === 'regimiCorrente' || k === 'regimiPrecedente') continue
      expect(caricato[k]).toEqual(input[k])
    }
  })

  it('round-trip: preserva tutti i campi dei regimi (tranne id, rigenerato)', () => {
    const input = inputDiEsempio()
    salvaInput(input)
    const caricato = caricaInput(inputDiEsempio())!

    const orig = input.regimiCorrente[0]
    const ric = caricato.regimiCorrente[0]
    const { id: _id, ...origSenzaId } = orig
    const { id: _id2, ...ricSenzaId } = ric
    expect(ricSenzaId).toEqual(origSenzaId)
  })

  it('ritorna null quando non c\'è nulla salvato', () => {
    expect(caricaInput(inputDiEsempio())).toBeNull()
  })

  it('scarta un anno non più disponibile e usa quello di default', () => {
    salvaInput({ ...inputDiEsempio(), anno: 1999 })
    const base = inputDiEsempio()
    const caricato = caricaInput(base)!
    expect(caricato.anno).toBe(base.anno)
  })

  it('normalizza dati corrotti senza lanciare', () => {
    localStorage.setItem('forfettario_input', '{"regimiCorrente": "non-un-array", "anno": "abc"}')
    const base = inputDiEsempio()
    const caricato = caricaInput(base)!
    expect(caricato.anno).toBe(base.anno)
    expect(caricato.regimiCorrente).toHaveLength(1)
    expect(caricato.contributiVersatiDuranteAnno).toBeNull()
  })

  it('pulisciInput rimuove i dati salvati', () => {
    salvaInput(inputDiEsempio())
    pulisciInput()
    expect(caricaInput(inputDiEsempio())).toBeNull()
  })
})
