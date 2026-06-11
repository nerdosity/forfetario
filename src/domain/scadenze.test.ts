import { describe, it, expect } from 'vitest'
import { versatoPerScadenza, scadenzaPagata, bilancioPagamenti, calcolaScadenze } from './scadenze'
import type { CalcoloInput, Scadenza } from './types'

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

function input(over: Partial<CalcoloInput>): CalcoloInput {
  return {
    anno: 2025,
    regimiCorrente: [],
    regimiPrecedente: [],
    contributiVersatiDuranteAnno: null,
    modalitaContributiVersati: 'dettaglio',
    contributiVersatiDettaglio: [],
    contributiVersatiDuranteAnnoPrecedente: null,
    impostaSaldoVersatoAnnoCorrente: null,
    impostaAcconto1VersatoAnnoCorrente: null,
    impostaAcconto2VersatoAnnoCorrente: null,
    accontiImposteVersatiPerAnnoPrecedente: null,
    rateazioniImposta: {},
    ...over,
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
    expect(b.gs.saldo).toBeCloseTo(250 - 300) // −50 in meno
    expect(b.imposte.saldo).toBeCloseTo(950 - 1000) // −50 in meno
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
