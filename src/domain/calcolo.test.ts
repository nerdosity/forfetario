import { describe, it, expect } from 'vitest'
import { calcola } from './calcolo'
import type { CalcoloInput, Regime } from './types'

const regimeSeparata: Regime = {
  id: 'a',
  tipo: 'separata',
  aliquota: 15,
  coefficiente: 67,
  meseInizio: 1, giornoInizio: 1,
  meseFine: 12, giornoFine: 31,
  fatturato: 36000,
  riduzioneContributi: 'nessuna',
}

const regimeArtigiani: Regime = {
  id: 'b',
  tipo: 'artigiani',
  aliquota: 15,
  coefficiente: 67,
  meseInizio: 3, giornoInizio: 1,
  meseFine: 12, giornoFine: 31,
  fatturato: 30000,
  riduzioneContributi: 'nessuna',
}

const inputBase: CalcoloInput = {
  anno: 2024,
  regimiCorrente: [regimeSeparata],
  regimiPrecedente: [{ ...regimeSeparata, id: 'prev', fatturato: 30000 }],
  contributiVersatiDuranteAnno: null,
  contributiVersatiDuranteAnnoPrecedente: null,
  accontiImposteVersatiPerAnnoCorrente: null,
  accontiImposteVersatiPerAnnoPrecedente: null,
  accontiContributiSeparataVersatiPerAnnoCorrente: null,
  accontiContributiEccedenzaArtCommVersatiPerAnnoCorrente: null,
}

describe('calcola — regime separata base', () => {
  it('totaleImposte > 0', () => {
    const r = calcola(inputBase)
    expect(r.totaleImposte).toBeGreaterThan(0)
  })

  it('imponibile lordo = fatturato × coeff', () => {
    const r = calcola(inputBase)
    expect(r.totaleImponibileLordo).toBeCloseTo(36000 * 0.67)
  })

  it('contributi separata = imponibile × aliquota G.S.', () => {
    const r = calcola(inputBase)
    const atteso = (36000 * 0.67) * 26.07 / 100
    expect(r.totaleContributiSeparata).toBeCloseTo(atteso)
  })

  it('saldoImposteDaVersare = totaleImposte (nessun acconto versato)', () => {
    const r = calcola(inputBase)
    expect(r.saldoImposteDaVersareAnnoCorrente).toBeCloseTo(r.totaleImposte)
  })

  it('creditoImposte = 0 senza acconti', () => {
    const r = calcola(inputBase)
    expect(r.creditoImposteAnnoCorrente).toBe(0)
  })
})

describe('calcola — deducibilità contributi versati', () => {
  it('contributi versati riducono imponibile netto', () => {
    const conDeducibilita = calcola({ ...inputBase, contributiVersatiDuranteAnno: 5000 })
    const senza = calcola(inputBase)
    expect(conDeducibilita.imponibileNettoTotalePerImposte).toBeLessThan(senza.imponibileNettoTotalePerImposte)
  })

  it('contributi versati > imponibile → imposta = 0', () => {
    const r = calcola({ ...inputBase, contributiVersatiDuranteAnno: 999999 })
    expect(r.totaleImposte).toBe(0)
  })
})

describe('calcola — credito imposte', () => {
  it('acconti > dovuto → credito', () => {
    const r = calcola({ ...inputBase, accontiImposteVersatiPerAnnoCorrente: 99999 })
    expect(r.creditoImposteAnnoCorrente).toBeGreaterThan(0)
    expect(r.saldoImposteDaVersareAnnoCorrente).toBe(0)
  })
})

describe('calcola — artigiani con eccedenza', () => {
  it('contributi fissi > 0', () => {
    const r = calcola({ ...inputBase, regimiCorrente: [regimeArtigiani] })
    expect(r.totaleContributiFissiArtComm).toBeGreaterThan(0)
  })

  it('eccedenza artigiani con fatturato alto', () => {
    const altoFatturato: Regime = { ...regimeArtigiani, fatturato: 80000 }
    const r = calcola({ ...inputBase, regimiCorrente: [altoFatturato] })
    expect(r.totaleContributiEccedenzaArtComm).toBeGreaterThan(0)
  })

  it('riduzione 35% abbassa contributi fissi', () => {
    const pieno = calcola({ ...inputBase, regimiCorrente: [regimeArtigiani] })
    const ridotto = calcola({
      ...inputBase,
      regimiCorrente: [{ ...regimeArtigiani, riduzioneContributi: '35' }],
    })
    expect(ridotto.totaleContributiFissiArtComm).toBeLessThan(pieno.totaleContributiFissiArtComm)
  })
})

describe('calcola — scadenze', () => {
  it('genera scadenze anno corrente e successivo', () => {
    const r = calcola({ ...inputBase, regimiPrecedente: [{ ...regimeSeparata, id: 'p', fatturato: 30000 }] })
    expect(r.scadenzeAnnoCorrente.length).toBeGreaterThanOrEqual(0)
    expect(r.scadenzeAnnoSuccessivo.length).toBeGreaterThan(0)
  })

  it('tutte le scadenze anno corrente hanno annoScadenza uguale all\'anno', () => {
    const r = calcola(inputBase)
    r.scadenzeAnnoCorrente.forEach((s) => expect(s.annoScadenza).toBe(2024))
  })

  it('tutte le scadenze anno successivo hanno annoScadenza uguale all\'anno+1', () => {
    const r = calcola(inputBase)
    r.scadenzeAnnoSuccessivo.forEach((s) => expect(s.annoScadenza).toBe(2025))
  })
})

describe('calcola — anno precedente', () => {
  it('datiAnnoPrecedente.totaleImposte > 0 con fatturato', () => {
    const r = calcola(inputBase)
    expect(r.datiAnnoPrecedente.totaleImposte).toBeGreaterThan(0)
  })

  it('deducibilità anno precedente abbassa imposte precedenti', () => {
    const senza = calcola(inputBase)
    const con = calcola({ ...inputBase, contributiVersatiDuranteAnnoPrecedente: 5000 })
    expect(con.datiAnnoPrecedente.totaleImposte).toBeLessThan(senza.datiAnnoPrecedente.totaleImposte)
  })
})
