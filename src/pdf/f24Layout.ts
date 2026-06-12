/**
 * Layout ufficiale del modello F24 — coordinate estratte dal software
 * dell'Agenzia delle Entrate (BQJAA000 / StruttureF24, classe StrField:
 * costruttore con printY, printX, printFontSize, printFormat).
 *
 * Il printer ADE (ITextF24Printer) usa iText con pagina A4 = 595×842 pt e
 * origine in basso a sinistra: lo STESSO sistema di pdf-lib, quindi le
 * coordinate si usano TALI E QUALI, senza conversioni.
 *
 * `showTextAligned(LEFT, valore, printX, printY)`: il testo è scritto a
 * sinistra a partire da printX; gli importi sono già pre-allineati a destra
 * nella stringa (vedi formatImporto). Niente misure a mano: per spostare un
 * campo si modifica qui la sua riga.
 */

/** Un campo stampabile: posizione (pt, origine in basso a sx), font, formato. */
export interface CampoF24 {
  /** X in punti PDF (= printX ADE). */
  x: number
  /** Y in punti PDF (= printY ADE). */
  y: number
  /** Corpo font. */
  size: number
  /** Larghezza casella (caratteri) per gli importi, dal tracciato ADE. */
  lunghezza?: number
}

const F = (x: number, y: number, size = 9, lunghezza?: number): CampoF24 => ({ x, y, size, lunghezza })

/**
 * Mappa dei campi usati dall'app. Chiavi parlanti; coordinate dal JAR ADE.
 * Le righe ripetute (erario/INPS) hanno passo 12 pt: la riga i si ottiene da
 * `rigaY(base, i)`. Qui teniamo la prima riga e i totali/saldi di sezione.
 */
export const F24 = {
  // ── Erario (record A): righe a Y 593, 581, … passo 12 ──
  erarioRiga1: {
    tributo: F(175, 593),
    rateazione: F(232, 593),
    anno: F(282, 593),
    debito: F(313, 593, 9, 15),
  },
  erarioTotali: {
    debito: F(313, 521, 9, 15),
    saldo: F(486, 521, 9, 15),
  },

  // ── INPS (sezione V record I): righe a Y 485, 473, 461, 449 passo 12 ──
  inpsRiga1: {
    sede: F(24, 485),
    causale: F(60, 485),
    codeline: F(95, 485),
    periodoDal: F(223, 485), // formato "MM AAAA" in un solo campo
    periodoAl: F(274, 485),
    debito: F(313, 485, 9, 15),
  },
  inpsTotali: {
    debito: F(313, 437, 9, 15), // TOTALE C
    saldo: F(486, 437, 9, 15),  // SALDO (C-D)
  },

  // ── Contribuente (record M): coordinate ufficiali ADE ──
  contribuente: {
    codiceFiscale: F(117, 724, 12),
    cognome: F(117, 701, 12),
    nome: F(420, 701, 12),
    dataNascita: F(117, 677, 12),
    sesso: F(245, 677, 12),
    comuneNascita: F(272, 677, 12),
    provinciaNascita: F(542, 677, 12),
    // Domicilio fiscale (non usato dall'app, mappato per completezza)
    domicilioComune: F(117, 653, 12),
    domicilioProvincia: F(333, 653, 12),
    domicilioIndirizzo: F(369, 654, 9),
    // Coobbligato / codice identificativo
    cfCoobbligato: F(190, 630, 12),
    codiceIdentificativo: F(540, 630, 12),
  },

  // ── Sezioni non usate dall'app, mappate dal JAR per completezza ──
  // (prima riga; righe successive a passo 12). Importi: formato IM, lunghezza 15.
  regioniRiga1: {
    codiceRegione: F(26, 401),
    tributo: F(175, 401),
    rateazione: F(232, 401),
    anno: F(282, 401),
    debito: F(313, 401, 9, 15),
    credito: F(399, 401, 9, 15),
  },
  regioniTotali: { debito: F(313, 353, 9, 15), saldo: F(486, 353, 9, 15) },
  imuRiga1: {
    codiceEnte: F(24, 317),
    flagRavvedimento: F(76, 317),
    flagImmobiliVariati: F(89, 317),
    flagAcconto: F(104, 317),
    flagSaldo: F(118, 317),
    numeroImmobili: F(129, 317),
    tributo: F(175, 317),
    rateazione: F(232, 317),
    anno: F(282, 317),
    debito: F(313, 317, 9, 15),
    credito: F(399, 317, 9, 15),
  },
  imuTotali: { debito: F(313, 269, 9, 15), saldo: F(486, 269, 9, 15) },
  inailRiga1: {
    codiceSede: F(105, 233),
    numeroPosizione: F(150, 233),
    codiceControllo: F(208, 233),
    numeroRiferimento: F(241, 233),
    causale: F(290, 233),
    debito: F(313, 233, 9, 15),
    credito: F(399, 233, 9, 15),
  },
  inailTotali: { debito: F(313, 197, 9, 15), saldo: F(486, 197, 9, 15) },
  altriEntiRiga1: {
    codiceEnte: F(23, 172),
    codiceSede: F(67, 172),
    causale: F(110, 172),
    codicePosizione: F(155, 172),
    periodoDal: F(222, 172),
    periodoAl: F(274, 172),
    debito: F(313, 172, 9, 15),
    credito: F(399, 172, 9, 15),
  },
  altriEntiTotali: { debito: F(313, 148, 9, 15), saldo: F(486, 148, 9, 15) },

  // ── Saldo finale e info testata ──
  saldoFinale: F(486, 125, 9, 15),
  // Etichetta rata + scadenza accanto allo stemma (non nel tracciato ADE: nostre).
  etichettaRata: F(144, 807, 10),
  scadenzaTesta: F(144, 795, 9),
  // Data versamento nel riquadro "DATA" (l'ADE non la stampa: misurata da noi).
  // Testo CENTRATO sulla X: l'anno (112) era già ben centrato → resta il
  // riferimento; giorno e mese spostati a destra per centrarli allo stesso modo.
  // Caselle grandi → font grande.
  dataGiorno: F(48, 54, 20),
  dataMese: F(76, 54, 20),
  dataAnno: F(112, 54, 20),
} as const

/** Passo verticale tra le righe ripetute (erario/INPS/regioni…). */
export const PASSO_RIGA = 12

/** Y della riga i-esima a partire dalla Y della prima riga. */
export const rigaY = (yPrimaRiga: number, i: number): number => yPrimaRiga - PASSO_RIGA * i
