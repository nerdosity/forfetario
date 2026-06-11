import { describe, it, expect } from 'vitest'
import { calcola } from './calcolo'
import type { CalcoloInput } from './types'

/**
 * Test diagnostico: dato l'input reale segnalato dall'utente, stampa e fissa
 * tutti gli output del motore, per chiarire perché l'acconto eccedenza
 * artigiani/commercianti 2026 risulta inferiore al saldo eccedenza 2025.
 */

const input: CalcoloInput = {
  anno: 2025,
  anni: {
    2025: {
      regimi: [
        { id: 'regime-3', tipo: 'artigiani', aliquota: 15, coefficiente: 67, meseInizio: 1, giornoInizio: 1, meseFine: 12, giornoFine: 31, fatturato: 51574, riduzioneContributi: '35' },
      ],
      modalitaContributi: 'dettaglio',
      contributiVersatiTotale: 6232.73,
      contributiVersati: [
        { id: 'vers-1', tipo: 'gs-saldo', descrizione: '', importo: 265.86 },
        { id: 'vers-2', tipo: 'fissi-1', descrizione: '', importo: 1115.16 },
        { id: 'vers-3', tipo: 'ecc-saldo', descrizione: '', importo: 1540 },
        { id: 'vers-4', tipo: 'altro', descrizione: '1a rata INPS non versati 2024', importo: 144.74 },
        { id: 'vers-5', tipo: 'altro', descrizione: '2a rata INPS non versati 2024', importo: 144.68 },
        { id: 'vers-6', tipo: 'fissi-3', descrizione: '', importo: 725.5 },
        { id: 'vers-7', tipo: 'altro', descrizione: '3a rata INPS non versati 2024', importo: 144.68 },
        { id: 'vers-8', tipo: 'altro', descrizione: '4a rata INPS non versati 2024', importo: 144.68 },
        { id: 'vers-9', tipo: 'fissi-2', descrizione: '', importo: 725.5 },
        { id: 'vers-10', tipo: 'altro', descrizione: '5a rata INPS non versati 2024', importo: 144.68 },
        { id: 'vers-11', tipo: 'ecc-acconto-1', descrizione: '', importo: 377.27 },
        { id: 'vers-12', tipo: 'ecc-acconto-2', descrizione: '', importo: 767.11 },
        { id: 'vers-13', tipo: 'altro', descrizione: '5a rata INPS non versati 2024', importo: 144.68 },
        { id: 'vers-14', tipo: 'fissi-4-prec', descrizione: '', importo: 1106.76 },
      ],
      impostaSaldoVersato: 163,
      impostaAcconto1Versato: 1533.57,
      impostaAcconto2Versato: 1533.57,
    },
    2024: {
      regimi: [
        { id: 'regime-4', tipo: 'separata', aliquota: 15, coefficiente: 67, meseInizio: 1, giornoInizio: 1, meseFine: 2, giornoFine: 14, fatturato: 1516, riduzioneContributi: 'nessuna' },
        { id: 'regime-5', tipo: 'artigiani', aliquota: 15, coefficiente: 67, meseInizio: 2, giornoInizio: 15, meseFine: 12, giornoFine: 31, fatturato: 39870, riduzioneContributi: '35' },
      ],
      modalitaContributi: 'totale',
      contributiVersatiTotale: 7281,
      contributiVersati: [],
      impostaSaldoVersato: null,
      impostaAcconto1Versato: 2904,
      impostaAcconto2Versato: null,
    },
  },
  rateazioniImposta: {
    'acconto1-2026': { inizio: 'luglio', numeroRate: 5 },
    'saldo-2025': { inizio: 'luglio', numeroRate: 5 },
  },
}

const e2 = (n: number) => Math.round(n * 100) / 100

describe('diagnostica input reale utente', () => {
  const r = calcola(input)

  it('stampa tutti gli output principali', () => {
    const dump = {
      annoCorrente: {
        totaleImponibileLordo: e2(r.totaleImponibileLordo),
        totaleContributiINPS: e2(r.totaleContributiINPS),
        totaleContributiSeparata: e2(r.totaleContributiSeparata),
        totaleContributiFissiArtComm: e2(r.totaleContributiFissiArtComm),
        totaleContributiEccedenzaArtComm: e2(r.totaleContributiEccedenzaArtComm),
        totaleImposte: e2(r.totaleImposte),
        imponibileNettoPerImposte: e2(r.imponibileNettoTotalePerImposte),
      },
      annoPrecedente: {
        totaleContributiSeparata: e2(r.datiAnnoPrecedente.totaleContributiSeparata),
        totaleContributiFissiArtComm: e2(r.datiAnnoPrecedente.totaleContributiFissiArtComm),
        totaleContributiEccedenzaArtComm: e2(r.datiAnnoPrecedente.totaleContributiEccedenzaArtComm),
        totaleImposte: e2(r.datiAnnoPrecedente.totaleImposte),
      },
      saldi: {
        saldoImposteDaVersare: e2(r.saldoImposteDaVersareAnnoCorrente),
        creditoImposte: e2(r.creditoImposteAnnoCorrente),
        saldoContributiGS: e2(r.saldoContributiGSAnnoCorrente),
        saldoContributiEccArtComm: e2(r.saldoContributiEccArtCommAnnoCorrente),
        accontiEccVersati: e2(r.accontiEccArtCommVersatiPerAnnoRif),
      },
    }
    // eslint-disable-next-line no-console
    console.log('DIAGNOSTICA OUTPUT:\n' + JSON.stringify(dump, null, 2))
    expect(r).toBeTruthy()
  })

  it('stampa le scadenze eccedenza Art/Comm con saldo e acconto a confronto', () => {
    const righe = [...r.scadenzeAnnoCorrente, ...r.scadenzeAnnoSuccessivo]
      .filter((s) => s.categoria === 'Contributi eccedenza artigiani/commercianti')
      .map((s) => ({ voce: s.voce, importo: e2(s.importo), data: s.data }))
    // eslint-disable-next-line no-console
    console.log('SCADENZE ECCEDENZA:\n' + JSON.stringify(righe, null, 2))
    expect(righe.length).toBeGreaterThan(0)
  })

  it('il saldo eccedenza è documentato in dovuto − acconti DOVUTI (come INPS)', () => {
    const saldo = r.scadenzeAnnoSuccessivo.find(
      (s) => s.categoria === 'Contributi eccedenza artigiani/commercianti' && s.voce?.startsWith('Saldo'),
    )!
    // Il calcolatore ufficiale INPS calcola: saldo = eccedenza dovuta − acconti
    // DOVUTI (non quelli versati). Eccedenza 2025 = 2496,00 (reddito imponibile
    // arrotondato all'euro come INPS), acconti dovuti 1272,64 → saldo 1223,36.
    expect(saldo.componenti).toHaveLength(2)
    expect(saldo.componenti[0].importo).toBeCloseTo(2496.0, 0) // dovuto 2025
    expect(saldo.componenti[1].importo).toBeCloseTo(-1272.64, 0) // acconti DOVUTI (636,32 × 2)
    const somma = saldo.componenti.reduce((a, c) => a + c.importo, 0)
    expect(somma).toBeCloseTo(saldo.importo, 2)
    expect(saldo.importo).toBeCloseTo(1223.36, 0) // ≈ valore calcolatore INPS (1223,35)
  })

  it('acconto eccedenza 2025 = 636,32 (metodo INPS: redditi 2024, costanti 2025)', () => {
    const acconti = r.scadenzeAnnoCorrente.filter(
      (s) => s.categoria === 'Contributi eccedenza artigiani/commercianti' && s.voce?.includes('acconto'),
    )
    // eslint-disable-next-line no-console
    console.log('ACCONTI ECCEDENZA 2025:\n' + JSON.stringify(
      acconti.map((s) => ({ voce: s.voce, importo: e2(s.importo) })), null, 2))
    expect(acconti).toHaveLength(2)
    for (const a of acconti) expect(a.importo).toBeCloseTo(636.32, 1)
  })

  it('credito gestione artigiani: scala il saldo successivo (consigliato)', () => {
    const saldo = r.scadenzeAnnoSuccessivo.find(
      (s) => s.categoria === 'Contributi eccedenza artigiani/commercianti' && s.voce?.startsWith('Saldo'),
    )!
    // eslint-disable-next-line no-console
    console.log('CONGUAGLIO SALDO ECCEDENZA:\n' + JSON.stringify({
      dovutoUfficiale: e2(saldo.importo),
      consigliato: saldo.importoConsigliato != null ? e2(saldo.importoConsigliato) : null,
      nota: saldo.notaConsigliato,
    }, null, 2))
    // Dovuto ufficiale (come INPS): 1223,35 (eccedenza − acconti dovuti).
    // Conguaglio = somma dei soli di-PIÙ sulle rate obbligatorie di competenza 2025:
    //   fissi-1: 1115,16 − 725,50 = +389,66
    //   ecc-acconto-2: 767,11 − 636,32 = +130,79
    //   (ecc-acconto-1 pagato in meno NON riduce il credito)
    // credito = 520,45 → consigliato = 1223,35 − 520,45 = 702,90
    expect(saldo.importoConsigliato).not.toBeNull()
    expect(saldo.importo).toBeCloseTo(1223.35, 1)
    expect(saldo.importo - saldo.importoConsigliato!).toBeCloseTo(520.45, 1)
    expect(saldo.importoConsigliato!).toBeCloseTo(702.90, 1)
  })

  it('confronto diretto: saldo ecc 2025 vs 1° acconto ecc 2026', () => {
    // Saldo ecc 2025 = eccedenza dovuta 2025 − acconti ecc versati nel 2025
    const eccedenzaDovuta2025 = e2(r.totaleContributiEccedenzaArtComm)
    const accontiEccVersati = e2(r.accontiEccArtCommVersatiPerAnnoRif)
    const saldoEcc2025 = e2(r.saldoContributiEccArtCommAnnoCorrente)

    // 1° acconto ecc 2026 = 50% dell'eccedenza dovuta 2025 (acconto 100% in due rate)
    const primoAccontoEcc2026 = e2(r.totaleContributiEccedenzaArtComm * 0.5)

    // eslint-disable-next-line no-console
    console.log('CONFRONTO ECCEDENZA:\n' + JSON.stringify({
      eccedenzaDovuta2025,
      accontiEccVersatiNel2025: accontiEccVersati,
      saldoEcc2025_dovuto_a_giugno2026: saldoEcc2025,
      primoAccontoEcc2026_50pct: primoAccontoEcc2026,
      nota: 'saldo = dovuto − acconti già versati; acconto = 50% del dovuto. Sono basi diverse.',
    }, null, 2))

    expect(saldoEcc2025).toBeCloseTo(eccedenzaDovuta2025 - accontiEccVersati, 2)
  })
})
