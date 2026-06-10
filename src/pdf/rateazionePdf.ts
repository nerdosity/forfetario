import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { PianoRateazione, RataPiano } from '@/domain/rateazione'
import type { AnagraficaContribuente } from '@/data/anagraficaStorage'
import { formattaScadenza } from '@/domain/dates'

/**
 * PDF del piano di rateazione di un versamento d'imposta sostitutiva: pagina
 * di riepilogo con la guida alla compilazione (codici tributo, campo
 * rateazione "NNRR", anno di riferimento) e una delega F24 in FACSIMILE per
 * ogni rata, con i dati del contribuente. Importi e codici replicano il
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
  /** Dati del contribuente per le deleghe; i campi vuoti restano da compilare. */
  anagrafica: AnagraficaContribuente
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
  anagrafica,
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

  // ── Una delega F24 in facsimile per ogni rata ─────────────────────────────
  for (const rata of piano.rate) {
    doc.addPage()
    disegnaDelegaFacsimile(doc, margine, { rata, n, tributo, annoCompetenza, annoScadenza, anagrafica })
  }

  const tipoFile = tipoVersamento === 'saldo' ? 'saldo' : 'primo-acconto'
  doc.save(`rateazione-imposta-${tipoFile}-${annoCompetenza}.pdf`)
}

// ---------------------------------------------------------------------------
// Delega F24 in facsimile (una pagina per rata)
// ---------------------------------------------------------------------------

interface ParamsDelega {
  rata: RataPiano
  n: number
  tributo: { codice: string; descrizione: string }
  annoCompetenza: number
  annoScadenza: number
  anagrafica: AnagraficaContribuente
}

const finalY = (doc: jsPDF): number =>
  (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

function disegnaDelegaFacsimile(
  doc: jsPDF,
  margine: number,
  { rata, n, tributo, annoCompetenza, annoScadenza, anagrafica }: ParamsDelega,
): void {
  const scadenza = formattaScadenza(rata.dataMMGG, annoScadenza)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...BLU)
  doc.text('Modello F24 — facsimile', margine, 20)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...GRIGIO_TESTO)
  doc.text(
    `${n === 1 ? 'Versamento unico' : `Rata ${rata.numero} di ${n}`} · da versare entro il ${scadenza}`,
    margine,
    26,
  )

  // Sezione contribuente: caselle con etichetta in testa, vuote se non fornite.
  const stiliContribuente = {
    theme: 'grid' as const,
    styles: { fontSize: 9.5, cellPadding: 2.5, textColor: [30, 41, 59] as [number, number, number], minCellHeight: 9 },
    headStyles: { fillColor: [241, 245, 249] as [number, number, number], textColor: GRIGIO_TESTO, fontSize: 7.5 },
    margin: { left: margine, right: margine },
  }
  autoTable(doc, {
    ...stiliContribuente,
    startY: 32,
    head: [['Codice fiscale', 'Cognome', 'Nome']],
    body: [[anagrafica.codiceFiscale, anagrafica.cognome, anagrafica.nome]],
    columnStyles: { 0: { cellWidth: 55, font: 'courier', fontStyle: 'bold' } },
  })
  autoTable(doc, {
    ...stiliContribuente,
    startY: finalY(doc) + 2,
    head: [['Data di nascita', 'Sesso', 'Comune (o Stato estero) di nascita', 'Prov.']],
    body: [[anagrafica.dataNascita, anagrafica.sesso, anagrafica.comuneNascita, anagrafica.provinciaNascita]],
    columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 18, halign: 'center' }, 3: { cellWidth: 16, halign: 'center' } },
  })

  // Sezione erario.
  let y = finalY(doc) + 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(...BLU)
  doc.text('Sezione erario', margine, y)

  const righe: string[][] = [
    [tributo.codice, campoRateazione(rata.numero, n), String(annoCompetenza), euro(rata.quota), ''],
  ]
  if (rata.interessi > 0) {
    righe.push([CODICE_INTERESSI, '', String(annoCompetenza), euro(rata.interessi), ''])
  }
  autoTable(doc, {
    startY: y + 3,
    margin: { left: margine, right: margine },
    head: [['Codice tributo', 'Rateazione/regione/prov./mese rif.', 'Anno di riferimento', 'Importi a debito versati', 'Importi a credito compensati']],
    body: righe,
    foot: [
      ['', '', 'Totale A', euro(rata.importo), 'B'],
      ['', '', 'Saldo (A − B)', euro(rata.importo), ''],
    ],
    theme: 'grid',
    styles: { fontSize: 9.5, cellPadding: 2.5, textColor: [30, 41, 59] },
    headStyles: { fillColor: BLU, fontSize: 8 },
    footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold' },
    columnStyles: { 0: { halign: 'center' }, 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
  })

  // Saldo finale e legenda.
  y = finalY(doc) + 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(30, 41, 59)
  doc.text(`Saldo finale: ${euro(rata.importo)}`, margine, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GRIGIO_TESTO)
  doc.text(
    `${tributo.codice}: ${tributo.descrizione}${rata.interessi > 0 ? ` · ${CODICE_INTERESSI}: interessi pagamento dilazionato imposte erariali` : ''}`,
    margine,
    y + 5,
  )
  doc.text(
    'Facsimile di supporto alla compilazione: non utilizzabile per il versamento. Riportare i dati sul modello',
    margine,
    y + 10,
  )
  doc.text('F24 ufficiale (home banking, Entratel/Fisconline o sportello).', margine, y + 14)
}
