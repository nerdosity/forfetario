import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { CampoDichiarazione, RighiDichiarazione } from '@/domain/dichiarazione'

/**
 * PDF promemoria dei righi della dichiarazione (quadro LM forfettario + RS
 * contributi). Tabellare e sobrio; si apre in una nuova scheda da cui salvare
 * o stampare. Promemoria di compilazione, non un modello presentabile.
 */

const BLU = rgb(29 / 255, 78 / 255, 216 / 255)
const GRIGIO = rgb(71 / 255, 85 / 255, 105 / 255)
const NERO = rgb(0.1, 0.16, 0.23)
const AMBRA = rgb(0.72, 0.45, 0.05)
const RIGA = rgb(0.85, 0.87, 0.9)

const euro = (v: number): string =>
  `${new Intl.NumberFormat('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)} €`

export async function generaPdfDichiarazione(righi: RighiDichiarazione): Promise<string> {
  const doc = await PDFDocument.create()
  doc.setTitle(`Righi dichiarazione ${righi.anno}`)
  const helv = await doc.embedFont(StandardFonts.Helvetica)
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold)

  let pagina = doc.addPage([595.28, 841.89])
  const margine = 50
  let y = 790

  const nuovaPaginaSeServe = (necessario: number) => {
    if (y - necessario < 60) {
      pagina = doc.addPage([595.28, 841.89])
      y = 790
    }
  }

  // Intestazione
  pagina.drawText('Righi dichiarazione Redditi PF', { x: margine, y, size: 16, font: helvBold, color: BLU })
  y -= 18
  pagina.drawText(`Quadro LM (regime forfettario) e quadro RS — anno d'imposta ${righi.anno}`, {
    x: margine, y, size: 10, font: helv, color: GRIGIO,
  })
  y -= 26

  const sezione = (titolo: string, campi: CampoDichiarazione[]) => {
    nuovaPaginaSeServe(40 + campi.length * 16)
    pagina.drawText(titolo, { x: margine, y, size: 11.5, font: helvBold, color: BLU })
    y -= 16

    // intestazioni colonne
    const X_RIGO = margine
    const X_COL = margine + 55
    const X_DESC = margine + 90
    const FINE = 545
    pagina.drawText('Rigo', { x: X_RIGO, y, size: 8.5, font: helvBold, color: GRIGIO })
    pagina.drawText('Col.', { x: X_COL, y, size: 8.5, font: helvBold, color: GRIGIO })
    pagina.drawText('Descrizione', { x: X_DESC, y, size: 8.5, font: helvBold, color: GRIGIO })
    const lblVal = 'Valore'
    pagina.drawText(lblVal, { x: FINE - helvBold.widthOfTextAtSize(lblVal, 8.5), y, size: 8.5, font: helvBold, color: GRIGIO })
    y -= 5
    pagina.drawLine({ start: { x: margine, y }, end: { x: FINE, y }, thickness: 0.8, color: NERO })
    y -= 13

    for (const c of campi) {
      nuovaPaginaSeServe(16)
      pagina.drawText(c.rigo, { x: X_RIGO, y, size: 9.5, font: helvBold, color: NERO })
      pagina.drawText(c.colonna ? String(c.colonna) : '—', { x: X_COL, y, size: 9.5, font: helv, color: GRIGIO })
      // descrizione troncata per non sforare la colonna valore
      const maxW = FINE - X_DESC - 95
      let desc = c.descrizione
      while (helv.widthOfTextAtSize(desc, 9) > maxW && desc.length > 4) desc = desc.slice(0, -2)
      if (desc !== c.descrizione) desc = desc.slice(0, -1) + '…'
      pagina.drawText(desc, { x: X_DESC, y, size: 9, font: helv, color: NERO })

      const isNum = typeof c.valore === 'number'
      const testo = isNum ? euro(c.valore as number) : String(c.valore)
      const font = isNum ? helvBold : helv
      const color = isNum ? NERO : AMBRA
      pagina.drawText(testo, { x: FINE - font.widthOfTextAtSize(testo, 9.5), y, size: 9.5, font, color })
      y -= 4
      pagina.drawLine({ start: { x: margine, y }, end: { x: FINE, y }, thickness: 0.3, color: RIGA })
      y -= 12
    }
    y -= 12
  }

  righi.moduliLM.forEach((m) => {
    const titolo = righi.moduliLM.length > 1 ? `Quadro LM — attività ${m.modulo}` : 'Quadro LM — attività'
    sezione(titolo, m.campi)
  })
  sezione('Quadro LM — liquidazione imposta', righi.riepilogoLM)
  sezione('Quadro RS — contributi previdenziali', righi.quadroRS)

  // Nota finale
  nuovaPaginaSeServe(40)
  const note = [
    'I valori in colore ambra non sono ricavabili dai dati inseriti (es. il codice ATECO): vanno completati a mano.',
    'Promemoria di compilazione basato sui controlli ufficiali dell\'Agenzia delle Entrate (ControlliRPF). Non',
    'sostituisce la dichiarazione né i controlli del software ufficiale; non gestisce CPB, perdite pregresse,',
    'crediti d\'imposta o aiuti di Stato.',
  ]
  for (const r of note) {
    pagina.drawText(r, { x: margine, y, size: 8, font: helv, color: GRIGIO })
    y -= 11
  }

  const bytes = await doc.save()
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  return URL.createObjectURL(blob)
}
