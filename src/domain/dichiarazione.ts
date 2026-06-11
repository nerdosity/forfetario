import type { RisultatoCalcolo } from '@/domain/types'

/**
 * Righi della dichiarazione Redditi PF — quadro LM (regime forfettario,
 * sezione II) e quadro RS (contributi previdenziali dedotti), ricostruiti
 * dai controlli ufficiali dell'Agenzia delle Entrate (ControlliRPF25,
 * QuadroLM/QuadroRS). I codici colonna corrispondono a quelli del modello.
 *
 * Semplificazione consapevole: l'app non gestisce CPB, perdite pregresse,
 * crediti esteri o aiuti di Stato, quindi quei campi sono assenti o a zero;
 * il documento prodotto è un PROMEMORIA di compilazione, non sostituisce la
 * dichiarazione.
 */

/** Un valore da riportare in un campo del modello. */
export interface CampoDichiarazione {
  /** Rigo leggibile, es. "LM34" o "RS — Contributi". */
  rigo: string
  /** Colonna del modello (1-based) quando rilevante. */
  colonna?: number
  /** Etichetta descrittiva del campo. */
  descrizione: string
  /** Valore in euro (arrotondato all'unità come da modello) o testo. */
  valore: number | string
  /** Nota esplicativa (formula, origine del dato). */
  nota?: string
}

/** Un rigo LM relativo a una singola attività (modulo). */
export interface ModuloLM {
  /** Indice del modulo (1-based), uno per attività/regime forfettario. */
  modulo: number
  /** Codice ATECO se noto (l'app non lo memorizza: resta da inserire). */
  ateco?: string
  campi: CampoDichiarazione[]
}

export interface RighiDichiarazione {
  anno: number
  /** Un modulo LM per ogni regime forfettario (artigiani/commercianti/separata). */
  moduliLM: ModuloLM[]
  /** Righi LM di riepilogo (somma su tutti i moduli) e liquidazione imposta. */
  riepilogoLM: CampoDichiarazione[]
  /** Quadro RS: contributi previdenziali e assistenziali dedotti. */
  quadroRS: CampoDichiarazione[]
  /** Vero se manca qualche dato che l'utente deve completare a mano. */
  haCampiDaCompletare: boolean
}

/** Arrotonda all'unità di euro, come richiesto dal modello dichiarativo. */
const eu = (n: number): number => Math.round(n)

/**
 * Costruisce i righi della dichiarazione dai risultati del calcolo.
 * I contributi dedotti (LM35 / RS) sono quelli effettivamente versati nell'anno
 * d'imposta, già usati dal motore per la deducibilità.
 */
export function generaRighiDichiarazione(calcoli: RisultatoCalcolo, anno: number): RighiDichiarazione {
  const regimi = calcoli.dettagliRegimiCalcolati
  const contributiDedotti = calcoli.contributiVersatiAnnoImpostaPerDeducibilita

  // ── Un modulo LM per ogni regime ────────────────────────────────────────
  const moduliLM: ModuloLM[] = regimi.map((regime, i) => {
    const redditoLordo = regime.imponibileLordoRegime
    return {
      modulo: i + 1,
      campi: [
        {
          rigo: 'LM22',
          colonna: 1,
          descrizione: 'Codice attività (ATECO)',
          valore: 'da inserire',
          nota: 'L\'app non memorizza il codice ATECO: riportarlo dal proprio.',
        },
        {
          rigo: 'LM22',
          colonna: 2,
          descrizione: 'Coefficiente di redditività',
          valore: `${regime.coefficiente}%`,
          nota: 'Determinato dal codice ATECO.',
        },
        {
          rigo: 'LM22',
          colonna: 3,
          descrizione: 'Componenti positivi (fatturato/compensi)',
          valore: eu(regime.fatturato),
          nota: 'Totale incassato nell\'anno per questa attività.',
        },
        {
          rigo: 'LM22',
          colonna: 5,
          descrizione: 'Reddito (fatturato × coefficiente)',
          valore: eu(redditoLordo),
          nota: `${eu(regime.fatturato)} × ${regime.coefficiente}%`,
        },
        {
          rigo: 'LM21',
          colonna: 3,
          descrizione: 'Regime start-up (aliquota 5%)',
          valore: regime.aliquota === 5 ? '1 (sì)' : '0 (no)',
          nota: regime.aliquota === 5 ? 'Imposta sostitutiva ridotta al 5%.' : 'Imposta sostitutiva ordinaria 15%.',
        },
      ],
    }
  })

  // ── Riepilogo LM (somma su tutti i moduli) e liquidazione ───────────────
  const redditoLordoTotale = regimi.reduce((s, r) => s + r.imponibileLordoRegime, 0)
  const redditoNetto = Math.max(0, redditoLordoTotale - contributiDedotti)
  const imposta = calcoli.totaleImposte
  const accontiVersati = calcoli.accontiImposteEffettivamenteVersatiPerAnnoCorrente
  const saldoDebito = calcoli.saldoImposteDaVersareAnnoCorrente
  const saldoCredito = calcoli.creditoImposteAnnoCorrente

  // Contributi dedotti effettivamente: non possono superare il reddito lordo (LM35 ≤ LM34)
  const contributiDeducibiliEffettivi = Math.min(contributiDedotti, redditoLordoTotale)

  const riepilogoLM: CampoDichiarazione[] = [
    {
      rigo: 'LM34',
      colonna: 3,
      descrizione: 'Reddito lordo (somma dei redditi dei moduli)',
      valore: eu(redditoLordoTotale),
      nota: 'Somma dei righi LM22 col. 5 di tutte le attività.',
    },
    {
      rigo: 'LM35',
      colonna: 1,
      descrizione: 'Contributi previdenziali e assistenziali versati',
      valore: eu(contributiDedotti),
      nota: 'Contributi INPS pagati nell\'anno (deducibili). Vedi anche quadro RS.',
    },
    {
      rigo: 'LM36',
      colonna: 1,
      descrizione: 'Reddito netto (LM34 − LM35)',
      valore: eu(redditoNetto),
      nota: contributiDedotti > redditoLordoTotale
        ? `Contributi dedotti limitati a ${eu(redditoLordoTotale)} (non superano il reddito lordo); l'eccedenza ${eu(contributiDedotti - redditoLordoTotale)} va nel quadro RS.`
        : `${eu(redditoLordoTotale)} − ${eu(contributiDeducibiliEffettivi)}`,
    },
    {
      rigo: 'LM38',
      colonna: 1,
      descrizione: 'Reddito imponibile (al netto delle perdite)',
      valore: eu(redditoNetto),
      nota: 'L\'app non gestisce perdite pregresse: coincide con LM36.',
    },
    {
      rigo: 'LM39',
      colonna: 2,
      descrizione: 'Imposta sostitutiva',
      valore: eu(imposta),
      nota: 'Imposta sostitutiva dovuta sul reddito imponibile.',
    },
    {
      rigo: 'LM42',
      colonna: 1,
      descrizione: 'Totale imposta sostitutiva',
      valore: eu(imposta),
      nota: 'Coincide con LM39 in assenza di altri redditi LM.',
    },
    {
      rigo: 'LM44',
      colonna: 1,
      descrizione: 'Acconti versati',
      valore: eu(accontiVersati),
      nota: '1° + 2° acconto imposta sostitutiva versati per l\'anno.',
    },
    {
      rigo: 'LM46',
      colonna: 1,
      descrizione: 'Imposta a debito (saldo)',
      valore: eu(saldoDebito),
      nota: 'LM42 − acconti, se positivo. Da versare a saldo.',
    },
    {
      rigo: 'LM47',
      colonna: 1,
      descrizione: 'Imposta a credito',
      valore: eu(saldoCredito),
      nota: 'Acconti − LM42, se positivo. A credito.',
    },
  ]

  // ── Quadro RS — contributi previdenziali ────────────────────────────────
  const eccedenzaContributi = Math.max(0, contributiDedotti - redditoLordoTotale)
  const quadroRS: CampoDichiarazione[] = [
    {
      rigo: 'RS',
      descrizione: 'Contributi previdenziali versati nell\'anno',
      valore: eu(contributiDedotti),
      nota: 'Totale contributi INPS pagati, di cui dedotti in LM35.',
    },
    {
      rigo: 'RS',
      descrizione: 'Contributi dedotti dal reddito (LM35)',
      valore: eu(contributiDeducibiliEffettivi),
    },
    {
      rigo: 'RS',
      descrizione: 'Contributi eccedenti non dedotti',
      valore: eu(eccedenzaContributi),
      nota: eccedenzaContributi > 0
        ? 'Parte dei contributi che supera il reddito: non deducibile qui.'
        : 'Nessuna eccedenza: tutti i contributi sono stati dedotti.',
    },
  ]

  return {
    anno,
    moduliLM,
    riepilogoLM,
    quadroRS,
    haCampiDaCompletare: true, // l'ATECO è sempre da inserire
  }
}

/** Vero se ci sono dati sufficienti per mostrare i righi (almeno un regime con fatturato). */
export function haDatiPerDichiarazione(calcoli: RisultatoCalcolo): boolean {
  return calcoli.dettagliRegimiCalcolati.some((r) => r.fatturato > 0)
}
