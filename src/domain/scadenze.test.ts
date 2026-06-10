import { describe, it, expect } from 'vitest'
import { versatoPerScadenza, scadenzaPagata, bilancioPagamenti } from './scadenze'
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
  it('separa contributi e imposte, calcola il saldo (più/meno)', () => {
    const scadenze: Scadenza[] = [
      scadenza({ importo: 725.5, riferimenti: ['fissi-1'] }),
      scadenza({ importo: 1000, riferimenti: ['imposta-acconto1'] }),
    ]
    const i = input({
      contributiVersatiDettaglio: [{ id: 'a', tipo: 'fissi-1', descrizione: '', importo: 800 }],
      impostaAcconto1VersatoAnnoCorrente: 950,
    })
    const b = bilancioPagamenti(scadenze, i)
    expect(b.contributi.saldo).toBeCloseTo(800 - 725.5) // +74.5 in più
    expect(b.imposte.saldo).toBeCloseTo(950 - 1000) // −50 in meno
  })

  it('ignora le scadenze non tracciabili (senza riferimenti)', () => {
    const scadenze: Scadenza[] = [scadenza({ importo: 500, riferimenti: undefined })]
    const b = bilancioPagamenti(scadenze, input({}))
    expect(b.contributi.dovuto).toBe(0)
    expect(b.imposte.dovuto).toBe(0)
  })
})
