import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import modelloF24Url from '@/assets/ModF24IMU2013.pdf'
import type { AnagraficaContribuente } from '@/data/anagraficaStorage'
import { F24, type CampoF24, rigaY } from './f24Layout'

/**
 * PDF del modello F24 per il versamento di contributi INPS e/o imposte.
 * Disegna sul modello ufficiale (ModF24IMU2013.pdf, A4 595×842) usando le
 * coordinate del software ADE (vedi f24Layout.ts): sezione ERARIO (imposte) e
 * sezione INPS (contributi/codeline), più contribuente, saldo e data.
 *
 * Documento di supporto: verifica importi e codeline sugli strumenti ufficiali
 * prima del versamento.
 */

const NERO = rgb(0.1, 0.16, 0.23)

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

// ── Formati di stampa (replica esatta di Printer.formatta dell'ADE) ─────────

/**
 * Importo (formato "IM"): euro con virgola → spazio, allineato a destra su
 * `lunghezza` caratteri + 1 spazio iniziale. Stringa vuota se 0. È il formato
 * che il printer ADE usa per importi a debito, totali e saldi.
 */
const formatImporto = (importoEuro: number, lunghezza = 15): string => {
  const cents = Math.round(importoEuro * 100)
  if (cents === 0) return ''
  const testo = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2 })
    .format(cents / 100)
    .replace(',', ' ')
  if (testo.length > lunghezza) return testo
  return ` ${testo.padStart(lunghezza)}`
}

/** Periodo (formato "MM AAAA"): da "MM/AAAA" a "MM AAAA". Vuoto se assente. */
const formatPeriodo = (p: string): string => {
  const m = p.match(/(\d{1,2})\s*\/\s*(\d{4})/)
  return m ? `${m[1].padStart(2, '0')} ${m[2]}` : ''
}

/** Un carattere per casella (carattere + spazio), come il formato "AS" ADE. */
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

  const modello = await PDFDocument.load(await fetch(modelloF24Url).then((r) => r.arrayBuffer()))
  const indicePagina = Math.min(2, modello.getPageCount() - 1)

  for (const m of moduli) {
    const [pagina] = await doc.copyPages(modello, [indicePagina])
    doc.addPage(pagina)
    disegnaModulo(pagina, m, courier)
  }

  const bytes = await doc.save()
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  return URL.createObjectURL(blob)
}

/**
 * Disegna un modulo usando la mappa di campi ufficiale (f24Layout). Ogni campo
 * sa dove va: `scrivi(testo, F24.<campo>)`. Niente coordinate sparse nel codice.
 */
function disegnaModulo(
  pagina: PDFPage,
  { etichettaRata, scadenza, erario, inps, anagrafica }: ModuloF24,
  courier: PDFFont,
): void {
  // Scrive un testo a un campo (allineato a sinistra a campo.x, come l'ADE).
  const scrivi = (testo: string, campo: CampoF24, yOverride?: number) => {
    if (!testo || testo.trim().length === 0) return
    pagina.drawText(testo, { x: campo.x, y: yOverride ?? campo.y, size: campo.size, font: courier, color: NERO })
  }
  // Scrive un testo centrato orizzontalmente sulla x del campo (per la data).
  const scriviCentrato = (testo: string, campo: CampoF24) => {
    if (!testo || testo.trim().length === 0) return
    const larghezza = courier.widthOfTextAtSize(testo, campo.size)
    pagina.drawText(testo, { x: campo.x - larghezza / 2, y: campo.y, size: campo.size, font: courier, color: NERO })
  }

  // ── Testata: etichetta rata + scadenza accanto allo stemma ──
  if (etichettaRata) scrivi(etichettaRata.toUpperCase(), F24.etichettaRata)
  if (scadenza) scrivi(`SCADENZA: ${scadenza}`, F24.scadenzaTesta)

  // ── Contribuente ──
  const c = F24.contribuente
  scrivi(fmtSpaziato(anagrafica.codiceFiscale), c.codiceFiscale)
  scrivi(anagrafica.cognome.toUpperCase(), c.cognome)
  scrivi(anagrafica.nome.toUpperCase(), c.nome)
  scrivi(fmtDataNascita(anagrafica.dataNascita), c.dataNascita)
  scrivi(anagrafica.sesso, c.sesso)
  scrivi(anagrafica.comuneNascita.toUpperCase(), c.comuneNascita)
  scrivi(fmtSpaziato(anagrafica.provinciaNascita), c.provinciaNascita)

  // ── Sezione ERARIO: prima riga + righe successive (passo 12) ──
  const e1 = F24.erarioRiga1
  let totErario = 0
  erario.forEach((r, i) => {
    scrivi(r.codiceTributo, { ...e1.tributo, y: rigaY(e1.tributo.y, i) })
    scrivi(r.rateazione ?? '', { ...e1.rateazione, y: rigaY(e1.rateazione.y, i) })
    scrivi(String(r.annoRiferimento), { ...e1.anno, y: rigaY(e1.anno.y, i) })
    scrivi(formatImporto(r.importo, e1.debito.lunghezza), { ...e1.debito, y: rigaY(e1.debito.y, i) })
    totErario += r.importo
  })
  if (totErario > 0) {
    scrivi(formatImporto(totErario, F24.erarioTotali.debito.lunghezza), F24.erarioTotali.debito)
    scrivi(formatImporto(totErario, F24.erarioTotali.saldo.lunghezza), F24.erarioTotali.saldo)
  }

  // ── Sezione INPS: prima riga + righe successive (passo 12) ──
  const i1 = F24.inpsRiga1
  let totInps = 0
  inps.forEach((r, i) => {
    scrivi(r.codiceSede, { ...i1.sede, y: rigaY(i1.sede.y, i) })
    scrivi(r.causale, { ...i1.causale, y: rigaY(i1.causale.y, i) })
    scrivi(r.codeline, { ...i1.codeline, y: rigaY(i1.codeline.y, i) })
    scrivi(formatPeriodo(r.periodoDal), { ...i1.periodoDal, y: rigaY(i1.periodoDal.y, i) })
    scrivi(formatPeriodo(r.periodoAl), { ...i1.periodoAl, y: rigaY(i1.periodoAl.y, i) })
    scrivi(formatImporto(r.importo, i1.debito.lunghezza), { ...i1.debito, y: rigaY(i1.debito.y, i) })
    totInps += r.importo
  })
  if (totInps > 0) {
    // TOTALE C e SALDO (C-D). Nessun segno: l'F24 è sempre un versamento a debito.
    scrivi(formatImporto(totInps, F24.inpsTotali.debito.lunghezza), F24.inpsTotali.debito)
    scrivi(formatImporto(totInps, F24.inpsTotali.saldo.lunghezza), F24.inpsTotali.saldo)
  }

  // ── Saldo finale della delega ──
  scrivi(formatImporto(totErario + totInps, F24.saldoFinale.lunghezza), F24.saldoFinale)

  // ── Data del versamento (riquadro "DATA": giorno | mese | anno, centrati) ──
  const gma = scadenzaInCifre(scadenza)
  if (gma) {
    const [gg, mm, aaaa] = gma
    scriviCentrato(gg, F24.dataGiorno)
    scriviCentrato(mm, F24.dataMese)
    scriviCentrato(aaaa, F24.dataAnno)
  }
}

/** Mesi estesi italiani → numero a 2 cifre, per il parsing della scadenza. */
const MESI_IT: Record<string, string> = {
  gennaio: '01', febbraio: '02', marzo: '03', aprile: '04', maggio: '05', giugno: '06',
  luglio: '07', agosto: '08', settembre: '09', ottobre: '10', novembre: '11', dicembre: '12',
}

/**
 * Estrae [giorno, mese, anno] (cifre) da una scadenza in formato "GG MeseEsteso
 * AAAA" (es. "30 Giugno 2025") o "GG/MM/AAAA". Null se non riconosciuta.
 */
function scadenzaInCifre(scadenza: string | undefined): [string, string, string] | null {
  if (!scadenza) return null
  const esteso = scadenza.trim().match(/^(\d{1,2})\s+([A-Za-zàèéìòù]+)\s+(\d{4})$/)
  if (esteso) {
    const mm = MESI_IT[esteso[2].toLowerCase()]
    if (mm) return [esteso[1].padStart(2, '0'), mm, esteso[3]]
  }
  const numerico = scadenza.trim().match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
  if (numerico) return [numerico[1].padStart(2, '0'), numerico[2].padStart(2, '0'), numerico[3]]
  return null
}
