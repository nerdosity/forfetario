import { describe, it, expect } from 'vitest'
import { calcola } from './calcolo'
import { anniDisponibili } from '@/data/taxData'
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

/** Costruisce un CalcoloInput per-anno dai parametri di test (anno 2024 di base). */
function mkInput(opt: {
  anno?: number
  regimiCorrente?: Regime[]
  regimiPrecedente?: Regime[]
  contributiVersatiDuranteAnno?: number | null
  contributiVersatiDuranteAnnoPrecedente?: number | null
  impostaAcconto1VersatoAnnoCorrente?: number | null
} = {}): CalcoloInput {
  const anno = opt.anno ?? 2024
  return {
    anno,
    anni: {
      [anno]: {
        regimi: opt.regimiCorrente ?? [regimeSeparata],
        modalitaContributi: 'totale',
        contributiVersatiTotale: opt.contributiVersatiDuranteAnno ?? null,
        contributiVersati: [],
        impostaSaldoVersato: null,
        impostaAcconto1Versato: opt.impostaAcconto1VersatoAnnoCorrente ?? null,
        impostaAcconto2Versato: null,
      },
      [anno - 1]: {
        regimi: opt.regimiPrecedente ?? [{ ...regimeSeparata, id: 'prev', fatturato: 30000 }],
        modalitaContributi: 'totale',
        contributiVersatiTotale: opt.contributiVersatiDuranteAnnoPrecedente ?? null,
        contributiVersati: [],
        impostaSaldoVersato: null,
        impostaAcconto1Versato: null,
        impostaAcconto2Versato: null,
      },
    },
    rateazioniImposta: {},
  }
}

const inputBase: CalcoloInput = mkInput()

describe('rate fisse — competenza temporale', () => {
  // Artigiano a regime tutto l'anno, sia nel corrente sia nel precedente
  const artInteroAnno: Regime = { ...regimeArtigiani, meseInizio: 1, giornoInizio: 1, riduzioneContributi: '35' }
  const input2025: CalcoloInput = mkInput({
    anno: 2025,
    regimiCorrente: [{ ...artInteroAnno, id: 'cur' }],
    regimiPrecedente: [{ ...artInteroAnno, id: 'prev' }],
  })

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
    const conDeducibilita = calcola(mkInput({ contributiVersatiDuranteAnno: 5000 }))
    const senza = calcola(inputBase)
    expect(conDeducibilita.imponibileNettoTotalePerImposte).toBeLessThan(senza.imponibileNettoTotalePerImposte)
  })

  it('contributi versati > imponibile → imposta = 0', () => {
    const r = calcola(mkInput({ contributiVersatiDuranteAnno: 999999 }))
    expect(r.totaleImposte).toBe(0)
  })
})

describe('calcola — credito imposte', () => {
  it('acconti > dovuto → credito', () => {
    const r = calcola(mkInput({ impostaAcconto1VersatoAnnoCorrente: 99999 }))
    expect(r.creditoImposteAnnoCorrente).toBeGreaterThan(0)
    expect(r.saldoImposteDaVersareAnnoCorrente).toBe(0)
  })
})

describe('calcola — artigiani con eccedenza', () => {
  it('contributi fissi > 0', () => {
    const r = calcola(mkInput({ regimiCorrente: [regimeArtigiani] }))
    expect(r.totaleContributiFissiArtComm).toBeGreaterThan(0)
  })

  it('eccedenza artigiani con fatturato alto', () => {
    const altoFatturato: Regime = { ...regimeArtigiani, fatturato: 80000 }
    const r = calcola(mkInput({ regimiCorrente: [altoFatturato] }))
    expect(r.totaleContributiEccedenzaArtComm).toBeGreaterThan(0)
  })

  it('riduzione 35% abbassa contributi fissi', () => {
    const pieno = calcola(mkInput({ regimiCorrente: [regimeArtigiani] }))
    const ridotto = calcola(mkInput({ regimiCorrente: [{ ...regimeArtigiani, riduzioneContributi: '35' }] }))
    expect(ridotto.totaleContributiFissiArtComm).toBeLessThan(pieno.totaleContributiFissiArtComm)
  })
})

describe('calcola — scadenze', () => {
  it('genera scadenze anno corrente e successivo', () => {
    const r = calcola(mkInput({ regimiPrecedente: [{ ...regimeSeparata, id: 'p', fatturato: 30000 }] }))
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
    const con = calcola(mkInput({ contributiVersatiDuranteAnnoPrecedente: 5000 }))
    expect(con.datiAnnoPrecedente.totaleImposte).toBeLessThan(senza.datiAnnoPrecedente.totaleImposte)
  })
})

describe('calcola — acconti G.S. (regola ADE 80%, caso reale RPF 2023)', () => {
  // Dichiarazione reale, periodo d'imposta 2022: imponibile G.S. 19.901,
  // contributo dovuto (RR6) = 5.220, acconti 2023 dal software ADE =
  // 2.088,02 × 2 = 4.176 (= 80% del dovuto, due rate del 40%).
  const regimeGS: Regime = {
    ...regimeSeparata,
    meseInizio: 1, giornoInizio: 1,
    fatturato: 29703, // × 67% = 19.901 imponibile
  }
  const input2023: CalcoloInput = mkInput({
    anno: 2023,
    regimiCorrente: [{ ...regimeGS, id: 'gs23' }],
    regimiPrecedente: [{ ...regimeGS, id: 'gs22' }],
  })

  it('dovuto G.S. 2022 = 5.220 (aliquota 26,23%)', () => {
    const r = calcola(input2023)
    expect(r.datiAnnoPrecedente.totaleContributiSeparata).toBeCloseTo(5220.03, 1)
  })

  it('acconti G.S. dovuti 2023 = 80% del dovuto 2022 ≈ 4.176', () => {
    const r = calcola(input2023)
    expect(r.accontiGSVersatiPerAnnoRif).toBeCloseTo(4176.02, 1)
  })

  it('le scadenze acconto G.S. 2023 valgono 2.088 ciascuna (40% + 40%)', () => {
    const r = calcola(input2023)
    const acconti = r.scadenzeAnnoCorrente.filter(
      (s) => /Gestione separata/i.test(s.categoria ?? '') && /acconto/i.test(s.voce ?? ''),
    )
    expect(acconti).toHaveLength(2)
    const totale = acconti.reduce((s, a) => s + a.importo, 0)
    expect(totale).toBeCloseTo(4176.02, 1)
  })
})

describe('calcola — nuovo utente (stato vuoto, nessun dato)', () => {
  // Un utente che apre l'app per la prima volta ha la mappa anni vuota.
  const vuoto = (anno: number): CalcoloInput => ({ anno, anni: {}, rateazioniImposta: {} })

  it('non lancia con anni: {} su ogni anno disponibile (incluso il più recente → annoSucc fuori dal DB)', () => {
    for (const anno of anniDisponibili()) {
      expect(() => calcola(vuoto(anno))).not.toThrow()
    }
  })

  it('stato vuoto produce tutti zero, senza scadenze obbligatorie', () => {
    const r = calcola(vuoto(anniDisponibili()[0]))
    expect(r.totaleImponibileLordo).toBe(0)
    expect(r.totaleContributiINPS).toBe(0)
    expect(r.totaleImposte).toBe(0)
    expect(r.saldoImposteDaVersareAnnoCorrente).toBe(0)
    expect(r.saldoContributiGSAnnoCorrente).toBe(0)
    expect(r.saldoContributiEccArtCommAnnoCorrente).toBe(0)
    // nessuna scadenza con importo > 0
    const conImporto = [...r.scadenzeAnnoCorrente, ...r.scadenzeAnnoSuccessivo].filter((s) => s.importo > 0.005)
    expect(conImporto).toHaveLength(0)
  })

  it('anno più recente: annoSucc non in DB non blocca (usa proiezione/fallback)', () => {
    const annoRecente = anniDisponibili()[0] // il più recente
    expect(() => calcola(vuoto(annoRecente))).not.toThrow()
    // con un regime artigiani attivo, gli acconti dell'anno+1 si proiettano senza lanciare
    const conRegime = calcola({
      anno: annoRecente,
      anni: {
        [annoRecente]: {
          regimi: [{ ...regimeArtigiani, meseInizio: 1, giornoInizio: 1, fatturato: 60000 }],
          modalitaContributi: 'totale', contributiVersatiTotale: null, contributiVersati: [],
          impostaSaldoVersato: null, impostaAcconto1Versato: null, impostaAcconto2Versato: null,
        },
      },
      rateazioniImposta: {},
    })
    expect(conRegime.scadenzeAnnoSuccessivo.length).toBeGreaterThan(0)
  })
})
