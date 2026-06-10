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

/**
 * Prima scadenza scelta per il versamento delle imposte:
 * - 'giugno' → data ordinaria (30/06), fino a 7 rate
 * - 'luglio' → entro i 30 giorni successivi (30/07) con maggiorazione dello 0,4%, fino a 6 rate
 */
export type InizioRateazione = 'giugno' | 'luglio'

/** Scelta di rateazione per un versamento d'imposta (saldo o 1° acconto). */
export interface OpzioniRateazione {
  inizio: InizioRateazione
  /** Numero di rate richieste; 1 = versamento unico. */
  numeroRate: number
}

/** Una scadenza con data, importo e breakdown delle sue componenti. */
export interface Scadenza {
  data: string
  /** Testo completo dell'adempimento (usato come fallback e per accessibilità). */
  descrizione: string
  /**
   * Categoria dell'adempimento, evidenziata in grassetto nel calendario
   * (es. "Contributi fissi artigiani", "Imposta sostitutiva").
   */
  categoria?: string
  /** Dettaglio della voce, in testo normale (es. "1° acconto · anno 2026"). */
  voce?: string
  importo: number
  componenti: ComponenteScadenza[]
  /** Anno solare in cui cade la scadenza. */
  annoScadenza: number
  /**
   * Vero se data e importo sono una PROIEZIONE: l'anno di competenza non è
   * ancora nel database fiscale, quindi si stimano con le costanti dell'anno
   * corrente. Da aggiornare quando INPS pubblica i valori ufficiali.
   */
  stimata?: boolean
  /**
   * Voci di versamento che "saldano" questa scadenza. Una scadenza è considerata
   * pagata se per ciascun riferimento esiste un versamento corrispondente.
   * Le voci 'imposta-*' fanno riferimento ai campi acconti imposta (pannello a parte),
   * le altre alle righe tipizzate della lista contributi versati.
   */
  riferimenti?: RiferimentoScadenza[]
  /**
   * Presente solo sui versamenti d'imposta rateizzabili (saldo e 1° acconto).
   * È la chiave con cui la scelta di rateazione viene salvata in
   * CalcoloInput.rateazioniImposta (es. "saldo-2025", "acconto1-2026").
   */
  chiaveRateazione?: string
  /**
   * Sulle righe-rata generate da una rateazione: importo originario del
   * versamento (prima di maggiorazione e interessi), per riconfigurare il piano.
   */
  importoRateazioneBase?: number
}

/**
 * Identifica cosa "paga" una scadenza, per collegarla ai versamenti inseriti.
 * Allineato a TipoVersamento (contributi) + le tre voci imposta del pannello
 * dedicato (saldo, 1° acconto, 2° acconto): tre versamenti distinti, anche se
 * saldo e 1° acconto cadono lo stesso giorno.
 */
export type RiferimentoScadenza =
  | TipoVersamento
  | 'imposta-saldo'
  | 'imposta-acconto1'
  | 'imposta-acconto2'

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
  | 'gs-acconto-1'
  | 'gs-acconto-2'
  | 'fissi-1'
  | 'fissi-2'
  | 'fissi-3'
  | 'fissi-4-prec'
  | 'ecc-saldo'
  | 'ecc-acconto-1'
  | 'ecc-acconto-2'
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

  /** Imposta sostitutiva: saldo dell'anno precedente, versato a giugno. */
  impostaSaldoVersatoAnnoCorrente: number | null

  /** Imposta sostitutiva: 1° acconto per l'anno corrente, versato a giugno. */
  impostaAcconto1VersatoAnnoCorrente: number | null

  /** Imposta sostitutiva: 2° acconto per l'anno corrente, versato a novembre. */
  impostaAcconto2VersatoAnnoCorrente: number | null

  /** Acconti imposta sostitutiva versati PER l'anno precedente (giu + nov). */
  accontiImposteVersatiPerAnnoPrecedente: number | null

  /**
   * Scelte di rateazione dei versamenti d'imposta, per chiave (vedi
   * Scadenza.chiaveRateazione). Assente o {inizio:'giugno', numeroRate:1}
   * equivale al versamento unico ordinario.
   */
  rateazioniImposta: Record<string, OpzioniRateazione>

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
