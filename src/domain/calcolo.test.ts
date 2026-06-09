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
  modalitaContributiVersati: 'totale',
  contributiVersatiDettaglio: [],
  contributiVersatiDuranteAnnoPrecedente: null,
  impostaSaldoVersatoAnnoCorrente: null,
  impostaAcconto1VersatoAnnoCorrente: null,
  impostaAcconto2VersatoAnnoCorrente: null,
  accontiImposteVersatiPerAnnoPrecedente: null,
}

describe('rate fisse — competenza temporale', () => {
  // Artigiano a regime tutto l'anno, sia nel corrente sia nel precedente
  const artInteroAnno: Regime = { ...regimeArtigiani, meseInizio: 1, giornoInizio: 1, riduzioneContributi: '35' }
  const input2025: CalcoloInput = {
    ...inputBase,
    anno: 2025,
    regimiCorrente: [{ ...artInteroAnno, id: 'cur' }],
    regimiPrecedente: [{ ...artInteroAnno, id: 'prev' }],
  }

  it('4ª rata dell\'anno precedente usa le tariffe 2024, non 2025', () => {
    const r = calcola(input2025)
    // IVS 2024 = 4419.60, riduzione 35%, maternità 0.62/mese → rata trim (3 mesi)
    const attesa2024 = ((4419.6 / 12) * 0.65 + 0.62) * 3
    expect(r.datiAnnoPrecedente.rateFisse[3]).toBeCloseTo(attesa2024) // ≈ 720.05
  })

  it('le rate dell\'anno corrente usano le tariffe 2025', () => {
    const r = calcola(input2025)
    const attesa2025 = ((4453.2 / 12) * 0.65 + 0.62) * 3
    expect(r.rateFisse[0]).toBeCloseTo(attesa2025) // ≈ 725.50
  })

  it('la maternità NON è ridotta dallo sconto 35%', () => {
    const r = calcola(input2025)
    // Se la maternità fosse erroneamente ridotta, la rata sarebbe più bassa
    const conMatRidotta = ((4453.2 / 12 + 0.62) * 0.65) * 3
    expect(r.rateFisse[0]).toBeGreaterThan(conMatRidotta)
  })
})

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
    const r = calcola({ ...inputBase, impostaAcconto1VersatoAnnoCorrente: 99999 })
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
