import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { PianoRateazione } from '@/domain/rateazione'
import { formattaScadenza } from '@/domain/dates'

/**
 * PDF del piano di rateazione di un versamento d'imposta sostitutiva, con la
 * guida alla compilazione del modello F24 (sezione erario): codici tributo,
 * campo rateazione "NNRR", anno di riferimento e importi, come prodotti dal
 * software ufficiale "Redditi PF" dell'Agenzia delle Entrate.
 */

/** Tipo di versamento rateizzato, ricavato dalla chiave di rateazione. */
export type TipoVersamentoImposta = 'saldo' | 'acconto1'

export interface DatiPdfRateazione {
  /** Es. "Imposta sostitutiva · Saldo · competenza 2025". */
  intestazione: string
  tipoVersamento: TipoVersamentoImposta
  /** Anno d'imposta cui si riferisce il versamento (campo "anno di riferimento"). */
  annoCompetenza: number
  /** Anno solare in cui cadono le rate. */
  annoScadenza: number
  piano: PianoRateazione
}

// Codici tributo dell'imposta sostitutiva del regime forfettario.
const CODICE_TRIBUTO: Record<TipoVersamentoImposta, { codice: string; descrizione: string }> = {
  saldo: { codice: '1792', descrizione: 'Imposta sostitutiva regime forfettario — saldo' },
  acconto1: { codice: '1790', descrizione: 'Imposta sostitutiva regime forfettario — acconto prima rata' },
}

/** Interessi da pagamento dilazionato dei tributi erariali. */
const CODICE_INTERESSI = '1668'

const euro = (v: number): string =>
  `${new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)} €`

/** Campo F24 "rateazione/regione/prov./mese rif.": NNRR (rata su totale). */
const campoRateazione = (numero: number, totale: number): string =>
  `${String(numero).padStart(2, '0')}${String(totale).padStart(2, '0')}`

const BLU: [number, number, number] = [29, 78, 216] // ~blue-700
const GRIGIO_TESTO: [number, number, number] = [71, 85, 105] // ~slate-600

export function generaPdfRateazione({
  intestazione,
  tipoVersamento,
  annoCompetenza,
  annoScadenza,
  piano,
}: DatiPdfRateazione): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margine = 16
  const n = piano.opzioni.numeroRate
  const tributo = CODICE_TRIBUTO[tipoVersamento]

  // ── Intestazione ──────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...BLU)
  doc.text('Piano di rateazione del versamento', margine, 20)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  doc.setTextColor(...GRIGIO_TESTO)
  doc.text(intestazione, margine, 27)

  const opzioniTesto =
    piano.opzioni.inizio === 'giugno'
      ? `prima scadenza ordinaria (${formattaScadenza('06-30', annoScadenza)})`
      : `prima scadenza differita (${formattaScadenza('07-30', annoScadenza)}), maggiorazione 0,4%`
  const righeRiepilogo = [
    `Importo da rateizzare: ${euro(piano.importoOriginario)}`,
    ...(piano.maggiorazione > 0 ? [`Maggiorazione 0,4%: ${euro(piano.maggiorazione)}`] : []),
    `Opzione: ${n === 1 ? 'versamento unico' : `${n} rate`}, ${opzioniTesto}`,
    `Interessi di rateazione complessivi: ${euro(piano.totaleInteressi)}`,
    `Totale da versare: ${euro(piano.totale)}`,
  ]
  doc.setFontSize(9.5)
  righeRiepilogo.forEach((r, i) => doc.text(r, margine, 35 + i * 5))

  // ── Tabella del piano ─────────────────────────────────────────────────────
  autoTable(doc, {
    startY: 38 + righeRiepilogo.length * 5,
    margin: { left: margine, right: margine },
    head: [['Rata', 'Scadenza', 'Quota', 'Interessi', 'Importo rata']],
    body: piano.rate.map((rata) => [
      n === 1 ? 'Unica' : `${rata.numero} di ${n}`,
      formattaScadenza(rata.dataMMGG, annoScadenza),
      euro(rata.quota),
      rata.interessi > 0
        ? `${euro(rata.interessi)} (${(rata.aliquotaInteressi * 100).toFixed(2).replace('.', ',')}%)`
        : '—',
      euro(rata.importo),
    ]),
    foot: [['', 'Totale', euro(piano.importoOriginario + piano.maggiorazione), euro(piano.totaleInteressi), euro(piano.totale)]],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2, textColor: [30, 41, 59] },
    headStyles: { fillColor: BLU, fontSize: 9 },
    footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold' },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
  })

  // ── Compilazione modello F24 — sezione erario ─────────────────────────────
  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.setTextColor(...BLU)
  doc.text('Compilazione del modello F24 — sezione erario', margine, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GRIGIO_TESTO)
  doc.text(
    `${tributo.codice}: ${tributo.descrizione} · ${CODICE_INTERESSI}: interessi pagamento dilazionato imposte erariali`,
    margine,
    y + 5,
  )

  const corpoF24 = piano.rate.flatMap((rata) => {
    const scadenza = formattaScadenza(rata.dataMMGG, annoScadenza)
    const righe = [
      [scadenza, tributo.codice, campoRateazione(rata.numero, n), String(annoCompetenza), euro(rata.quota)],
    ]
    if (rata.interessi > 0) {
      righe.push([scadenza, CODICE_INTERESSI, '', String(annoCompetenza), euro(rata.interessi)])
    }
    return righe
  })

  autoTable(doc, {
    startY: y + 9,
    margin: { left: margine, right: margine },
    head: [['Versamento entro', 'Codice tributo', 'Rateazione', 'Anno di rif.', 'Importi a debito']],
    body: corpoF24,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2, textColor: [30, 41, 59] },
    headStyles: { fillColor: BLU, fontSize: 9 },
    columnStyles: { 4: { halign: 'right' } },
  })

  // ── Note ──────────────────────────────────────────────────────────────────
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  doc.setFontSize(8)
  doc.setTextColor(...GRIGIO_TESTO)
  const note = [
    'Le date sono quelle nominali: se cadono in giorni festivi o prefestivi slittano al primo giorno lavorativo utile.',
    'Gli interessi di rateazione (4% annuo, 0,33% al mese) non sono dovuti quando non superano 1,03 € per rata.',
    'Calcoli replicati dal software ufficiale "Redditi PF" dell\'Agenzia delle Entrate. Documento di supporto alla',
    'compilazione: non sostituisce il modello F24 né la dichiarazione.',
  ]
  note.forEach((r, i) => doc.text(r, margine, y + i * 4))

  const tipoFile = tipoVersamento === 'saldo' ? 'saldo' : 'primo-acconto'
  doc.save(`rateazione-imposta-${tipoFile}-${annoCompetenza}.pdf`)
}
