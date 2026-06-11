import { describe, it, expect, beforeEach, vi } from 'vitest'
import { caricaInput, salvaInput, pulisciInput } from './inputStorage'
import { regimeVuoto } from '@/domain/regimeFactory'
import { anniDisponibili } from '@/data/taxData'
import type { CalcoloInput, DatiAnno } from '@/domain/types'

// localStorage non esiste in ambiente node: lo mockiamo con una Map.
beforeEach(() => {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  })
})

function datiEsempio(): DatiAnno {
  return {
    regimi: [
      { ...regimeVuoto(), tipo: 'artigiani', aliquota: 5, coefficiente: 78, fatturato: 42000, riduzioneContributi: '35' },
    ],
    modalitaContributi: 'dettaglio',
    contributiVersatiTotale: 1234.56,
    contributiVersati: [
      { id: 'v1', tipo: 'fissi-1', descrizione: '', importo: 1000, deducibile: true },
      { id: 'v2', tipo: 'altro', descrizione: 'Ravvedimento', importo: 234.56, deducibile: true },
    ],
    impostaSaldoVersato: 100,
    impostaAcconto1Versato: 200,
    impostaAcconto2Versato: 180,
  }
}

function inputDiEsempio(): CalcoloInput {
  const anno = anniDisponibili()[0]
  return {
    anno,
    anni: { [anno]: datiEsempio() },
    rateazioniImposta: { 'saldo-2024': { inizio: 'luglio', numeroRate: 4 } },
  }
}

describe('inputStorage', () => {
  it('round-trip: salva e ricarica anno, rateazioni e campi scalari di DatiAnno', () => {
    const input = inputDiEsempio()
    salvaInput(input)
    const caricato = caricaInput(inputDiEsempio())!

    expect(caricato.anno).toBe(input.anno)
    expect(caricato.rateazioniImposta).toEqual(input.rateazioniImposta)
    const d = caricato.anni[input.anno]
    const orig = input.anni[input.anno]
    expect(d.modalitaContributi).toBe(orig.modalitaContributi)
    expect(d.contributiVersatiTotale).toBe(orig.contributiVersatiTotale)
    expect(d.impostaSaldoVersato).toBe(orig.impostaSaldoVersato)
    expect(d.impostaAcconto1Versato).toBe(orig.impostaAcconto1Versato)
    expect(d.impostaAcconto2Versato).toBe(orig.impostaAcconto2Versato)
  })

  it('round-trip: preserva le righe dei contributi versati (tranne id)', () => {
    const input = inputDiEsempio()
    salvaInput(input)
    const caricato = caricaInput(inputDiEsempio())!

    const versati = caricato.anni[input.anno].contributiVersati
    expect(versati).toHaveLength(2)
    expect(versati.map(({ id: _id, ...r }) => r)).toEqual(
      input.anni[input.anno].contributiVersati.map(({ id: _id, ...r }) => r),
    )
  })

  it('round-trip: preserva i campi dei regimi (tranne id, rigenerato)', () => {
    const input = inputDiEsempio()
    salvaInput(input)
    const caricato = caricaInput(inputDiEsempio())!

    const orig = input.anni[input.anno].regimi[0]
    const ric = caricato.anni[input.anno].regimi[0]
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
    localStorage.setItem('forfettario_input', '{"anni": "non-un-oggetto", "anno": "abc"}')
    const base = inputDiEsempio()
    const caricato = caricaInput(base)!
    expect(caricato.anno).toBe(base.anno)
    expect(caricato.anni).toEqual({})
  })

  it('migra il vecchio formato mono-anno nella mappa anni', () => {
    // payload vecchio: campi piatti
    const vecchio = {
      anno: anniDisponibili()[0],
      regimiCorrente: [{ ...regimeVuoto(), tipo: 'artigiani', fatturato: 50000 }],
      regimiPrecedente: [{ ...regimeVuoto(), fatturato: 30000 }],
      contributiVersatiDuranteAnno: 2000,
      modalitaContributiVersati: 'totale',
      contributiVersatiDettaglio: [],
      impostaSaldoVersatoAnnoCorrente: 500,
      accontiImposteVersatiPerAnnoPrecedente: 300,
    }
    localStorage.setItem('forfettario_input', JSON.stringify(vecchio))
    const caricato = caricaInput(inputDiEsempio())!
    const anno = vecchio.anno
    // i dati correnti vanno in anni[anno]
    expect(caricato.anni[anno].regimi[0].fatturato).toBe(50000)
    expect(caricato.anni[anno].contributiVersatiTotale).toBe(2000)
    expect(caricato.anni[anno].impostaSaldoVersato).toBe(500)
    // i dati precedenti in anni[anno-1]
    expect(caricato.anni[anno - 1].regimi[0].fatturato).toBe(30000)
    expect(caricato.anni[anno - 1].impostaAcconto1Versato).toBe(300)
  })

  it('pulisciInput rimuove i dati salvati', () => {
    salvaInput(inputDiEsempio())
    pulisciInput()
    expect(caricaInput(inputDiEsempio())).toBeNull()
  })
})
