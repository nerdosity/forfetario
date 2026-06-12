import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import modelloF24Url from '@/assets/ModF24IMU2013.pdf'
import type { AnagraficaContribuente } from '@/data/anagraficaStorage'

/**
 * PDF del modello F24 in FACSIMILE per il versamento di contributi INPS e/o
 * imposte. Disegna sul modello ufficiale (ModF24IMU2013.pdf, A4 595×842) la
 * sezione ERARIO (in alto: imposte/rate) e la sezione INPS (in basso:
 * codeline). Accanto allo stemma riporta tipo rata e scadenza, come fa l'INPS.
 *
 * Documento di supporto: facsimile non valido per il versamento; serve per
 * sapere cosa pagare e con quali codici/codeline.
 */

const NERO = rgb(0.1, 0.16, 0.23)
const GRIGIO_CHIARO = rgb(0.75, 0.75, 0.75)

/** Una riga della sezione ERARIO (imposte). */
export interface RigaErarioF24 {
  codiceTributo: string
  /** Campo "rateazione/regione/prov./mese rif." (es. "0101"). */
  rateazione?: string
  annoRiferimento: number
  importo: number
}

/** Una riga della sezione INPS (contributi). */
export interface RigaInpsF24 {
  /** Codice sede INPS (4 cifre). */
  codiceSede: string
  /** Causale contributo (AF, AP, …). */
  causale: string
  /** Codeline / codice INPS (17 cifre). */
  codeline: string
  /** Periodo di riferimento dal (MM/AAAA). */
  periodoDal: string
  /** Periodo di riferimento al (MM/AAAA). */
  periodoAl: string
  importo: number
}

/** Dati di un singolo modello F24 (una pagina/delega). */
export interface ModuloF24 {
  /** Etichetta in alto a destra (es. "4ª RATA"). */
  etichettaRata?: string
  /** Scadenza leggibile (es. "16 Febbraio 2027"). */
  scadenza?: string
  erario: RigaErarioF24[]
  inps: RigaInpsF24[]
  anagrafica: AnagraficaContribuente
}

// ── Formati di stampa (come il software ufficiale) ─────────────────────────

/** Importo: virgola → spazio, allineato a destra su 15 caratteri. '' se 0. */
const fmtImporto = (importoEuro: number): string => {
  const cents = Math.round(importoEuro * 100)
  if (cents === 0) return ''
  const testo = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2 })
    .format(cents / 100)
    .replace(',', ' ')
  return ` ${testo.padStart(15)}`
}

/** Un carattere per casella (carattere + spazio). */
const fmtSpaziato = (valore: string): string => valore.split('').join(' ')

const fmtDataNascita = (valore: string): string => {
  const cifre = valore.replace(/\D/g, '')
  return cifre.length === 8 ? fmtSpaziato(cifre) : valore
}

// ── Generazione ────────────────────────────────────────────────────────────

export async function generaPdfF24(moduli: ModuloF24[], titolo = 'Modelli F24'): Promise<string> {
  const doc = await PDFDocument.create()
  doc.setTitle(titolo)
  const courier = await doc.embedFont(StandardFonts.CourierBold)
  const times = await doc.embedFont(StandardFonts.TimesRomanBold)

  const modello = await PDFDocument.load(await fetch(modelloF24Url).then((r) => r.arrayBuffer()))
  const indicePagina = Math.min(2, modello.getPageCount() - 1)

  for (const m of moduli) {
    const [pagina] = await doc.copyPages(modello, [indicePagina])
    doc.addPage(pagina)
    disegnaModulo(pagina, m, courier, times)
  }

  const bytes = await doc.save()
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  return URL.createObjectURL(blob)
}

/**
 * Coordinate sul modello A4 595×842 (origine in basso a sinistra). La sezione
 * erario riusa le coordinate del software ufficiale (record A, modello IMU
 * 2013). La sezione INPS è posizionata in proporzione alla struttura del modello.
 */
function disegnaModulo(
  pagina: PDFPage,
  { etichettaRata, scadenza, erario, inps, anagrafica }: ModuloF24,
  courier: PDFFont,
  times: PDFFont,
): void {
  const scrivi = (testo: string, x: number, y: number, size: number) => {
    if (!testo || testo.trim().length === 0) return
    pagina.drawText(testo, { x, y, size, font: courier, color: NERO })
  }

  // Filigrana FAC-SIMILE.
  pagina.drawText('FAC-SIMILE', { x: 185, y: 60, size: 40, font: times, color: GRIGIO_CHIARO })

  // ── Info rata/scadenza accanto allo stemma (area calcolata dallo screen) ──
  if (etichettaRata) scrivi(etichettaRata.toUpperCase(), 144, 815, 10)
  if (scadenza) scrivi(`SCADENZA: ${scadenza}`, 144, 803, 9)

  // ── Contribuente (record M) ──
  scrivi(fmtSpaziato(anagrafica.codiceFiscale), 117, 724, 12)
  scrivi(anagrafica.cognome.toUpperCase(), 117, 701, 12)
  scrivi(anagrafica.nome.toUpperCase(), 420, 701, 12)
  scrivi(fmtDataNascita(anagrafica.dataNascita), 117, 677, 12)
  scrivi(anagrafica.sesso, 245, 677, 12)
  scrivi(anagrafica.comuneNascita.toUpperCase(), 272, 677, 12)
  scrivi(fmtSpaziato(anagrafica.provinciaNascita), 542, 677, 12)

  // ── Sezione ERARIO (record A): righe alle Y 593, 581, … (passo 12) ──
  let totErario = 0
  erario.forEach((r, i) => {
    const y = 593 - 12 * i
    scrivi(r.codiceTributo, 175, y, 9)
    scrivi(r.rateazione ?? '', 232, y, 9)
    scrivi(String(r.annoRiferimento), 282, y, 9)
    scrivi(fmtImporto(r.importo), 313, y, 9)
    totErario += r.importo
  })
  if (totErario > 0) {
    scrivi(fmtImporto(totErario), 313, 521, 9) // totale colonna debiti sez. erario
    scrivi(fmtImporto(totErario), 486, 521, 9) // saldo sezione
    scrivi('+', 481, 521, 9)
  }

  // ── Sezione INPS: coordinate misurate sul modello (rigo a Y≈485, passo 11.9) ──
  // Periodo in formato MM | AAAA: mese e anno in caselle separate.
  const meseAnno = (p: string): [string, string] => {
    const m = p.match(/(\d{1,2})\s*\/\s*(\d{4})/)
    return m ? [m[1].padStart(2, '0'), m[2]] : ['', '']
  }
  let totInps = 0
  inps.forEach((r, i) => {
    const y = 485.4 - 11.9 * i
    const [dalM, dalA] = meseAnno(r.periodoDal)
    const [alM, alA] = meseAnno(r.periodoAl)
    scrivi(r.codiceSede, 26.6, y, 8)
    scrivi(r.causale, 64.5, y, 8)
    scrivi(r.codeline, 105.2, y, 8)
    scrivi(dalM, 302.9, y, 8)
    scrivi(dalA, 329.5, y, 8)
    scrivi(alM, 378.6, y, 8)
    scrivi(alA, 405.3, y, 8)
    scrivi(fmtImporto(r.importo), 470, y, 8)
    totInps += r.importo
  })
  if (totInps > 0) {
    // Totale "E" sezione INPS: importi a debito (sotto le righe).
    scrivi(fmtImporto(totInps), 470, 420, 8)
  }

  // ── Saldo finale della delega ──
  scrivi(fmtImporto(totErario + totInps), 486, 125, 9)
}
