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
  regimi2024?: Regime[]
  versamenti2024?: VersamentoContributo[] | null
} = {}): CalcoloInput {
  const anni: CalcoloInput['anni'] = {
    2025: datiAnno(regimi, opt.versamenti2025 ?? null),
    2026: datiAnno([], opt.versamenti2026 ?? null),
  }
  if (opt.regimi2024 || opt.versamenti2024 !== undefined) {
    anni[2024] = datiAnno(opt.regimi2024 ?? [], opt.versamenti2024 ?? null)
  }
  return { anno: 2025, anni, rateazioniImposta: {} }
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

  it('col 29: eccedenza a debito = dovuto − versato (la col 28 è per le compensazioni)', () => {
    expect(campo(campi, 29)?.valore).toBe(1973 - 900)
    expect(campo(campi, 28)).toBeUndefined()
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
    expect(campo(campi, 29)).toBeUndefined()
  })

  it('modalità cifra unica → versati e debiti/crediti non ricavabili', () => {
    const input = mkInput([artigiano2025]) // versamenti2025 null → 'totale'
    const righi = generaRighiDichiarazione(calcola(input), 2025, input)
    const campi = righi.quadroRRArtComm[0].campi
    expect(campo(campi, 14)?.valore).toBe('da inserire')
    expect(campo(campi, 27)?.valore).toBe('da inserire')
    expect(campo(campi, 16)).toBeUndefined()
    expect(campo(campi, 29)).toBeUndefined()
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

  it('senza anagrafica le righe identificative non compaiono', () => {
    const input = mkInput([artigiano2025])
    const righi = generaRighiDichiarazione(calcola(input), 2025, input)
    const campi = righi.quadroRRArtComm[0].campi
    expect(campo(campi, 2)).toBeUndefined()
    expect(campi.find((c) => c.rigo === 'RR1')).toBeUndefined()
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

  it('nessuna riga segnaposto: compaiono solo campi con un valore', () => {
    const input = mkInput([artigiano2025])
    const righi = generaRighiDichiarazione(calcola(input), 2025, input)
    const campi = righi.quadroRRArtComm[0].campi
    for (const colonna of [6, 13, 15, 18, 20, 26, 28, 31, 32, 34]) {
      expect(campo(campi, colonna)).toBeUndefined()
    }
  })

  it('credito del precedente anno sul minimale calcolato dai versamenti 2024', () => {
    const input = mkInput([artigiano2025], {
      regimi2024: [{ ...artigiano2025, id: 'prev' }],
      // dovuto fissi 2024 = 4.419,60 × 0,65 + 7,44 = 2.880,18; versati 3.200
      versamenti2024: [v('fissi-1', 800), v('fissi-2', 800), v('fissi-3', 800)],
      versamenti2025: [v('fissi-4-prec', 800)],
    })
    const righi = generaRighiDichiarazione(calcola(input), 2025, input)
    const campi = righi.quadroRRArtComm[0].campi
    expect(campo(campi, 20)?.valore).toBe(3200 - 2880)
    // sull'eccedenza 2024 non è stato versato nulla: nessun credito pregresso
    expect(campo(campi, 34)).toBeUndefined()
  })
})

describe('riepilogo LM — aritmetica sugli importi arrotondati del modello', () => {
  // Caso reale: 51.574 × 67% = 34.554,58 e contributi 7.491,30. Il modello
  // arrotonda campo per campo (34.555 − 7.491 = 27.064); il calcolo sui valori
  // al centesimo darebbe 27.063 e un'imposta più bassa di un euro.
  it('LM36, LM39 e LM46 derivano dai valori arrotondati, non dai centesimi', () => {
    const regime: Regime = { ...artigiano2025, coefficiente: 67, fatturato: 51574 }
    const input = mkInput([regime])
    input.anni[2025].modalitaContributi = 'totale'
    input.anni[2025].contributiVersatiTotale = 7491.3
    input.anni[2025].impostaAcconto1Versato = 1533.57
    input.anni[2025].impostaAcconto2Versato = 1533.57
    const righi = generaRighiDichiarazione(calcola(input), 2025, input)
    const rigo = (nome: string) => righi.riepilogoLM.find((c) => c.rigo === nome)
    expect(rigo('LM34')?.valore).toBe(34555)
    expect(rigo('LM35')?.valore).toBe(7491)
    expect(rigo('LM36')?.valore).toBe(34555 - 7491) // 27.064, non 27.063
    expect(rigo('LM39')?.valore).toBe(Math.round(27064 * 0.15)) // 4.060
    expect(rigo('LM44')?.valore).toBe(3067)
    expect(rigo('LM46')?.valore).toBe(4060 - 3067) // 993
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

// ---------------------------------------------------------------------------
// Cassa (dichiarazione) vs competenza (saldi e crediti / calendario)
// ---------------------------------------------------------------------------

/**
 * Le due sezioni dell'app guardano lo stesso anno con due lenti diverse e le
 * cifre G.S. NON devono coincidere:
 *
 * - CASSA (dichiarazione, LM35): quanto è stato materialmente pagato nel 2025,
 *   cioè il saldo della competenza 2024 + gli acconti della competenza 2025,
 *   tutti letti dalla scheda 2025. È il contributo deducibile.
 * - COMPETENZA (saldi e crediti, calendario): quanto è dovuto PER il 2025
 *   meno gli acconti DOVUTI col metodo INPS (80% del dovuto 2024). Non guarda
 *   la cassa della scheda 2025.
 *
 * Il test fissa la relazione: aggiungere versamenti alla scheda 2025 muove solo
 * la cifra di cassa, mai i due saldi di competenza.
 */
describe('cassa vs competenza — la scheda 2025 muove solo la dichiarazione', () => {
  // Reddito costante 30.000 × 67% = 20.100 in tutti gli anni, così il dovuto
  // G.S. 2023/2024/2025 è sempre 20.100 × 26,07% = 5.240,07.
  const gsAnno = (id: string): Regime => ({
    id, tipo: 'separata', aliquota: 15, coefficiente: 67,
    meseInizio: 1, giornoInizio: 1, meseFine: 12, giornoFine: 31,
    fatturato: 30000, riduzioneContributi: 'nessuna',
  })

  // Versamenti della scheda 2024: saldo competenza 2023 + i due acconti 2024.
  const versamenti2024 = () => [v('gs-saldo', 1000), v('gs-acconto-1', 381.32), v('gs-acconto-2', 381.31)]

  const costruisci = (versamenti2025: VersamentoContributo[]): CalcoloInput => ({
    anno: 2025,
    anni: {
      2023: datiAnno([gsAnno('r23')], null),
      2024: datiAnno([gsAnno('r24')], versamenti2024()),
      2025: datiAnno([gsAnno('r25')], versamenti2025),
    },
    rateazioniImposta: {},
  })

  const saldoCompetenza = (calcoli: ReturnType<typeof calcola>, anno: number, dove: 'corrente' | 'successivo') =>
    (dove === 'corrente' ? calcoli.scadenzeAnnoCorrente : calcoli.scadenzeAnnoSuccessivo).find(
      (s) => /Gestione separata/i.test(s.categoria ?? '') && s.voce === `Saldo · competenza ${anno}`,
    )

  const DOVUTO_GS = 5240.07 // 20.100 × 26,07%

  it('variante i — scheda 2025 senza versamenti: cassa 0, competenze invariate', () => {
    const input = costruisci([])
    const calcoli = calcola(input)
    const righi = generaRighiDichiarazione(calcoli, 2025, input)

    // Cassa: nulla pagato nel 2025 → nessun contributo deducibile.
    expect(righi.riepilogoLM.find((c) => c.rigo === 'LM35')?.valore).toBe(0)

    // Competenza 2025: dovuto − acconti DOVUTI (80% del dovuto 2024).
    expect(calcoli.totaleContributiSeparata).toBeCloseTo(DOVUTO_GS, 2)
    expect(calcoli.accontiGSVersatiPerAnnoRif).toBeCloseTo(0.8 * DOVUTO_GS, 2) // 4.192,06
    expect(saldoCompetenza(calcoli, 2025, 'successivo')?.importo).toBeCloseTo(1048.01, 2)

    // Competenza 2024, pagabile a giugno 2025: nettata con gli acconti dovuti
    // per il 2024 (base: redditi 2023), non con la cassa della scheda 2025.
    expect(saldoCompetenza(calcoli, 2024, 'corrente')?.importo).toBeCloseTo(1022.29, 2)
  })

  it('variante ii — acconti G.S. nella scheda 2025: cambia solo la cassa', () => {
    // 2.000 di saldo competenza 2024 + 762,63 di acconti competenza 2025.
    const input = costruisci([v('gs-saldo', 2000), v('gs-acconto-1', 381.32), v('gs-acconto-2', 381.31)])
    const calcoli = calcola(input)
    const righi = generaRighiDichiarazione(calcoli, 2025, input)

    // Cassa: TUTTO ciò che è uscito nel 2025 (saldo 2024 + acconti 2025), non
    // i soli acconti: 2.000 + 762,63 = 2.762,63 → 2.763.
    expect(calcoli.contributiVersatiAnnoImpostaPerDeducibilita).toBeCloseTo(2762.63, 2)
    expect(righi.riepilogoLM.find((c) => c.rigo === 'LM35')?.valore).toBe(2763)

    // I due saldi di competenza restano IDENTICI alla variante i: la cassa
    // della scheda 2025 non li tocca.
    expect(saldoCompetenza(calcoli, 2025, 'successivo')?.importo).toBeCloseTo(1048.01, 2)
    expect(saldoCompetenza(calcoli, 2024, 'corrente')?.importo).toBeCloseTo(1022.29, 2)

    // Gli acconti versati reali sono esposti a parte, distinti dai dovuti.
    expect(calcoli.accontiGSVersatiRealiPerAnnoRif).toBeCloseTo(762.63, 2)
    expect(calcoli.accontiGSVersatiPerAnnoRif).toBeCloseTo(0.8 * DOVUTO_GS, 2)
  })

  it('il quadro RR resta per competenza: acconti 2025, non la cassa 2025', () => {
    const input = costruisci([v('gs-saldo', 2000), v('gs-acconto-1', 381.32), v('gs-acconto-2', 381.31)])
    const righi = generaRighiDichiarazione(calcola(input), 2025, input)
    const campi = righi.quadroRRSeparata
    // RR guarda la competenza: solo i 762,63 di acconto, non i 2.762,63 di cassa.
    expect(campi.find((c) => c.descrizione.includes('Acconti versati'))?.valore).toBe(763)
    expect(campi.find((c) => c.descrizione.includes('Contributo dovuto'))?.valore).toBe(5240)
    expect(campi.find((c) => c.descrizione.includes('Contributo a debito'))?.valore).toBe(5240 - 763)
  })

  it('senza la scheda 2024 il saldo 2025 ripiega sugli acconti VERSATI e lo dichiara', () => {
    // Senza l'anno precedente gli acconti dovuti non sono calcolabili: il saldo
    // netta i soli acconti realmente versati (762,63), non il saldo di cassa.
    const input: CalcoloInput = {
      anno: 2025,
      anni: { 2025: datiAnno([gsAnno('r25')], [v('gs-acconto-1', 381.32), v('gs-acconto-2', 381.31)]) },
      rateazioniImposta: {},
    }
    const calcoli = calcola(input)
    const saldo = saldoCompetenza(calcoli, 2025, 'successivo')
    expect(saldo?.importo).toBeCloseTo(DOVUTO_GS - 762.63, 2) // 4.477,44
    expect(saldo?.nota).toMatch(/acconti versati/i)
  })
})
