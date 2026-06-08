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

/** Tutti gli input che alimentano il motore di calcolo. */
export interface CalcoloInput {
  anno: number
  regimiCorrente: Regime[]
  regimiPrecedente: Regime[]

  /**
   * Contributi INPS versati DURANTE l'anno di riferimento (deducibili per
   * il calcolo dell'imposta sostitutiva dell'anno corrente).
   */
  contributiVersatiDuranteAnno: number | null

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

  /** Acconti contributi Gestione Separata versati PER l'anno corrente. */
  accontiContributiSeparataVersatiPerAnnoCorrente: number | null

  /** Acconti contributi eccedenza Art/Comm versati PER l'anno corrente. */
  accontiContributiEccedenzaArtCommVersatiPerAnnoCorrente: number | null
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
