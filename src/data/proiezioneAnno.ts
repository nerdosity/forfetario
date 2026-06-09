import { datiAnno, anniDisponibili, type DatiAnno } from './taxData'

/**
 * Proiezione delle costanti INPS per un anno non ancora nel database.
 *
 * Per ogni grandezza numerica (IVS, maternità, minimale, soglia) si stima il
 * valore con una REGRESSIONE LINEARE PESATA sui valori storici: gli anni più
 * recenti pesano di più, così un rallentamento recente della crescita viene
 * catturato e non si sovrastima estrapolando i salti più vecchi. Le aliquote e
 * le date di scadenza, che cambiano per legge, si ereditano dall'anno recente.
 */

/**
 * Retta y = a·x + b ai minimi quadrati PESATI. Restituisce la stima in `x`.
 * Ogni punto ha un peso w: gli anni recenti pesano di più (vedi pesoPerAnno).
 */
function regressionePesata(punti: { x: number; y: number; w: number }[], x: number): number {
  const n = punti.length
  if (n === 0) return 0
  if (n === 1) return punti[0].y

  const sw = punti.reduce((s, p) => s + p.w, 0)
  const swx = punti.reduce((s, p) => s + p.w * p.x, 0)
  const swy = punti.reduce((s, p) => s + p.w * p.y, 0)
  const swxx = punti.reduce((s, p) => s + p.w * p.x * p.x, 0)
  const swxy = punti.reduce((s, p) => s + p.w * p.x * p.y, 0)

  const denom = sw * swxx - swx * swx
  if (denom === 0) return swy / sw // x tutti uguali o pesi degeneri: media pesata
  const a = (sw * swxy - swx * swy) / denom
  const b = (swy - a * swx) / sw
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
  const annoMin = Math.min(...storici.map((s) => s.anno))

  // Peso crescente con l'anno: il più vecchio pesa 1, ogni anno successivo +1.
  // Così il trend recente domina sui salti più vecchi.
  const pesoPerAnno = (a: number) => a - annoMin + 1

  // Proietta una grandezza estraendola da ogni anno storico
  const proietta = (estrai: (d: DatiAnno) => number): number =>
    round2(
      regressionePesata(
        storici.map((s) => ({ x: s.anno, y: estrai(s.dati), w: pesoPerAnno(s.anno) })),
        anno,
      ),
    )

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
