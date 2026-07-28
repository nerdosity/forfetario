import { describe, it, expect } from 'vitest'
import { versatoPerScadenza, scadenzaPagata, bilancioPagamenti, calcolaScadenze } from './scadenze'
import type { CalcoloInput, Scadenza, VersamentoContributo } from './types'

function scadenza(over: Partial<Scadenza>): Scadenza {
  return {
    data: '16 Maggio 2025',
    descrizione: 'test',
    importo: 100,
    componenti: [],
    annoScadenza: 2025,
    ...over,
  }
}

/**
 * Helper test: costruisce un CalcoloInput per-anno (anno rif. 2025). Gli
 * override col vecchio vocabolario (contributiVersatiDettaglio, imposta*…)
 * vengono mappati su anni[2025], così i test esistenti restano leggibili.
 */
function input(over: {
  contributiVersatiDettaglio?: VersamentoContributo[]
  modalitaContributiVersati?: 'totale' | 'dettaglio'
  contributiVersatiDuranteAnno?: number | null
  impostaSaldoVersatoAnnoCorrente?: number | null
  impostaAcconto1VersatoAnnoCorrente?: number | null
  impostaAcconto2VersatoAnnoCorrente?: number | null
} = {}): CalcoloInput {
  return {
    anno: 2025,
    anni: {
      2025: {
        regimi: [],
        modalitaContributi: over.modalitaContributiVersati ?? 'dettaglio',
        contributiVersatiTotale: over.contributiVersatiDuranteAnno ?? null,
        contributiVersati: over.contributiVersatiDettaglio ?? [],
        impostaSaldoVersato: over.impostaSaldoVersatoAnnoCorrente ?? null,
        impostaAcconto1Versato: over.impostaAcconto1VersatoAnnoCorrente ?? null,
        impostaAcconto2Versato: over.impostaAcconto2VersatoAnnoCorrente ?? null,
      },
    },
    rateazioniImposta: {},
  }
}

describe('versatoPerScadenza', () => {
  it('senza riferimenti → null (non tracciabile)', () => {
    expect(versatoPerScadenza(scadenza({ riferimenti: undefined }), input({}))).toBeNull()
  })

  it('somma le righe della lista che corrispondono ai riferimenti', () => {
    const s = scadenza({ importo: 725.5, riferimenti: ['fissi-1'] })
    const i = input({
      contributiVersatiDettaglio: [
        { id: 'a', tipo: 'fissi-1', descrizione: '', importo: 725.5 },
        { id: 'b', tipo: 'fissi-2', descrizione: '', importo: 725.5 },
      ],
    })
    expect(versatoPerScadenza(s, i)).toBeCloseTo(725.5)
  })

  it('scadenza combinata: somma più riferimenti', () => {
    const s = scadenza({ riferimenti: ['ecc-saldo', 'ecc-acconto-1'] })
    const i = input({
      contributiVersatiDettaglio: [
        { id: 'a', tipo: 'ecc-saldo', descrizione: '', importo: 1000 },
        { id: 'b', tipo: 'ecc-acconto-1', descrizione: '', importo: 500 },
      ],
    })
    expect(versatoPerScadenza(s, i)).toBeCloseTo(1500)
  })

  it('in modalità cifra unica le righe non contano → 0', () => {
    const s = scadenza({ riferimenti: ['fissi-1'] })
    const i = input({ modalitaContributiVersati: 'totale', contributiVersatiDuranteAnno: 5000 })
    expect(versatoPerScadenza(s, i)).toBe(0)
  })

  it('le tre voci imposta sono distinte (saldo, 1° e 2° acconto non si sommano a vicenda)', () => {
    const i = input({
      impostaSaldoVersatoAnnoCorrente: 100,
      impostaAcconto1VersatoAnnoCorrente: 200,
      impostaAcconto2VersatoAnnoCorrente: 300,
    })
    expect(versatoPerScadenza(scadenza({ riferimenti: ['imposta-saldo'] }), i)).toBe(100)
    expect(versatoPerScadenza(scadenza({ riferimenti: ['imposta-acconto1'] }), i)).toBe(200)
    expect(versatoPerScadenza(scadenza({ riferimenti: ['imposta-acconto2'] }), i)).toBe(300)
  })
})

describe('scadenzaPagata', () => {
  it('pagata quando versato ≥ dovuto', () => {
    const s = scadenza({ importo: 725.5, riferimenti: ['fissi-1'] })
    const i = input({ contributiVersatiDettaglio: [{ id: 'a', tipo: 'fissi-1', descrizione: '', importo: 725.5 }] })
    expect(scadenzaPagata(s, i)).toBe(true)
  })

  it('non pagata se versato < dovuto', () => {
    const s = scadenza({ importo: 725.5, riferimenti: ['fissi-1'] })
    const i = input({ contributiVersatiDettaglio: [{ id: 'a', tipo: 'fissi-1', descrizione: '', importo: 700 }] })
    expect(scadenzaPagata(s, i)).toBe(false)
  })

  it('pagata anche con eccedenza (versato > dovuto)', () => {
    const s = scadenza({ importo: 720, riferimenti: ['fissi-1'] })
    const i = input({ contributiVersatiDettaglio: [{ id: 'a', tipo: 'fissi-1', descrizione: '', importo: 725.5 }] })
    expect(scadenzaPagata(s, i)).toBe(true)
  })

  it('non pagata senza riferimenti', () => {
    expect(scadenzaPagata(scadenza({ riferimenti: undefined }), input({}))).toBe(false)
  })

  it('tollera l\'arrotondamento all\'euro (pagato 244 su dovuto 244,60 → pagata)', () => {
    const s = scadenza({ importo: 244.6, riferimenti: ['gs-saldo'] })
    const i = input({ contributiVersatiDettaglio: [{ id: 'a', tipo: 'gs-saldo', descrizione: '', importo: 244 }] })
    expect(scadenzaPagata(s, i)).toBe(true)
  })

  it('oltre la tolleranza resta non pagata (pagato 240 su 244,60)', () => {
    const s = scadenza({ importo: 244.6, riferimenti: ['gs-saldo'] })
    const i = input({ contributiVersatiDettaglio: [{ id: 'a', tipo: 'gs-saldo', descrizione: '', importo: 240 }] })
    expect(scadenzaPagata(s, i)).toBe(false)
  })
})

describe('bilancioPagamenti', () => {
  it('separa artComm, gestione separata e imposte, calcola il saldo (più/meno)', () => {
    const scadenze: Scadenza[] = [
      scadenza({ importo: 725.5, riferimenti: ['fissi-1'] }),
      scadenza({ importo: 300, riferimenti: ['gs-saldo'] }),
      scadenza({ importo: 1000, riferimenti: ['imposta-acconto1'] }),
    ]
    const i = input({
      contributiVersatiDettaglio: [
        { id: 'a', tipo: 'fissi-1', descrizione: '', importo: 800 },
        { id: 'b', tipo: 'gs-saldo', descrizione: '', importo: 250 },
      ],
      impostaAcconto1VersatoAnnoCorrente: 950,
    })
    const b = bilancioPagamenti(scadenze, i)
    expect(b.artComm.saldo).toBeCloseTo(800 - 725.5) // +74.5 in più
    expect(b.gs.saldo).toBeCloseTo(250 - 300) // -50 in meno
    expect(b.imposte.saldo).toBeCloseTo(950 - 1000) // -50 in meno
  })

  it('esclude dalla deducibilità le voci non deducibili (volontari)', () => {
    // (verifica indiretta: il bilancio usa versatoPerScadenza, non il flag;
    // qui controlliamo solo che il flag non rompa la classificazione)
    const scadenze: Scadenza[] = [scadenza({ importo: 725.5, riferimenti: ['fissi-1'] })]
    const i = input({
      contributiVersatiDettaglio: [{ id: 'a', tipo: 'fissi-1', descrizione: '', importo: 800, deducibile: false }],
    })
    const b = bilancioPagamenti(scadenze, i)
    expect(b.artComm.dovuto).toBeCloseTo(725.5)
  })

  it('ignora le scadenze non tracciabili (senza riferimenti)', () => {
    const scadenze: Scadenza[] = [scadenza({ importo: 500, riferimenti: undefined })]
    const b = bilancioPagamenti(scadenze, input({}))
    expect(b.artComm.dovuto).toBe(0)
    expect(b.imposte.dovuto).toBe(0)
  })
})

describe('calcolaScadenze — rateazione imposta', () => {
  const params = {
    anno: 2025,
    regimiCorrente: [],
    regimiPrecedente: [],
    saldoImposteDaVersare: 992.35,
    saldoContributiGS: 0,
    saldoContributiEccArtComm: 0,
    totaleImposteCorrente: 4059.5, // genera 1° e 2° acconto 2026 da 2029,75
    totaleContributiSeparataCorrente: 0,
    totaleContributiEccedenzaArtCommCorrente: 0,
    totaleImpostePrecedente: 0,
    accontiImposteVersatiPerAnnoPrecedente: 0,
    totaleContributiSeparataPrecedente: 0,
    totaleContributiEccedenzaArtCommPrecedente: 0,
  }

  it('senza rateazione: voci singole con la chiave di rateazione', () => {
    const { scadenzeAnnoSuccessivo } = calcolaScadenze(params)
    const saldo = scadenzeAnnoSuccessivo.filter((s) => s.chiaveRateazione === 'saldo-2025')
    expect(saldo).toHaveLength(1)
    expect(saldo[0].data).toBe('30 Giugno 2026')
  })

  it('con rateazione applicata: il calendario espone le rate con le loro date', () => {
    const { scadenzeAnnoSuccessivo } = calcolaScadenze({
      ...params,
      rateazioniImposta: { 'acconto1-2026': { inizio: 'giugno', numeroRate: 6 } },
    })
    const rate = scadenzeAnnoSuccessivo.filter((s) => s.chiaveRateazione === 'acconto1-2026')
    expect(rate).toHaveLength(6)
    expect(rate.map((r) => r.data)).toEqual([
      '30 Giugno 2026', '16 Luglio 2026', '20 Agosto 2026',
      '16 Settembre 2026', '16 Ottobre 2026', '16 Novembre 2026',
    ])
    // importo totale = acconto + interessi; il saldo resta una voce unica
    const totale = rate.reduce((s, r) => s + r.importo, 0)
    expect(totale).toBeGreaterThan(2029.75)
    expect(scadenzeAnnoSuccessivo.filter((s) => s.chiaveRateazione === 'saldo-2025')).toHaveLength(1)
  })

  it('rateazione da luglio: la prima rata slitta al 30 luglio', () => {
    const { scadenzeAnnoSuccessivo } = calcolaScadenze({
      ...params,
      rateazioniImposta: { 'saldo-2025': { inizio: 'luglio', numeroRate: 1 } },
    })
    const saldo = scadenzeAnnoSuccessivo.filter((s) => s.chiaveRateazione === 'saldo-2025')
    expect(saldo).toHaveLength(1)
    expect(saldo[0].data).toBe('30 Luglio 2026')
    expect(saldo[0].importo).toBeCloseTo(996.32, 2)
  })
})

describe('calcolaScadenze — saldo contributi anno precedente al netto degli acconti', () => {
  // Il saldo di N-1 si versa a giugno di N: deve essere il dovuto di N-1 MENO
  // gli acconti dovuti per N-1, come già avviene per il saldo dell'anno corrente.
  const base = {
    anno: 2025,
    regimiCorrente: [],
    regimiPrecedente: [],
    saldoImposteDaVersare: 0,
    saldoContributiGS: 0,
    saldoContributiEccArtComm: 0,
    totaleImposteCorrente: 0,
    totaleImpostePrecedente: 0,
    accontiImposteVersatiPerAnnoPrecedente: 0,
    totaleContributiSeparataPrecedente: 0,
    totaleContributiEccedenzaArtCommPrecedente: 0,
  }

  const saldoGS = (s: Scadenza[]) => s.find((x) => x.chiaveRateazione === 'gs-saldo-2024')
  const saldoEcc = (s: Scadenza[]) => s.find((x) => x.chiaveRateazione === 'ecc-saldo-2024')

  it('G.S.: importo = dovuto 2024 − acconti dovuti per il 2024', () => {
    const { scadenzeAnnoCorrente } = calcolaScadenze({
      ...base,
      totaleContributiSeparataPrecedente: 5000,
      saldoContributiGSPrecedente: 1000,
      accontiGSDovutiPerPrecedente: 4000,
    })
    const s = saldoGS(scadenzeAnnoCorrente)
    expect(s).toBeDefined()
    expect(s!.importo).toBeCloseTo(1000, 2)
  })

  it('G.S.: le componenti documentano dovuto e acconti dell\'anno di competenza', () => {
    const { scadenzeAnnoCorrente } = calcolaScadenze({
      ...base,
      totaleContributiSeparataPrecedente: 5000,
      saldoContributiGSPrecedente: 1000,
      accontiGSDovutiPerPrecedente: 4000,
    })
    expect(saldoGS(scadenzeAnnoCorrente)!.componenti).toEqual([
      { tipo: 'Totale dovuto 2024', importo: 5000 },
      { tipo: 'Acconti già versati nell\'anno', importo: -4000 },
    ])
  })

  it('G.S.: acconti ≥ dovuto → nessuna scadenza di saldo', () => {
    const { scadenzeAnnoCorrente } = calcolaScadenze({
      ...base,
      totaleContributiSeparataPrecedente: 5000,
      saldoContributiGSPrecedente: 0,
      accontiGSDovutiPerPrecedente: 6000,
    })
    expect(saldoGS(scadenzeAnnoCorrente)).toBeUndefined()
  })

  it('G.S.: gli acconti dell\'anno corrente restano sul dovuto PIENO di N-1 (80%)', () => {
    // Il netting riguarda solo il saldo: la base degli acconti (metodo ADE) è il
    // contributo dovuto pieno del 2024, non il saldo netto.
    const { scadenzeAnnoCorrente } = calcolaScadenze({
      ...base,
      regimiCorrente: [{
        id: 'gs', tipo: 'separata', aliquota: 15, coefficiente: 67,
        meseInizio: 1, giornoInizio: 1, meseFine: 12, giornoFine: 31,
        fatturato: 30000, riduzioneContributi: 'nessuna',
      }],
      totaleContributiSeparataPrecedente: 5000,
      saldoContributiGSPrecedente: 1000,
      accontiGSDovutiPerPrecedente: 4000,
    })
    const acconti = scadenzeAnnoCorrente.filter((s) =>
      (s.riferimenti ?? []).some((r) => r === 'gs-acconto-1' || r === 'gs-acconto-2'),
    )
    expect(acconti).toHaveLength(2)
    // 80% di 5000 (dovuto pieno), non di 1000 (saldo netto).
    expect(acconti.reduce((t, a) => t + a.importo, 0)).toBeCloseTo(4000, 2)
  })

  it('eccedenza Art/Comm: importo = dovuto 2024 − acconti dovuti, con componenti', () => {
    const { scadenzeAnnoCorrente } = calcolaScadenze({
      ...base,
      totaleContributiEccedenzaArtCommPrecedente: 2496,
      saldoContributiEccArtCommPrecedente: 1223.35,
      accontiEccDovutiPerPrecedente: 1272.65,
    })
    const s = saldoEcc(scadenzeAnnoCorrente)
    expect(s).toBeDefined()
    expect(s!.importo).toBeCloseTo(1223.35, 2)
    expect(s!.componenti).toEqual([
      { tipo: 'Totale dovuto 2024', importo: 2496 },
      { tipo: 'Acconti già versati nell\'anno', importo: -1272.65 },
    ])
  })

  it('eccedenza Art/Comm: acconti ≥ dovuto → nessuna scadenza di saldo', () => {
    const { scadenzeAnnoCorrente } = calcolaScadenze({
      ...base,
      totaleContributiEccedenzaArtCommPrecedente: 2000,
      saldoContributiEccArtCommPrecedente: 0,
      accontiEccDovutiPerPrecedente: 2500,
    })
    expect(saldoEcc(scadenzeAnnoCorrente)).toBeUndefined()
  })

  it('senza acconti il saldo resta il dovuto pieno, con la voce singola', () => {
    const { scadenzeAnnoCorrente } = calcolaScadenze({
      ...base,
      totaleContributiSeparataPrecedente: 5000,
      saldoContributiGSPrecedente: 5000,
      accontiGSDovutiPerPrecedente: 0,
    })
    const s = saldoGS(scadenzeAnnoCorrente)!
    expect(s.importo).toBeCloseTo(5000, 2)
    expect(s.componenti).toEqual([{ tipo: 'Saldo contributi G.S. 2024', importo: 5000 }])
  })

  it('senza i nuovi parametri si ricade sul dovuto pieno (compatibilità)', () => {
    const { scadenzeAnnoCorrente } = calcolaScadenze({
      ...base,
      totaleContributiSeparataPrecedente: 5000,
    })
    expect(saldoGS(scadenzeAnnoCorrente)!.importo).toBeCloseTo(5000, 2)
  })
})

describe('calcolaScadenze — rateazione contributi Gestione separata', () => {
  const params = {
    anno: 2025,
    regimiCorrente: [],
    regimiPrecedente: [],
    saldoImposteDaVersare: 0,
    saldoContributiGS: 1000,
    saldoContributiEccArtComm: 0,
    totaleImposteCorrente: 0,
    totaleContributiSeparataCorrente: 0,
    totaleContributiEccedenzaArtCommCorrente: 0,
    totaleImpostePrecedente: 0,
    accontiImposteVersatiPerAnnoPrecedente: 0,
    totaleContributiSeparataPrecedente: 0,
    totaleContributiEccedenzaArtCommPrecedente: 0,
  }

  it('il saldo contributi G.S. dell\'anno successivo ha chiaveRateazione gs-saldo-{anno}', () => {
    const { scadenzeAnnoSuccessivo } = calcolaScadenze(params)
    const saldo = scadenzeAnnoSuccessivo.filter((s) => s.chiaveRateazione === 'gs-saldo-2025')
    expect(saldo).toHaveLength(1)
    expect(saldo[0].importo).toBeCloseTo(1000, 2)
  })

  it('con rateazione applicata: il saldo G.S. si espande in rate la cui somma ≈ importo + interessi', () => {
    const { scadenzeAnnoSuccessivo } = calcolaScadenze({
      ...params,
      rateazioniImposta: { 'gs-saldo-2025': { inizio: 'giugno', numeroRate: 6 } },
    })
    const rate = scadenzeAnnoSuccessivo.filter((s) => s.chiaveRateazione === 'gs-saldo-2025')
    expect(rate).toHaveLength(6)
    const totale = rate.reduce((s, r) => s + r.importo, 0)
    // Somma ≈ importo originario + interessi di rateazione (pochi punti percentuali).
    expect(totale).toBeGreaterThan(1000)
    expect(totale).toBeLessThan(1050)
  })

  it('il 2° acconto G.S. non ha chiaveRateazione (non è rateizzabile)', () => {
    const { scadenzeAnnoSuccessivo } = calcolaScadenze(params)
    const acconto2 = scadenzeAnnoSuccessivo.filter((s) =>
      (s.riferimenti ?? []).includes('gs-acconto-2'),
    )
    for (const s of acconto2) expect(s.chiaveRateazione).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Fallback sugli acconti VERSATI quando i dovuti non sono calcolabili
// ---------------------------------------------------------------------------

/** CalcoloInput con i soli versamenti di dettaglio di un anno solare. */
function inputVersamenti(anno: number, versamenti: VersamentoContributo[]): CalcoloInput {
  return {
    anno,
    anni: {
      [anno]: {
        regimi: [],
        modalitaContributi: 'dettaglio',
        contributiVersati: versamenti,
        contributiVersatiTotale: null,
        impostaSaldoVersato: null,
        impostaAcconto1Versato: null,
        impostaAcconto2Versato: null,
      },
    },
    rateazioniImposta: {},
  }
}

const NOTA_FALLBACK =
  'Saldo calcolato sottraendo gli acconti versati inseriti: aggiungi i dati ' +
  'dell\'anno precedente per il calcolo degli acconti con il metodo INPS.'

describe('calcolaScadenze — fallback sugli acconti versati', () => {
  const base = {
    anno: 2025,
    regimiCorrente: [],
    regimiPrecedente: [],
    saldoImposteDaVersare: 0,
    saldoContributiGS: 0,
    saldoContributiEccArtComm: 0,
    totaleImposteCorrente: 0,
    totaleImpostePrecedente: 0,
    accontiImposteVersatiPerAnnoPrecedente: 0,
    totaleContributiSeparataPrecedente: 0,
    totaleContributiEccedenzaArtCommPrecedente: 0,
  }

  const saldoGS2025 = (s: Scadenza[]) => s.find((x) => x.chiaveRateazione === 'gs-saldo-2025')
  const saldoEcc2025 = (s: Scadenza[]) => s.find((x) => x.chiaveRateazione === 'ecc-saldo-2025')

  it('G.S. competenza 2025: senza dati 2024 il saldo si netta con gli acconti versati', () => {
    // Scenario dell'utente: compilato solo il 2025, acconti pagati inseriti nel
    // 2025. Senza il 2024 gli acconti DOVUTI valgono 0 → il saldo sarebbe pieno.
    const { scadenzeAnnoSuccessivo } = calcolaScadenze({
      ...base,
      saldoContributiGS: 5000, // dovuto pieno: nessun acconto dovuto calcolabile
      totaleContributiSeparataDovutoCorrente: 5000,
      accontiGSVersatiNelCorrente: 0,
      input: inputVersamenti(2025, [
        { id: 'a', tipo: 'gs-acconto-1', descrizione: '', importo: 1500 },
        { id: 'b', tipo: 'gs-acconto-2', descrizione: '', importo: 1500 },
      ]),
    })
    const s = saldoGS2025(scadenzeAnnoSuccessivo)
    expect(s).toBeDefined()
    expect(s!.importo).toBeCloseTo(2000, 2) // 5000 - 3000 versati
    expect(s!.componenti).toEqual([
      { tipo: 'Totale dovuto 2025', importo: 5000 },
      { tipo: 'Acconti già versati nell\'anno', importo: -3000 },
    ])
    expect(s!.nota).toBe(NOTA_FALLBACK)
  })

  it('eccedenza Art/Comm competenza 2025: stesso fallback sugli acconti versati', () => {
    const { scadenzeAnnoSuccessivo } = calcolaScadenze({
      ...base,
      saldoContributiEccArtComm: 2496,
      totaleContributiEccArtCommDovutoCorrente: 2496,
      accontiEccVersatiNelCorrente: 0,
      input: inputVersamenti(2025, [
        { id: 'a', tipo: 'ecc-acconto-1', descrizione: '', importo: 636.32 },
        { id: 'b', tipo: 'ecc-acconto-2', descrizione: '', importo: 636.33 },
      ]),
    })
    const s = saldoEcc2025(scadenzeAnnoSuccessivo)
    expect(s).toBeDefined()
    expect(s!.importo).toBeCloseTo(1223.35, 2)
    expect(s!.nota).toBe(NOTA_FALLBACK)
  })

  it('acconti versati ≥ dovuto → nessuna scadenza di saldo', () => {
    const { scadenzeAnnoSuccessivo } = calcolaScadenze({
      ...base,
      saldoContributiGS: 3000,
      totaleContributiSeparataDovutoCorrente: 3000,
      accontiGSVersatiNelCorrente: 0,
      input: inputVersamenti(2025, [
        { id: 'a', tipo: 'gs-acconto-1', descrizione: '', importo: 3000 },
      ]),
    })
    expect(saldoGS2025(scadenzeAnnoSuccessivo)).toBeUndefined()
  })

  it('controprova: con gli acconti DOVUTI calcolabili il fallback non scatta', () => {
    // I versamenti reali (3000) non devono toccare il saldo: resta dovuto-dovuti.
    const { scadenzeAnnoSuccessivo } = calcolaScadenze({
      ...base,
      saldoContributiGS: 1000,
      totaleContributiSeparataDovutoCorrente: 5000,
      accontiGSVersatiNelCorrente: 4000,
      input: inputVersamenti(2025, [
        { id: 'a', tipo: 'gs-acconto-1', descrizione: '', importo: 1500 },
        { id: 'b', tipo: 'gs-acconto-2', descrizione: '', importo: 1500 },
      ]),
    })
    const s = saldoGS2025(scadenzeAnnoSuccessivo)!
    expect(s.importo).toBeCloseTo(1000, 2)
    expect(s.componenti).toEqual([
      { tipo: 'Totale dovuto 2025', importo: 5000 },
      { tipo: 'Acconti già versati nell\'anno', importo: -4000 },
    ])
    expect(s.nota).toBeUndefined()
  })

  it('in modalità cifra unica il fallback non scatta (acconti non ricavabili)', () => {
    const { scadenzeAnnoSuccessivo } = calcolaScadenze({
      ...base,
      saldoContributiGS: 5000,
      totaleContributiSeparataDovutoCorrente: 5000,
      accontiGSVersatiNelCorrente: 0,
      input: {
        anno: 2025,
        anni: {
          2025: {
            regimi: [],
            modalitaContributi: 'totale',
            contributiVersati: [],
            contributiVersatiTotale: 3000,
            impostaSaldoVersato: null,
            impostaAcconto1Versato: null,
            impostaAcconto2Versato: null,
          },
        },
        rateazioniImposta: {},
      },
    })
    const s = saldoGS2025(scadenzeAnnoSuccessivo)!
    expect(s.importo).toBeCloseTo(5000, 2)
    expect(s.nota).toBeUndefined()
  })

  it('saldo competenza 2024 mostrato nel 2025: stesso fallback', () => {
    const { scadenzeAnnoCorrente } = calcolaScadenze({
      ...base,
      totaleContributiSeparataPrecedente: 4000,
      saldoContributiGSPrecedente: 4000,
      accontiGSDovutiPerPrecedente: 0,
      input: inputVersamenti(2024, [
        { id: 'a', tipo: 'gs-acconto-1', descrizione: '', importo: 1000 },
        { id: 'b', tipo: 'gs-acconto-2', descrizione: '', importo: 1000 },
      ]),
    })
    const s = scadenzeAnnoCorrente.find((x) => x.chiaveRateazione === 'gs-saldo-2024')!
    expect(s.importo).toBeCloseTo(2000, 2)
    expect(s.nota).toBe(NOTA_FALLBACK)
  })

  it('la nota non collide con i pattern F24 (Quota / Interessi / Maggiorazione)', () => {
    const { scadenzeAnnoSuccessivo } = calcolaScadenze({
      ...base,
      saldoContributiGS: 5000,
      totaleContributiSeparataDovutoCorrente: 5000,
      accontiGSVersatiNelCorrente: 0,
      input: inputVersamenti(2025, [
        { id: 'a', tipo: 'gs-acconto-1', descrizione: '', importo: 3000 },
      ]),
    })
    const s = saldoGS2025(scadenzeAnnoSuccessivo)!
    for (const c of s.componenti) {
      expect(/^Quota/.test(c.tipo)).toBe(false)
      expect(/^(Interessi|Maggiorazione)/.test(c.tipo)).toBe(false)
    }
  })
})
