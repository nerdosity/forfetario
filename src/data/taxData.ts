import rawData from './taxData.json'
import type { TipoRegime } from '@/domain/types'

/** Importo fisso annuo IVS + quota maternità mensile per artigiani/commercianti. */
export interface ContributoFisso {
  ivsAnnuale: number
  maternitaMensile: number
}

/** Date obbligatorie delle scadenze, in formato "MM-GG". */
export interface ScadenzeAnno {
  /** 4 rate trimestrali dei contributi fissi (l'ultima cade l'anno successivo). */
  rateContributiFissi: [string, string, string, string]
  /** Saldo + primo acconto imposte. */
  saldoAccontoImposte: string
  /** Secondo acconto imposte. */
  secondoAccontoImposte: string
}

/** Costanti fiscali validate per un singolo anno. */
export interface DatiAnno {
  minimaleReddito: number
  sogliaPrimaFascia: number
  aliquotaSeparata: number
  aliquotaArtigiani: number
  aliquotaCommercianti: number
  contributoFisso: {
    artigiani: ContributoFisso
    commercianti: ContributoFisso
  }
  scadenze: ScadenzeAnno
}

// ---------------------------------------------------------------------------
// Validazione: il JSON è dati grezzi (anche modificabili a mano per nuovi anni),
// quindi va validato prima dell'uso. In caso di nodo malformato si lancia un
// errore esplicito così l'anno difettoso è subito individuabile.
// ---------------------------------------------------------------------------

class TaxDataError extends Error {
  constructor(anno: string, campo: string, dettaglio: string) {
    super(`Dati fiscali ${anno} non validi — campo "${campo}": ${dettaglio}`)
    this.name = 'TaxDataError'
  }
}

const REGEX_MESE_GIORNO = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

function numeroPositivo(anno: string, campo: string, v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
    throw new TaxDataError(anno, campo, `atteso numero ≥ 0, ricevuto ${JSON.stringify(v)}`)
  }
  return v
}

function dataValida(anno: string, campo: string, v: unknown): string {
  if (typeof v !== 'string' || !REGEX_MESE_GIORNO.test(v)) {
    throw new TaxDataError(anno, campo, `attesa data "MM-GG", ricevuto ${JSON.stringify(v)}`)
  }
  return v
}

function contributoFisso(anno: string, campo: string, v: unknown): ContributoFisso {
  if (typeof v !== 'object' || v === null) {
    throw new TaxDataError(anno, campo, 'atteso oggetto { ivsAnnuale, maternitaMensile }')
  }
  const o = v as Record<string, unknown>
  return {
    ivsAnnuale: numeroPositivo(anno, `${campo}.ivsAnnuale`, o.ivsAnnuale),
    maternitaMensile: numeroPositivo(anno, `${campo}.maternitaMensile`, o.maternitaMensile),
  }
}

function validaAnno(anno: string, v: unknown): DatiAnno {
  if (typeof v !== 'object' || v === null) {
    throw new TaxDataError(anno, '(root)', 'atteso oggetto')
  }
  const o = v as Record<string, unknown>
  const scad = (o.scadenze ?? {}) as Record<string, unknown>
  const rate = scad.rateContributiFissi

  if (!Array.isArray(rate) || rate.length !== 4) {
    throw new TaxDataError(anno, 'scadenze.rateContributiFissi', 'attese esattamente 4 date')
  }

  return {
    minimaleReddito: numeroPositivo(anno, 'minimaleReddito', o.minimaleReddito),
    sogliaPrimaFascia: numeroPositivo(anno, 'sogliaPrimaFascia', o.sogliaPrimaFascia),
    aliquotaSeparata: numeroPositivo(anno, 'aliquotaSeparata', o.aliquotaSeparata),
    aliquotaArtigiani: numeroPositivo(anno, 'aliquotaArtigiani', o.aliquotaArtigiani),
    aliquotaCommercianti: numeroPositivo(anno, 'aliquotaCommercianti', o.aliquotaCommercianti),
    contributoFisso: {
      artigiani: contributoFisso(anno, 'contributoFisso.artigiani', (o.contributoFisso as Record<string, unknown>)?.artigiani),
      commercianti: contributoFisso(anno, 'contributoFisso.commercianti', (o.contributoFisso as Record<string, unknown>)?.commercianti),
    },
    scadenze: {
      rateContributiFissi: rate.map((d, i) =>
        dataValida(anno, `scadenze.rateContributiFissi[${i}]`, d),
      ) as [string, string, string, string],
      saldoAccontoImposte: dataValida(anno, 'scadenze.saldoAccontoImposte', scad.saldoAccontoImposte),
      secondoAccontoImposte: dataValida(anno, 'scadenze.secondoAccontoImposte', scad.secondoAccontoImposte),
    },
  }
}

const anniRaw = (rawData as { anni?: Record<string, unknown> }).anni ?? {}

/** Mappa anno → costanti validate. Costruita (e validata) una sola volta. */
export const DATI_FISCALI: Record<number, DatiAnno> = Object.fromEntries(
  Object.entries(anniRaw).map(([anno, dati]) => [Number(anno), validaAnno(anno, dati)]),
)

/** Anni disponibili, ordinati in modo decrescente (più recente per primo). */
export const ANNI_DISPONIBILI: number[] = Object.keys(DATI_FISCALI)
  .map(Number)
  .sort((a, b) => b - a)

/** Restituisce i dati fiscali di un anno, lanciando se non presente. */
export function datiAnno(anno: number): DatiAnno {
  const d = DATI_FISCALI[anno]
  if (!d) {
    throw new Error(
      `Anno ${anno} non presente nel database fiscale. Anni disponibili: ${ANNI_DISPONIBILI.join(', ')}.`,
    )
  }
  return d
}

/** Aliquota contributiva per tipo di gestione in un dato anno. */
export function aliquotaContributi(anno: number, tipo: TipoRegime): number {
  const d = datiAnno(anno)
  switch (tipo) {
    case 'separata':
      return d.aliquotaSeparata
    case 'artigiani':
      return d.aliquotaArtigiani
    case 'commercianti':
      return d.aliquotaCommercianti
  }
}

/** Contributo fisso annuo per tipo; 0 per la gestione separata (non ne ha). */
export function contributoFissoAnno(anno: number, tipo: TipoRegime): ContributoFisso {
  const d = datiAnno(anno)
  if (tipo === 'artigiani') return d.contributoFisso.artigiani
  if (tipo === 'commercianti') return d.contributoFisso.commercianti
  return { ivsAnnuale: 0, maternitaMensile: 0 }
}
