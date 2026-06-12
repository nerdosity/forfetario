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
 * Coordinate sul modello A4 595×842 (origine in basso a sinistra). La sezione
 * erario riusa le coordinate del software ufficiale (record A, modello IMU
 * 2013). La sezione INPS è posizionata in proporzione alla struttura del modello.
 */
function disegnaModulo(
  pagina: PDFPage,
  { etichettaRata, scadenza, erario, inps, anagrafica }: ModuloF24,
  courier: PDFFont,
): void {
  const scrivi = (testo: string, x: number, y: number, size: number) => {
    if (!testo || testo.trim().length === 0) return
    pagina.drawText(testo, { x, y, size, font: courier, color: NERO })
  }
  // Scrive un testo centrato orizzontalmente sulla X-centro della casella.
  const alCentro = (testo: string, xCentro: number, y: number, size: number) => {
    if (!testo || testo.trim().length === 0) return
    const larghezza = courier.widthOfTextAtSize(testo, size)
    pagina.drawText(testo, { x: xCentro - larghezza / 2, y, size, font: courier, color: NERO })
  }

  // ── Info rata/scadenza accanto allo stemma (area calcolata dallo screen) ──
  if (etichettaRata) scrivi(etichettaRata.toUpperCase(), 144, 807, 10)
  if (scadenza) scrivi(`SCADENZA: ${scadenza}`, 144, 795, 9)

  // ── Contribuente (record M) ──
  scrivi(fmtSpaziato(anagrafica.codiceFiscale), 117, 724, 12)
  scrivi(anagrafica.cognome.toUpperCase(), 117, 701, 12)
  scrivi(anagrafica.nome.toUpperCase(), 420, 701, 12)
  scrivi(fmtDataNascita(anagrafica.dataNascita), 117, 677, 12)
  scrivi(anagrafica.sesso, 245, 677, 12)
  scrivi(anagrafica.comuneNascita.toUpperCase(), 272, 677, 12)
  scrivi(fmtSpaziato(anagrafica.provinciaNascita), 542, 677, 12)

  // Riferimenti condivisi dal layout ufficiale (sezione erario): font, passo
  // riga e colonne "importi a debito" / "saldo" sono incolonnati verticalmente
  // sul modello F24, quindi valgono identici per erario e INPS. Centrare l'INPS
  // significa riusare questi numeri, non rimisurarli a mano.
  const FONT = 9
  const PASSO = 12            // distanza verticale tra righe (erario: 593, 581, …)
  const X_IMPORTO = 313       // X di partenza dell'importo "a debito" (fmtImporto, a destra)
  const X_SALDO = 486         // X di partenza del SALDO di sezione

  // ── Sezione ERARIO (record A): prima riga Y 593, passo 12 ──
  let totErario = 0
  erario.forEach((r, i) => {
    const y = 593 - PASSO * i
    scrivi(r.codiceTributo, 175, y, FONT)
    scrivi(r.rateazione ?? '', 232, y, FONT)
    scrivi(String(r.annoRiferimento), 282, y, FONT)
    scrivi(fmtImporto(r.importo), X_IMPORTO, y, FONT)
    totErario += r.importo
  })
  if (totErario > 0) {
    scrivi(fmtImporto(totErario), X_IMPORTO, 521, FONT) // totale colonna debiti
    scrivi(fmtImporto(totErario), X_SALDO, 521, FONT)   // saldo sezione (a debito)
  }

  // ── Sezione INPS: campi propri (sede/causale/codeline/periodo) con X misurate
  // sul modello; importo e saldo riusano le colonne dell'erario. Periodo MM|AAAA. ──
  const meseAnno = (p: string): [string, string] => {
    const m = p.match(/(\d{1,2})\s*\/\s*(\d{4})/)
    return m ? [m[1].padStart(2, '0'), m[2]] : ['', '']
  }
  // Centri orizzontali (PDF) delle caselle del periodo MM | AAAA (centro px × 0.684).
  const CX_DAL_M = 227.8, CX_DAL_A = 249.7, CX_AL_M = 278.5, CX_AL_A = 301.1
  // Prima riga INPS allineata alla griglia dell'erario: stessa distanza dal saldo.
  // Saldo INPS (C-D) a px 585; prima riga dati a px ~511. Y prima riga ≈ 484.
  const Y_INPS_RIGA1 = 484
  const Y_INPS_SALDO = 427
  let totInps = 0
  inps.forEach((r, i) => {
    const y = Y_INPS_RIGA1 - PASSO * i
    const [dalM, dalA] = meseAnno(r.periodoDal)
    const [alM, alA] = meseAnno(r.periodoAl)
    scrivi(r.codiceSede, 26, y, FONT)
    scrivi(r.causale, 65, y, FONT)
    scrivi(r.codeline, 102.6, y, FONT)
    alCentro(dalM, CX_DAL_M, y, FONT)
    alCentro(dalA, CX_DAL_A, y, FONT)
    alCentro(alM, CX_AL_M, y, FONT)
    alCentro(alA, CX_AL_A, y, FONT)
    scrivi(fmtImporto(r.importo), X_IMPORTO, y, FONT) // stessa colonna dell'erario
    totInps += r.importo
  })
  if (totInps > 0) {
    // Totale "C" e SALDO (C-D): stesse colonne dell'erario. Nessun segno: l'F24
    // è sempre un versamento, il saldo è a debito (positivo).
    scrivi(fmtImporto(totInps), X_IMPORTO, Y_INPS_SALDO, FONT) // totale C (a debito)
    scrivi(fmtImporto(totInps), X_SALDO, Y_INPS_SALDO, FONT)   // SALDO (C-D)
  }

  // ── Saldo finale della delega ──
  scrivi(fmtImporto(totErario + totInps), 486, 125, 9)

  // ── Data del versamento (riquadro "DATA": giorno | mese | anno, in basso a
  // sinistra). Riquadro misurato su immagine 870×1234: origine px (36,1127),
  // dim 172×37 → caselle centrate, Y baseline ≈ 56. La scadenza arriva come
  // "GG MeseEsteso AAAA"; la spezziamo nelle tre caselle. ──
  const gma = scadenzaInCifre(scadenza)
  if (gma) {
    const [gg, mm, aaaa] = gma
    alCentro(gg, 39, 56, 9)    // giorno (centro px ~57)
    alCentro(mm, 67.7, 56, 9)  // mese (centro px ~99)
    alCentro(aaaa, 112, 56, 9) // anno (centro px ~164)
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
