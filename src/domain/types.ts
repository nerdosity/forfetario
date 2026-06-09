/** Tipi di gestione contributiva INPS supportati dal regime forfettario. */
export type TipoRegime = 'separata' | 'artigiani' | 'commercianti'

/** Aliquota dell'imposta sostitutiva: 5% (start-up) o 15% (a regime). */
export type Aliquota = 5 | 15

/**
 * Riduzione contributiva applicata solo all'IVS (non alla maternità).
 * - 'nessuna' → nessuna riduzione
 * - '35'      → riduzione del 35% (forfettari)
 * - '50'      → riduzione del 50% (altri casi previsti da legge)
 */
export type RiduzioneContributi = 'nessuna' | '35' | '50'

/**
 * Un periodo all'interno di un anno fiscale. Un anno può contenere più periodi
 * (es. passaggio da Gestione Separata ad Artigiani a metà anno). Le scadenze
 * delle rate contributi dipendono da meseInizio; i contributi fissi si calcolano
 * su base mensile (getMesiInPeriodo), non su base giornaliera.
 */
export interface Regime {
  id: string
  tipo: TipoRegime
  aliquota: Aliquota
  /** Coefficiente di redditività (%), dipende dal codice ATECO. */
  coefficiente: number
  meseInizio: number
  giornoInizio: number
  meseFine: number
  giornoFine: number
  /** Fatturato del periodo in euro. */
  fatturato: number
  /**
   * Riduzione applicata all'IVS (solo artigiani/commercianti).
   * La quota maternità non è riducibile.
   */
  riduzioneContributi: RiduzioneContributi
}

/** Componente di una scadenza fiscale (dettaglio della rata). */
export interface ComponenteScadenza {
  tipo: string
  importo: number
}

/** Una scadenza con data, importo e breakdown delle sue componenti. */
export interface Scadenza {
  data: string
  descrizione: string
  importo: number
  componenti: ComponenteScadenza[]
  /** Anno solare in cui cade la scadenza. */
  annoScadenza: number
}

/** Dettaglio dei calcoli restituito per un singolo regime/periodo. */
export interface DettaglioRegime extends Regime {
  giorniRegime: number
  mesiRegime: number
  imponibileLordoRegime: number
  contributiRegimeINPS: number
  contributiFissiRegime: number
  contributiEccedenzaRegime: number
  contributiVersatiQuotaParte: number
  imponibileNettoRegime: number
  imposteRegime: number
  aliquotaContributi: number
  dettaglioCalcoloContributi: string
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/**
 * Tipologia di un versamento di contributi, usata per suggerire un placeholder
 * sensato. Le voci riflettono il flusso di cassa reale dell'anno:
 * - G.S.: saldo (dell'anno precedente) e acconto (per l'anno corrente).
 * - Fissi Art/Comm: le 4 rate trimestrali. La 4ª di un anno si versa a febbraio
 *   dell'anno successivo, quindi nei versamenti dell'anno rientra la 4ª rata
 *   dell'anno PRECEDENTE.
 * - Eccedenza Art/Comm: saldo (anno precedente) e acconto (anno corrente).
 * - 'altro': voce libera con descrizione.
 */
export type TipoVersamento =
  | 'gs-saldo'
  | 'gs-acconto'
  | 'fissi-1'
  | 'fissi-2'
  | 'fissi-3'
  | 'fissi-4-prec'
  | 'ecc-saldo'
  | 'ecc-acconto'
  | 'altro'

/** Una singola voce di contributo versato durante l'anno. */
export interface VersamentoContributo {
  id: string
  tipo: TipoVersamento
  /** Descrizione libera (usata soprattutto per 'altro'). */
  descrizione: string
  importo: number | null
}

/** Tutti gli input che alimentano il motore di calcolo. */
export interface CalcoloInput {
  anno: number
  regimiCorrente: Regime[]
  regimiPrecedente: Regime[]

  /**
   * Cifra unica dei contributi INPS versati durante l'anno (modalità 'totale').
   * NON è il valore effettivo usato dal motore: quello dipende dalla modalità
   * selezionata (vedi `contributiVersatiEffettivi`). Conservato a parte così da
   * non perdere la cifra manuale quando si passa alla lista di dettaglio.
   */
  contributiVersatiDuranteAnno: number | null

  /** Modalità di inserimento dei contributi versati nell'anno corrente. */
  modalitaContributiVersati: 'totale' | 'dettaglio'

  /** Righe di dettaglio dei versamenti (usate quando la modalità è 'dettaglio'). */
  contributiVersatiDettaglio: VersamentoContributo[]

  /**
   * Contributi INPS versati DURANTE l'anno precedente (deducibili per il
   * calcolo dell'imposta sostitutiva dell'anno precedente, mostrata nel
   * riepilogo).
   */
  contributiVersatiDuranteAnnoPrecedente: number | null

  /** Acconti imposta sostitutiva versati PER l'anno corrente (giu + nov). */
  accontiImposteVersatiPerAnnoCorrente: number | null

  /** Acconti imposta sostitutiva versati PER l'anno precedente (giu + nov). */
  accontiImposteVersatiPerAnnoPrecedente: number | null

  // Gli acconti contributi (G.S. ed eccedenza Art/Comm) NON sono campi a sé:
  // si ricavano dalle righe 'gs-acconto' / 'ecc-acconto' di contributiVersatiDettaglio
  // (vedi accontoVersatoDaLista). Così non si inseriscono due volte.
}

// ---------------------------------------------------------------------------
// Risultato anno singolo (usato sia per l'anno corrente sia per il precedente)
// ---------------------------------------------------------------------------

export interface RisultatoAnno {
  dettagliRegimiCalcolati: DettaglioRegime[]
  totaleImponibileLordo: number
  totaleContributiINPS: number
  totaleContributiSeparata: number
  totaleContributiFissiArtComm: number
  totaleContributiEccedenzaArtComm: number
  totaleImposte: number
  totaleFatturato: number
  imponibileNettoTotalePerImposte: number
  /**
   * Importo dei contributi fissi per trimestre [1ª, 2ª, 3ª, 4ª], sommato su
   * tutti i regimi Art/Comm dell'anno. Per la 4ª rata il versamento materiale
   * cade a febbraio dell'anno successivo.
   */
  rateFisse: [number, number, number, number]
}

// ---------------------------------------------------------------------------
// Risultato completo
// ---------------------------------------------------------------------------

export interface RisultatoCalcolo extends RisultatoAnno {
  /** Calcoli dell'anno precedente (per il riepilogo e per gli acconti). */
  datiAnnoPrecedente: RisultatoAnno

  /** Contributi effettivamente usati per la deducibilità anno corrente. */
  contributiVersatiAnnoImpostaPerDeducibilita: number

  /** Acconti imposte effettivamente usati per il saldo anno corrente. */
  accontiImposteEffettivamenteVersatiPerAnnoCorrente: number

  /** Saldo imposte sostitutive anno corrente (dovuto a giugno anno+1). */
  saldoImposteDaVersareAnnoCorrente: number

  /** Eventuale credito imposte (acconti > dovuto). */
  creditoImposteAnnoCorrente: number

  /** Acconti G.S. effettivamente usati. */
  accontiGSVersatiPerAnnoRif: number

  /** Saldo G.S. anno corrente. */
  saldoContributiGSAnnoCorrente: number

  /** Acconti eccedenza Art/Comm effettivamente usati. */
  accontiEccArtCommVersatiPerAnnoRif: number

  /** Saldo eccedenza Art/Comm anno corrente. */
  saldoContributiEccArtCommAnnoCorrente: number

  /** Scadenze che cadono nell'anno di riferimento. */
  scadenzeAnnoCorrente: Scadenza[]

  /** Scadenze che cadono nell'anno successivo. */
  scadenzeAnnoSuccessivo: Scadenza[]
}
