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
   * Presente solo sui versamenti rateizzabili: saldo e 1° acconto di imposta
   * sostitutiva, contributi Gestione separata e contributi eccedenza Art/Comm.
   * È la chiave con cui la scelta di rateazione viene salvata in
   * CalcoloInput.rateazioniImposta (es. "saldo-2025", "acconto1-2026",
   * "gs-saldo-2025", "ecc-acconto1-2026").
   */
  chiaveRateazione?: string
  /**
   * Sulle righe-rata generate da una rateazione: importo originario del
   * versamento (prima di maggiorazione e interessi), per riconfigurare il piano.
   */
  importoRateazioneBase?: number
  /**
   * Sulle righe-rata generate da una rateazione: data leggibile della scadenza
   * originaria (prima rata ordinaria), per ricostruire le date del piano.
   */
  dataRateazioneBase?: string
  /**
   * Sulle righe-rata generate da una rateazione (numeroRate > 1): numero
   * 1-based della rata, per collegarla al versamento corrispondente
   * (VersamentoContributo.numeroRata o impostaSaldoVersatoRate/
   * impostaAcconto1VersatoRate) in versatoPerScadenza.
   */
  numeroRata?: number
  /**
   * Importo "consigliato" da versare, diverso dal dovuto ufficiale: tiene conto
   * di un credito della stessa gestione INPS maturato l'anno prima (versamenti
   * netti in più del dovuto). Può essere negativo (credito > saldo). Presente
   * solo sui saldi contributi quando c'è un conguaglio da considerare.
   */
  importoConsigliato?: number
  /** Nota che spiega come si ottiene importoConsigliato. */
  notaConsigliato?: string
  /**
   * Nota metodologica sull'importo DOVUTO: dichiara su quale base è stato
   * calcolato quando non si è potuto seguire la regola ordinaria. Oggi la
   * imposta il fallback dei saldi contributi, quando mancano i dati dell'anno
   * precedente alla competenza e gli acconti dovuti col metodo INPS non sono
   * calcolabili: il saldo si netta allora con gli acconti realmente versati.
   * Diversa da notaConsigliato, che riguarda un importo alternativo da versare.
   */
  nota?: string
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
  /**
   * Se il versamento è deducibile in dichiarazione (default true). Va messo a
   * false per i contributi NON deducibili (es. volontari extra IVS). I contributi
   * obbligatori — anche se di competenza pregressa o ravvedimenti — restano
   * deducibili nell'anno di cassa. Non influisce sul conguaglio della gestione,
   * che dipende solo dal tipo.
   */
  deducibile?: boolean
  /**
   * Presente solo se `tipo` è stato rateizzato (vedi Scadenza.chiaveRateazione):
   * numero della rata (1-based) a cui questo versamento si riferisce. Righe
   * generate automaticamente da ContributiVersati quando la voce ha un piano di
   * rateazione attivo, una per rata. Non incide sulla somma per `tipo` (usata
   * ovunque come dovuto/deducibilità), serve solo a versatoPerScadenza per
   * confrontare la singola rata col relativo importo nel calendario.
   */
  numeroRata?: number
}

/**
 * Dati di UN anno solare. Tutto ciò che appartiene a quell'anno: i regimi di
 * competenza e i versamenti effettuati DURANTE quell'anno (contributi e imposte).
 * I versamenti restano legati all'anno solare in cui sono stati fatti, così
 * navigando tra gli anni i dati si "portano appresso" senza reinserirli.
 */
export interface DatiAnno {
  /** Regimi/periodi di competenza dell'anno. */
  regimi: Regime[]

  /** Modalità di inserimento dei contributi versati nell'anno. */
  modalitaContributi: 'totale' | 'dettaglio'

  /** Cifra unica contributi versati nell'anno (modalità 'totale'). */
  contributiVersatiTotale: number | null

  /** Righe di dettaglio dei contributi versati DURANTE l'anno (modalità 'dettaglio'). */
  contributiVersati: VersamentoContributo[]

  /** Imposta sostitutiva: saldo versato durante l'anno (saldo della competenza precedente). */
  impostaSaldoVersato: number | null

  /** Imposta sostitutiva: 1° acconto versato durante l'anno (giugno). */
  impostaAcconto1Versato: number | null

  /** Imposta sostitutiva: 2° acconto versato durante l'anno (novembre). */
  impostaAcconto2Versato: number | null

  /**
   * Presenti SOLO quando il rispettivo versamento (saldo o 1° acconto) è stato
   * rateizzato (vedi Scadenza.chiaveRateazione / CalcoloInput.rateazioniImposta):
   * un importo per rata (indice 0 = rata 1), al posto della cifra unica. Quando
   * l'array esiste sostituisce il campo scalare corrispondente ovunque serva il
   * totale versato (la somma dei suoi elementi non-null). Il 2° acconto non è
   * rateizzabile e non ha un equivalente.
   */
  impostaSaldoVersatoRate?: (number | null)[]
  impostaAcconto1VersatoRate?: (number | null)[]
}

/** DatiAnno vuoto (un solo regime vuoto, nessun versamento). */
export function datiAnnoVuoto(regimi: Regime[]): DatiAnno {
  return {
    regimi,
    modalitaContributi: 'totale',
    contributiVersatiTotale: null,
    contributiVersati: [],
    impostaSaldoVersato: null,
    impostaAcconto1Versato: null,
    impostaAcconto2Versato: null,
  }
}

/**
 * Tutti gli input che alimentano il motore di calcolo.
 *
 * Lo stato è organizzato PER ANNO SOLARE: `anni` è una mappa anno→dati. `anno` è
 * l'anno di riferimento selezionato. Il motore, dato l'anno N, legge `anni[N]`
 * (competenza) e `anni[N-1]` (per acconti/saldi); i versamenti che marcano le
 * scadenze dell'anno N+1 stanno in `anni[N+1]`. Così un pagamento si inserisce
 * una volta nell'anno solare giusto e vale in tutti i contesti.
 */
export interface CalcoloInput {
  /** Anno di riferimento selezionato. */
  anno: number

  /** Dati per anno solare: { 2024: {...}, 2025: {...}, 2026: {...} }. */
  anni: Record<number, DatiAnno>

  /**
   * Scelte di rateazione dei versamenti rateizzabili (imposte e contributi),
   * per chiave (vedi Scadenza.chiaveRateazione). Assente o
   * {inizio:'giugno', numeroRate:1} equivale al versamento unico ordinario.
   * Globale (non per anno). Il nome resta "Imposta" per compatibilità con i
   * dati già salvati in localStorage.
   */
  rateazioniImposta: Record<string, OpzioniRateazione>

  // Gli acconti contributi (G.S. ed eccedenza Art/Comm) NON sono campi a sé:
  // si ricavano dalle righe 'gs-acconto' / 'ecc-acconto' di DatiAnno.contributiVersati.
}

/** Restituisce i dati di un anno, o un DatiAnno vuoto se l'anno non è presente. */
export function datiDellAnno(input: CalcoloInput, anno: number): DatiAnno {
  return input.anni[anno] ?? datiAnnoVuoto([])
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

  /** Acconti G.S. DOVUTI (metodo INPS) usati per il saldo. */
  accontiGSVersatiPerAnnoRif: number

  /** Acconti G.S. effettivamente VERSATI dall'utente nell'anno (se inseriti). */
  accontiGSVersatiRealiPerAnnoRif: number

  /** Saldo G.S. anno corrente. */
  saldoContributiGSAnnoCorrente: number

  /** Acconti eccedenza Art/Comm DOVUTI (metodo INPS) usati per il saldo. */
  accontiEccArtCommVersatiPerAnnoRif: number

  /** Acconti eccedenza Art/Comm effettivamente VERSATI dall'utente (se inseriti). */
  accontiEccArtCommVersatiRealiPerAnnoRif: number

  /** Saldo eccedenza Art/Comm anno corrente. */
  saldoContributiEccArtCommAnnoCorrente: number

  /** Scadenze che cadono nell'anno di riferimento. */
  scadenzeAnnoCorrente: Scadenza[]

  /** Scadenze che cadono nell'anno successivo. */
  scadenzeAnnoSuccessivo: Scadenza[]
}
