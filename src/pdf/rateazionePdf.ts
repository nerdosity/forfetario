import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import modelloF24Url from '@/assets/ModF24IMU2013.pdf'
import type { PianoRateazione, RataPiano } from '@/domain/rateazione'
import type { AnagraficaContribuente } from '@/data/anagraficaStorage'
import { formattaScadenza } from '@/domain/dates'
import { generaCodeline } from '@/domain/codelineInps'

/**
 * PDF del piano di rateazione: una pagina di riepilogo e una delega F24 in
 * FACSIMILE per ogni rata, disegnata sul modello ufficiale (ModF24IMU2013.pdf,
 * estratto dal software "Redditi PF" dell'Agenzia delle Entrate) con lo stesso
 * overlay del programma originale: Courier-Bold alle coordinate dei campi di
 * StruttureF24 e scritta FAC-SIMILE in filigrana.
 *
 * Per l'imposta sostitutiva compila la sezione erario (codici tributo 1792/1790
 * più 1668 per gli interessi); per i contributi la sezione INPS, con le causali
 * di rateazione (PXXR gestione separata, APR eccedenza artigiani/commercianti)
 * e gli interessi esposti a parte (DPPI / API).
 *
 * Restituisce un URL blob da aprire in una nuova scheda; da lì il visualizzatore
 * del browser permette di salvare o stampare.
 */

/** Tipo di versamento rateizzato, ricavato dalla chiave di rateazione. */
type TipoVersamentoImposta = 'saldo' | 'acconto1'

/** Gestione del versamento rateizzato: erario o contributi INPS. */
export type GestioneRateazione = 'imposta' | 'gs' | 'ecc'

export interface DatiPdfRateazione {
  /** Es. "Imposta sostitutiva · Saldo · competenza 2025". */
  intestazione: string
  gestione: GestioneRateazione
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

/** Causali INPS della quota (rateizzata o meno) e degli interessi, per gestione. */
const CAUSALI_INPS: Record<'gs' | 'ecc', { quota: string; quotaRateizzata: string; interessi: string }> = {
  gs: { quota: 'PXX', quotaRateizzata: 'PXXR', interessi: 'DPPI' },
  ecc: { quota: 'AP', quotaRateizzata: 'APR', interessi: 'API' },
}

const BLU = rgb(29 / 255, 78 / 255, 216 / 255)
const GRIGIO = rgb(71 / 255, 85 / 255, 105 / 255)
const NERO = rgb(0.1, 0.16, 0.23)
const GRIGIO_CHIARO = rgb(0.75, 0.75, 0.75)

const euro = (v: number): string =>
  `${new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)} euro`

/** Rende il testo compatibile con la codifica WinAnsi (vedi dichiarazionePdf). */
const pdfSafe = (t: string): string =>
  t.replace(/−/g, '-').replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')

/** Campo F24 "rateazione/regione/prov./mese rif.": NNRR (rata su totale). */
const campoRateazione = (numero: number, totale: number): string =>
  `${String(numero).padStart(2, '0')}${String(totale).padStart(2, '0')}`

// ── Formati di stampa del software ufficiale (Printer.formatta) ─────────────

/** Formato "IM": importo con virgola sostituita da spazio, allineato a destra su 15 caratteri. */
const fmtImporto = (importoEuro: number): string => {
  const cents = Math.round(importoEuro * 100)
  if (cents === 0) return ''
  const testo = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2 })
    .format(cents / 100)
    .replace(',', ' ')
  return ` ${testo.padStart(15)}`
}

/** Formato "AS": un carattere per casella (carattere + spazio). */
const fmtSpaziato = (valore: string): string => valore.split('').join(' ')

/** Formato "DT_NASC": otto cifre GGMMAAAA spaziate; testo non valido → com'è. */
const fmtDataNascita = (valore: string): string => {
  const cifre = valore.replace(/\D/g, '')
  return cifre.length === 8 ? fmtSpaziato(cifre) : valore
}

// ── Generazione ──────────────────────────────────────────────────────────────

export async function generaPdfRateazione(dati: DatiPdfRateazione): Promise<string> {
  const doc = await PDFDocument.create()
  doc.setTitle(`Rateazione ${dati.intestazione}`)
  const courier = await doc.embedFont(StandardFonts.CourierBold)
  const times = await doc.embedFont(StandardFonts.TimesRomanBold)
  const helv = await doc.embedFont(StandardFonts.Helvetica)
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold)

  disegnaRiepilogo(doc.addPage([595.28, 841.89]), dati, helv, helvBold)

  // Deleghe in facsimile sul modello ufficiale: una pagina per rata.
  const modello = await PDFDocument.load(await fetch(modelloF24Url).then((r) => r.arrayBuffer()))
  // Il software ufficiale usa la terza pagina del modello per la copia singola.
  const indicePagina = Math.min(2, modello.getPageCount() - 1)
  for (const rata of dati.piano.rate) {
    const [pagina] = await doc.copyPages(modello, [indicePagina])
    doc.addPage(pagina)
    disegnaDelega(pagina, rata, dati, courier, times)
  }

  const bytes = await doc.save()
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  return URL.createObjectURL(blob)
}

// ── Pagina di riepilogo ──────────────────────────────────────────────────────

function disegnaRiepilogo(
  pagina: PDFPage,
  { intestazione, gestione, tipoVersamento, annoScadenza, piano }: DatiPdfRateazione,
  helv: PDFFont,
  helvBold: PDFFont,
): void {
  const margine = 50
  const n = piano.opzioni.numeroRate
  let y = 780

  const testo = (t: string, x: number, size: number, font: PDFFont, color = NERO) =>
    pagina.drawText(pdfSafe(t), { x, y, size, font, color })
  const aDestra = (t: string, xFine: number, size: number, font: PDFFont) => {
    const s = pdfSafe(t)
    pagina.drawText(s, { x: xFine - font.widthOfTextAtSize(s, size), y, size, font, color: NERO })
  }

  testo('Piano di rateazione del versamento', margine, 16, helvBold, BLU)
  y -= 18
  testo(intestazione, margine, 10, helv, GRIGIO)
  y -= 24

  const opzioneTesto =
    piano.opzioni.inizio === 'giugno'
      ? `prima scadenza ordinaria (${formattaScadenza('06-30', annoScadenza)})`
      : `prima scadenza differita (${formattaScadenza('07-30', annoScadenza)}), maggiorazione 0,4%`
  const righe = [
    `Importo da rateizzare: ${euro(piano.importoOriginario)}`,
    ...(piano.maggiorazione > 0 ? [`Maggiorazione 0,4%: ${euro(piano.maggiorazione)}`] : []),
    `Opzione: ${n === 1 ? 'versamento unico' : `${n} rate`}, ${opzioneTesto}`,
    `Interessi di rateazione complessivi: ${euro(piano.totaleInteressi)}`,
    `Totale da versare: ${euro(piano.totale)}`,
  ]
  for (const r of righe) {
    testo(r, margine, 10, helv)
    y -= 15
  }
  y -= 12

  // Tabella del piano: intestazione, righe, totale.
  const X_RATA = margine
  const X_SCAD = 130
  const FINE_QUOTA = 330
  const FINE_INT = 440
  const FINE_TOT = 545

  testo('Rata', X_RATA, 9, helvBold)
  testo('Scadenza', X_SCAD, 9, helvBold)
  aDestra('Quota', FINE_QUOTA, 9, helvBold)
  aDestra('Interessi', FINE_INT, 9, helvBold)
  aDestra('Importo rata', FINE_TOT, 9, helvBold)
  y -= 5
  pagina.drawLine({ start: { x: margine, y }, end: { x: FINE_TOT, y }, thickness: 0.8, color: NERO })
  y -= 13

  for (const rata of piano.rate) {
    testo(n === 1 ? 'Unica' : `${rata.numero} di ${n}`, X_RATA, 10, helv)
    testo(formattaScadenza(rata.dataMMGG, annoScadenza), X_SCAD, 10, helv)
    aDestra(euro(rata.quota), FINE_QUOTA, 10, helv)
    aDestra(
      rata.interessi > 0
        ? `${euro(rata.interessi)} (${(rata.aliquotaInteressi * 100).toFixed(2).replace('.', ',')}%)`
        : '—',
      FINE_INT,
      10,
      helv,
    )
    aDestra(euro(rata.importo), FINE_TOT, 10, helvBold)
    y -= 4
    pagina.drawLine({ start: { x: margine, y }, end: { x: FINE_TOT, y }, thickness: 0.4, color: GRIGIO_CHIARO })
    y -= 12
  }
  testo('Totale', X_RATA, 10, helvBold)
  aDestra(euro(piano.importoOriginario + piano.maggiorazione), FINE_QUOTA, 10, helvBold)
  aDestra(euro(piano.totaleInteressi), FINE_INT, 10, helvBold)
  aDestra(euro(piano.totale), FINE_TOT, 10, helvBold)
  y -= 30

  const righeCodici =
    gestione === 'imposta'
      ? (() => {
          const tributo = CODICE_TRIBUTO[tipoVersamento]
          return [
            `Codici tributo: ${tributo.codice} (${tributo.descrizione.toLowerCase()}); ${CODICE_INTERESSI} (interessi pagamento`,
            'dilazionato imposte erariali), esposti in delega solo quando superano 1,03 euro per rata.',
          ]
        })()
      : (() => {
          const c = CAUSALI_INPS[gestione]
          const etichetta =
            gestione === 'gs'
              ? 'contributi gestione separata professionisti'
              : 'contributi eccedenti il minimale artigiani/commercianti'
          return [
            `Causali INPS: ${n > 1 ? c.quotaRateizzata : c.quota} (${etichetta}${n > 1 ? ', rateizzazione' : ''});`,
            `${c.interessi} (interessi di rateazione), esposti in delega solo quando superano 1,03 euro per rata.`,
          ]
        })()
  const note = [
    ...righeCodici,
    'Le pagine seguenti riportano una delega F24 in facsimile per ogni rata, compilata come dal software',
    'ufficiale. Le date sono nominali: se festive slittano al primo giorno lavorativo utile.',
    'Documento di supporto alla compilazione: non utilizzabile per il versamento.',
  ]
  for (const r of note) {
    testo(r, margine, 8.5, helv, GRIGIO)
    y -= 12
  }
}

// ── Delega F24 in facsimile ──────────────────────────────────────────────────

/**
 * Coordinate dei campi (StruttureF24, record M e V1): valori printX/printY del
 * software ufficiale, origine in basso a sinistra come nello standard PDF.
 */
function disegnaDelega(
  pagina: PDFPage,
  rata: RataPiano,
  { piano, gestione, tipoVersamento, annoCompetenza, annoScadenza, anagrafica }: DatiPdfRateazione,
  courier: PDFFont,
  times: PDFFont,
): void {
  const n = piano.opzioni.numeroRate
  const scrivi = (testo: string, x: number, y: number, size: number) => {
    if (testo.trim().length === 0) return
    pagina.drawText(pdfSafe(testo), { x, y, size, font: courier, color: NERO })
  }

  // Filigrana FAC-SIMILE (come il software ufficiale per i modelli non controllati).
  pagina.drawText('FAC-SIMILE', { x: 185, y: 60, size: 40, font: times, color: GRIGIO_CHIARO })

  // Nota di scadenza in testa (campo DT_VERSAMENTO, formato "NOTA").
  const dataVersamento = formattaScadenza(rata.dataMMGG, annoScadenza)
  scrivi(`Scadenza del ${dataVersamento}`, 250, 810, 10)
  scrivi(n === 1 ? 'Versamento in unica soluzione' : `Rata ${rata.numero} di ${n}`, 250, 798, 10)

  // Contribuente (record M).
  scrivi(fmtSpaziato(anagrafica.codiceFiscale), 117, 724, 12)
  scrivi(anagrafica.cognome.toUpperCase(), 117, 701, 12)
  scrivi(anagrafica.nome.toUpperCase(), 420, 701, 12)
  scrivi(fmtDataNascita(anagrafica.dataNascita), 117, 677, 12)
  scrivi(anagrafica.sesso, 245, 677, 12)
  scrivi(anagrafica.comuneNascita.toUpperCase(), 272, 677, 12)
  scrivi(fmtSpaziato(anagrafica.provinciaNascita), 542, 677, 12)

  if (gestione === 'imposta') {
    // Sezione erario (record A, modello IMU 2013): riga i alle Y 593, 581, … (passo 12).
    const tributo = CODICE_TRIBUTO[tipoVersamento]
    const righe: { codice: string; rateazione: string; importo: number }[] = [
      { codice: tributo.codice, rateazione: campoRateazione(rata.numero, n), importo: rata.quota },
    ]
    if (rata.interessi > 0) {
      righe.push({ codice: CODICE_INTERESSI, rateazione: '', importo: rata.interessi })
    }
    righe.forEach((riga, i) => {
      const y = 593 - 12 * i
      scrivi(riga.codice, 175, y, 9)
      scrivi(riga.rateazione, 232, y, 9)
      scrivi(String(annoCompetenza), 282, y, 9)
      scrivi(fmtImporto(riga.importo), 313, y, 9)
    })

    // Totale A e saldo sezione (con segno).
    scrivi(fmtImporto(rata.importo), 313, 521, 9)
    scrivi(fmtImporto(rata.importo), 486, 521, 9)
    scrivi('+', 481, 521, 9)
  } else {
    // Sezione INPS (record I): riga i alle Y 485, 473, … (passo 12). Quota con
    // causale di rateazione, interessi a parte (DPPI/API). Periodo 01–12 della
    // competenza; per l'eccedenza la codeline è quella "a percentuale" (rata 6,
    // importo 0), calcolabile solo con matricola e codice soggetto validi.
    const c = CAUSALI_INPS[gestione]
    const codeline =
      gestione === 'ecc'
        ? generaCodeline({
            matricola: anagrafica.matricolaInps,
            anno: annoCompetenza,
            codiceSoggetto: anagrafica.codiceSoggettoInps,
            rata: 6,
            sap: anagrafica.sedeInps,
            importoEuro: 0,
          }) ?? ''
        : ''
    const righe: { causale: string; codeline: string; importo: number }[] = [
      { causale: n > 1 ? c.quotaRateizzata : c.quota, codeline, importo: rata.quota },
    ]
    if (rata.interessi > 0) {
      righe.push({ causale: c.interessi, codeline: '', importo: rata.interessi })
    }
    righe.forEach((riga, i) => {
      const y = 485 - 12 * i
      scrivi(anagrafica.sedeInps, 24, y, 9)
      scrivi(riga.causale, 60, y, 9)
      scrivi(riga.codeline, 95, y, 9)
      scrivi(`01 ${annoCompetenza}`, 223, y, 9)
      scrivi(`12 ${annoCompetenza}`, 274, y, 9)
      scrivi(fmtImporto(riga.importo), 313, y, 9)
    })

    // TOTALE C e SALDO (C-D) della sezione INPS.
    scrivi(fmtImporto(rata.importo), 313, 437, 9)
    scrivi(fmtImporto(rata.importo), 486, 437, 9)
  }

  // Saldo finale della delega.
  scrivi(fmtImporto(rata.importo), 486, 125, 9)
}
