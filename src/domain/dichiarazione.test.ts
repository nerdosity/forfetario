import { describe, it, expect } from 'vitest'
import { calcola } from './calcolo'
import { generaRighiDichiarazione, type CampoDichiarazione } from './dichiarazione'
import type { CalcoloInput, DatiAnno, Regime, VersamentoContributo } from './types'

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const artigiano2025: Regime = {
  id: 'art',
  tipo: 'artigiani',
  aliquota: 15,
  coefficiente: 78,
  meseInizio: 1, giornoInizio: 1,
  meseFine: 12, giornoFine: 31,
  fatturato: 40000, // imponibile 31.200, sopra il minimale 2025 (18.555)
  riduzioneContributi: '35',
}

const separata2025: Regime = {
  id: 'gs',
  tipo: 'separata',
  aliquota: 15,
  coefficiente: 67,
  meseInizio: 1, giornoInizio: 1,
  meseFine: 12, giornoFine: 31,
  fatturato: 36000, // imponibile 24.120
  riduzioneContributi: 'nessuna',
}

let seq = 0
const v = (tipo: VersamentoContributo['tipo'], importo: number): VersamentoContributo => ({
  id: `v${seq++}`,
  tipo,
  descrizione: '',
  importo,
})

function datiAnno(regimi: Regime[], versamenti: VersamentoContributo[] | null): DatiAnno {
  return {
    regimi,
    modalitaContributi: versamenti === null ? 'totale' : 'dettaglio',
    contributiVersatiTotale: null,
    contributiVersati: versamenti ?? [],
    impostaSaldoVersato: null,
    impostaAcconto1Versato: null,
    impostaAcconto2Versato: null,
  }
}

function mkInput(regimi: Regime[], opt: {
  versamenti2025?: VersamentoContributo[] | null
  versamenti2026?: VersamentoContributo[] | null
} = {}): CalcoloInput {
  return {
    anno: 2025,
    anni: {
      2025: datiAnno(regimi, opt.versamenti2025 ?? null),
      2026: datiAnno([], opt.versamenti2026 ?? null),
    },
    rateazioniImposta: {},
  }
}

const campo = (campi: CampoDichiarazione[], colonna: number): CampoDichiarazione | undefined =>
  campi.find((c) => c.colonna === colonna)

// ---------------------------------------------------------------------------
// Sezione I — artigiani/commercianti
// ---------------------------------------------------------------------------

describe('quadro RR sezione I — artigiano 2025 con riduzione 35%', () => {
  const input = mkInput([artigiano2025], {
    // Rate fisse 1ª–3ª e 1° acconto eccedenza versati nel 2025
    versamenti2025: [v('fissi-1', 725.5), v('fissi-2', 725.5), v('fissi-3', 725.5), v('ecc-acconto-1', 400)],
    // 4ª rata fissa (febbraio 2026) e saldo eccedenza (giugno 2026)
    versamenti2026: [v('fissi-4-prec', 725.5), v('ecc-saldo', 500)],
  })
  const righi = generaRighiDichiarazione(calcola(input), 2025, input)

  it('genera un blocco RR2 per la gestione artigiani e nessuna sezione II', () => {
    expect(righi.quadroRRArtComm).toHaveLength(1)
    expect(righi.quadroRRArtComm[0].rigo).toBe('RR2')
    expect(righi.quadroRRArtComm[0].gestione).toBe('artigiani')
    expect(righi.quadroRRSeparata).toHaveLength(0)
  })

  const campi = righi.quadroRRArtComm[0].campi

  it('col 10: reddito minimale annuo 2025', () => {
    expect(campo(campi, 10)?.valore).toBe(18555)
  })

  it('col 11: IVS sul minimale = fisso annuo ridotto 35%, senza maternità', () => {
    // 4.453,20 × 0,65 = 2.894,58 → 2.895
    expect(campo(campi, 11)?.valore).toBe(2895)
  })

  it('col 12: maternità 0,62 × 12 mesi', () => {
    expect(campo(campi, 12)?.valore).toBe(7)
  })

  it('col 14: rate fisse versate = 1ª–3ª del 2025 + 4ª di febbraio 2026', () => {
    expect(campo(campi, 14)?.valore).toBe(2902) // 725,50 × 4
  })

  it('col 16: dovuto sul minimale interamente coperto → debito 0', () => {
    expect(campo(campi, 16)?.valore).toBe(0)
    expect(campo(campi, 17)).toBeUndefined()
  })

  it('col 24: reddito eccedente = imponibile − minimale', () => {
    expect(campo(campi, 24)?.valore).toBe(31200 - 18555)
  })

  it('col 25: IVS su eccedenza al 24% ridotto 35%', () => {
    // 12.645 × 24% × 0,65 = 1.972,62 → 1.973
    expect(campo(campi, 25)?.valore).toBe(1973)
  })

  it('col 27: versati su eccedenza = acconti 2025 + saldo 2026', () => {
    expect(campo(campi, 27)?.valore).toBe(900)
  })

  it('col 28: eccedenza a debito = dovuto − versato', () => {
    expect(campo(campi, 28)?.valore).toBe(1973 - 900)
    expect(campo(campi, 30)).toBeUndefined()
  })
})

describe('quadro RR sezione I — casi particolari', () => {
  it('acconti eccedenza oltre il dovuto → credito in col 30', () => {
    const input = mkInput([artigiano2025], {
      versamenti2025: [v('ecc-acconto-1', 1500), v('ecc-acconto-2', 1500)],
    })
    const righi = generaRighiDichiarazione(calcola(input), 2025, input)
    const campi = righi.quadroRRArtComm[0].campi
    expect(campo(campi, 30)?.valore).toBe(3000 - 1973)
    expect(campo(campi, 28)).toBeUndefined()
  })

  it('modalità cifra unica → versati e debiti/crediti non ricavabili', () => {
    const input = mkInput([artigiano2025]) // versamenti2025 null → 'totale'
    const righi = generaRighiDichiarazione(calcola(input), 2025, input)
    const campi = righi.quadroRRArtComm[0].campi
    expect(campo(campi, 14)?.valore).toBe('da inserire')
    expect(campo(campi, 27)?.valore).toBe('da inserire')
    expect(campo(campi, 16)).toBeUndefined()
    expect(campo(campi, 28)).toBeUndefined()
  })

  it('minimale e IVS rapportati ai mesi per un periodo parziale', () => {
    const daMarzo: Regime = { ...artigiano2025, meseInizio: 3, fatturato: 0 }
    const input = mkInput([daMarzo])
    const righi = generaRighiDichiarazione(calcola(input), 2025, input)
    const campi = righi.quadroRRArtComm[0].campi
    expect(campo(campi, 10)?.valore).toBe(Math.round((18555 * 10) / 12))
    expect(campo(campi, 11)?.valore).toBe(Math.round((4453.2 / 12) * 0.65 * 10))
    expect(campo(campi, 24)?.valore).toBe(0)
  })

  it('entrambe le gestioni nello stesso anno → versati da ripartire a mano', () => {
    const comm: Regime = { ...artigiano2025, id: 'comm', tipo: 'commercianti' }
    const input = mkInput([artigiano2025, comm], { versamenti2025: [v('fissi-1', 700)] })
    const righi = generaRighiDichiarazione(calcola(input), 2025, input)
    expect(righi.quadroRRArtComm).toHaveLength(2)
    expect(righi.quadroRRArtComm[1].rigo).toBe('RR3')
    for (const sezione of righi.quadroRRArtComm) {
      expect(campo(sezione.campi, 14)?.valore).toBe('da inserire')
      expect(campo(sezione.campi, 27)?.valore).toBe('da inserire')
    }
  })
})

describe('quadro RR sezione I — campi anagrafici e di contorno', () => {
  const anagrafica = {
    codiceFiscale: 'FDLGNN81S05B936O',
    cognome: '', nome: '', sesso: '' as const,
    dataNascita: '', comuneNascita: '', provinciaNascita: '',
    matricolaInps: '10130045',
    codiceSoggettoInps: '10',
    sedeInps: '7009',
  }

  it('col 2: codice INPS ricostruito dalla codeline (verificato su dato reale)', () => {
    const input = mkInput([artigiano2025])
    const righi = generaRighiDichiarazione(calcola(input), 2025, input, anagrafica)
    const campi = righi.quadroRRArtComm[0].campi
    expect(campo(campi, 2)?.valore).toBe('10130045251106615')
    // colonna 1 esiste sia in RR1 (codice azienda) sia in RR2 (codice fiscale)
    expect(campi.find((c) => c.rigo === 'RR2' && c.colonna === 1)?.valore).toBe('FDLGNN81S05B936O')
    expect(campi.find((c) => c.rigo === 'RR1')?.valore).toBe('10130045 + 2 caratteri di controllo')
  })

  it('senza anagrafica il codice INPS resta da inserire', () => {
    const input = mkInput([artigiano2025])
    const righi = generaRighiDichiarazione(calcola(input), 2025, input)
    expect(campo(righi.quadroRRArtComm[0].campi, 2)?.valore).toBe('da inserire')
  })

  it('col 7: codice C per la riduzione 35% e periodo riduzione in col 8', () => {
    const input = mkInput([artigiano2025])
    const righi = generaRighiDichiarazione(calcola(input), 2025, input)
    const campi = righi.quadroRRArtComm[0].campi
    expect(campo(campi, 7)?.valore).toBe('C')
    expect(campo(campi, 8)?.valore).toBe('da 1 a 12')
  })

  it('riduzione 50%: codice non verificato, da inserire', () => {
    const con50: Regime = { ...artigiano2025, riduzioneContributi: '50' }
    const input = mkInput([con50])
    const righi = generaRighiDichiarazione(calcola(input), 2025, input)
    expect(campo(righi.quadroRRArtComm[0].campi, 7)?.valore).toBe('da inserire')
  })

  it('senza riduzione: nessuna colonna 7/8', () => {
    const senza: Regime = { ...artigiano2025, riduzioneContributi: 'nessuna' }
    const input = mkInput([senza])
    const righi = generaRighiDichiarazione(calcola(input), 2025, input)
    const campi = righi.quadroRRArtComm[0].campi
    expect(campo(campi, 7)).toBeUndefined()
    expect(campo(campi, 8)).toBeUndefined()
  })

  it('campi di contorno: quote associative e crediti pregressi presenti', () => {
    const input = mkInput([artigiano2025])
    const righi = generaRighiDichiarazione(calcola(input), 2025, input)
    const campi = righi.quadroRRArtComm[0].campi
    expect(campo(campi, 13)?.valore).toBe(0)
    expect(campo(campi, 15)?.valore).toBe(0)
    expect(campo(campi, 20)?.valore).toBe('da inserire')
    expect(campo(campi, 26)?.valore).toBe(0)
    expect(campo(campi, 31)?.valore).toBe(0)
    expect(campo(campi, 34)?.valore).toBe('da inserire')
  })

  it('con un credito compare la riga di scelta rimborso/compensazione', () => {
    const input = mkInput([artigiano2025], {
      versamenti2025: [v('ecc-acconto-1', 1500), v('ecc-acconto-2', 1500)],
    })
    const righi = generaRighiDichiarazione(calcola(input), 2025, input)
    const campi = righi.quadroRRArtComm[0].campi
    expect(campo(campi, 32)?.valore).toBe('a tua scelta')
    expect(campo(campi, 18)).toBeUndefined() // sul minimale nessun credito
  })
})

// ---------------------------------------------------------------------------
// Sezione II — gestione separata
// ---------------------------------------------------------------------------

describe('quadro RR sezione II — gestione separata', () => {
  const perDescrizione = (campi: CampoDichiarazione[], testo: string) =>
    campi.find((c) => c.descrizione.includes(testo))

  it('reddito, dovuto, acconti e saldo a debito', () => {
    const input = mkInput([separata2025], {
      versamenti2025: [v('gs-acconto-1', 1500), v('gs-acconto-2', 1500)],
    })
    const righi = generaRighiDichiarazione(calcola(input), 2025, input)
    const campi = righi.quadroRRSeparata
    expect(righi.quadroRRArtComm).toHaveLength(0)
    expect(perDescrizione(campi, 'Reddito imponibile')?.valore).toBe(24120)
    // 24.120 × 26,07% = 6.288,08 → 6.288
    expect(perDescrizione(campi, 'Contributo dovuto')?.valore).toBe(6288)
    expect(perDescrizione(campi, 'Acconti versati')?.valore).toBe(3000)
    expect(perDescrizione(campi, 'Contributo a debito')?.valore).toBe(6288 - 3000)
    expect(perDescrizione(campi, 'Contributo a credito')).toBeUndefined()
  })

  it('acconti oltre il dovuto → contributo a credito (RR8)', () => {
    const input = mkInput([separata2025], {
      versamenti2025: [v('gs-acconto-1', 3500), v('gs-acconto-2', 3500)],
    })
    const righi = generaRighiDichiarazione(calcola(input), 2025, input)
    const credito = righi.quadroRRSeparata.find((c) => c.rigo === 'RR8')
    expect(credito?.valore).toBe(7000 - 6288)
  })

  it('nessun periodo in gestione separata → sezione II assente', () => {
    const input = mkInput([artigiano2025])
    const righi = generaRighiDichiarazione(calcola(input), 2025, input)
    expect(righi.quadroRRSeparata).toHaveLength(0)
  })
})
