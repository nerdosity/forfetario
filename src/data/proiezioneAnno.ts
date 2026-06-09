import { datiAnno, anniDisponibili, type DatiAnno } from './taxData'

/**
 * Proiezione delle costanti INPS per un anno non ancora nel database.
 *
 * Per ogni grandezza numerica (IVS, maternità, minimale, soglia) si stima il
 * valore con una REGRESSIONE LINEARE ai minimi quadrati sui valori storici di
 * tutti gli anni disponibili: cattura la tendenza di crescita reale invece di
 * copiare semplicemente l'ultimo anno. Le aliquote e le date di scadenza, che
 * cambiano molto raramente, si ereditano dall'anno più recente.
 */

/** Retta y = a·x + b ai minimi quadrati. Restituisce la stima in `x`. */
function regressioneLineare(punti: { x: number; y: number }[], x: number): number {
  const n = punti.length
  if (n === 0) return 0
  if (n === 1) return punti[0].y // un solo dato: nessun trend, resta costante

  const sx = punti.reduce((s, p) => s + p.x, 0)
  const sy = punti.reduce((s, p) => s + p.y, 0)
  const sxx = punti.reduce((s, p) => s + p.x * p.x, 0)
  const sxy = punti.reduce((s, p) => s + p.x * p.y, 0)

  const denom = n * sxx - sx * sx
  if (denom === 0) return sy / n // x tutti uguali: media
  const a = (n * sxy - sx * sy) / denom
  const b = (sy - a * sx) / n
  return a * x + b
}

/** Arrotonda a 2 decimali (gli importi INPS sono in centesimi). */
const round2 = (v: number) => Math.round(v * 100) / 100

/**
 * Costruisce un `DatiAnno` STIMATO per `anno`, proiettando dai dati storici.
 * Restituisce null se non c'è alcun anno storico da cui partire.
 */
export function proiettaDatiAnno(anno: number): DatiAnno | null {
  const anni = anniDisponibili().filter((a) => a < anno)
  if (anni.length === 0) return null

  const storici = anni.map((a) => ({ anno: a, dati: datiAnno(a) }))
  const recente = storici.reduce((max, s) => (s.anno > max.anno ? s : max)).dati

  // Proietta una grandezza estraendola da ogni anno storico
  const proietta = (estrai: (d: DatiAnno) => number): number =>
    round2(regressioneLineare(storici.map((s) => ({ x: s.anno, y: estrai(s.dati) })), anno))

  return {
    minimaleReddito: proietta((d) => d.minimaleReddito),
    sogliaPrimaFascia: proietta((d) => d.sogliaPrimaFascia),
    // Aliquote: ereditate (variazioni normative rare, non proiettabili dal trend)
    aliquotaSeparata: recente.aliquotaSeparata,
    aliquotaArtigiani: recente.aliquotaArtigiani,
    aliquotaCommercianti: recente.aliquotaCommercianti,
    contributoFisso: {
      artigiani: {
        ivsAnnuale: proietta((d) => d.contributoFisso.artigiani.ivsAnnuale),
        maternitaMensile: proietta((d) => d.contributoFisso.artigiani.maternitaMensile),
      },
      commercianti: {
        ivsAnnuale: proietta((d) => d.contributoFisso.commercianti.ivsAnnuale),
        maternitaMensile: proietta((d) => d.contributoFisso.commercianti.maternitaMensile),
      },
    },
    // Date di scadenza: ereditate dall'anno più recente (nominali, stabili)
    scadenze: recente.scadenze,
  }
}
