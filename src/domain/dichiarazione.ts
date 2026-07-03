import type { CalcoloInput, DatiAnno, RisultatoCalcolo, TipoVersamento } from '@/domain/types'
import { datiAnno as datiFiscaliAnno, contributoFissoAnno } from '@/data/taxData'
import type { AnagraficaContribuente } from '@/data/anagraficaStorage'
import { generaCodeline } from '@/domain/codelineInps'

/**
 * Righi della dichiarazione Redditi PF — quadro LM (regime forfettario,
 * sezione II), quadro RS (contributi previdenziali dedotti) e quadro RR
 * (contributi INPS: sezione I artigiani/commercianti, sezione II gestione
 * separata), ricostruiti dai controlli ufficiali dell'Agenzia delle Entrate
 * (ControlliRPF, QuadroLM/QuadroRS) e dalle istruzioni INPS per il quadro RR.
 * I codici colonna corrispondono a quelli del modello.
 *
 * Semplificazione consapevole: l'app non gestisce CPB, perdite pregresse,
 * crediti esteri, aiuti di Stato né i crediti contributivi pregressi del
 * quadro RR (col. 15, 19–22, 31–36), quindi quei campi sono assenti o a zero;
 * il documento prodotto è un PROMEMORIA di compilazione, non sostituisce la
 * dichiarazione.
 */

/** Un valore da riportare in un campo del modello. */
export interface CampoDichiarazione {
  /** Rigo leggibile, es. "LM34" o "RS — Contributi". */
  rigo: string
  /** Colonna del modello (1-based) quando rilevante. */
  colonna?: number
  /** Etichetta descrittiva del campo. */
  descrizione: string
  /** Valore in euro (arrotondato all'unità come da modello) o testo. */
  valore: number | string
  /** Nota esplicativa (formula, origine del dato). */
  nota?: string
}

/** Un rigo LM relativo a una singola attività (modulo). */
interface ModuloLM {
  /** Indice del modulo (1-based), uno per attività/regime forfettario. */
  modulo: number
  /** Codice ATECO se noto (l'app non lo memorizza: resta da inserire). */
  ateco?: string
  campi: CampoDichiarazione[]
}

/** Blocco della sezione I del quadro RR per una gestione artigiani/commercianti. */
export interface SezioneRRGestione {
  /** Rigo del modello che ospita la posizione (RR2 la prima, RR3 la seconda). */
  rigo: string
  gestione: 'artigiani' | 'commercianti'
  campi: CampoDichiarazione[]
}

export interface RighiDichiarazione {
  anno: number
  /** Un modulo LM per ogni regime forfettario (artigiani/commercianti/separata). */
  moduliLM: ModuloLM[]
  /** Righi LM di riepilogo (somma su tutti i moduli) e liquidazione imposta. */
  riepilogoLM: CampoDichiarazione[]
  /** Riepilogo deduzione contributi: LM35 (dedotti) + eventuale RP26 cod. 76. */
  quadroRS: CampoDichiarazione[]
  /** Quadro RR sezione I: un blocco per gestione artigiani/commercianti attiva. */
  quadroRRArtComm: SezioneRRGestione[]
  /** Quadro RR sezione II (gestione separata); vuoto se non pertinente. */
  quadroRRSeparata: CampoDichiarazione[]
  /** Vero se manca qualche dato che l'utente deve completare a mano. */
  haCampiDaCompletare: boolean
}

/** Arrotonda all'unità di euro, come richiesto dal modello dichiarativo. */
const eu = (n: number): number => Math.round(n)

/**
 * Somma i versamenti dei tipi indicati dalla lista di dettaglio di un anno.
 * Restituisce null se l'anno non è in modalità 'dettaglio' (o non esiste):
 * dalla cifra unica non si ricava lo spacco minimale/eccedenza del quadro RR.
 */
function versatiDaDettaglio(dati: DatiAnno | undefined, tipi: TipoVersamento[]): number | null {
  if (!dati || dati.modalitaContributi !== 'dettaglio') return null
  return dati.contributiVersati
    .filter((r) => tipi.includes(r.tipo))
    .reduce((s, r) => s + (r.importo ?? 0), 0)
}

/**
 * Costruisce i righi della dichiarazione dai risultati del calcolo.
 * I contributi dedotti (LM35 / RS) sono quelli effettivamente versati nell'anno
 * d'imposta, già usati dal motore per la deducibilità. L'input serve al quadro
 * RR, che ragiona per competenza: i versamenti riferiti all'anno d'imposta
 * includono la 4ª rata fissa e il saldo eccedenza pagati nell'anno successivo.
 */
export function generaRighiDichiarazione(
  calcoli: RisultatoCalcolo,
  anno: number,
  input: CalcoloInput,
  anagrafica?: AnagraficaContribuente,
): RighiDichiarazione {
  const regimi = calcoli.dettagliRegimiCalcolati
  const contributiDedotti = calcoli.contributiVersatiAnnoImpostaPerDeducibilita

  // ── Un modulo LM per ogni regime ────────────────────────────────────────
  const moduliLM: ModuloLM[] = regimi.map((regime, i) => {
    const redditoLordo = regime.imponibileLordoRegime
    return {
      modulo: i + 1,
      campi: [
        {
          rigo: 'LM22',
          colonna: 1,
          descrizione: 'Codice attività (ATECO 2007)',
          valore: 'da inserire',
          nota: 'Qui va il codice della vecchia classificazione ATECO 2007: i coefficienti di redditività restano agganciati a quella finché non vengono approvati i nuovi (art. 1 D.Lgs. 81/2025). Il codice ATECO 2025 va invece in LM21 col. 4.',
        },
        {
          rigo: 'LM22',
          colonna: 2,
          descrizione: 'Coefficiente di redditività',
          valore: `${regime.coefficiente}%`,
          nota: 'Determinato dal codice ATECO.',
        },
        {
          rigo: 'LM22',
          colonna: 3,
          descrizione: 'Componenti positivi (fatturato/compensi)',
          valore: eu(regime.fatturato),
          nota: 'Totale incassato nell\'anno per questa attività.',
        },
        {
          rigo: 'LM22',
          colonna: 5,
          descrizione: 'Reddito (fatturato × coefficiente)',
          valore: eu(redditoLordo),
          nota: `${eu(regime.fatturato)} × ${regime.coefficiente}%`,
        },
        {
          rigo: 'LM22',
          colonna: 6,
          descrizione: 'Lavoro autonomo o impresa',
          valore: regime.tipo === 'separata' ? '2 (lavoro autonomo)' : '1 (impresa)',
          nota: '1 = reddito d\'impresa (artigiani/commercianti), 2 = lavoro autonomo (professionisti in gestione separata). Da qui i controlli ricavano il reddito d\'impresa per la colonna 3 del quadro RR.',
        },
        {
          rigo: 'LM21',
          colonna: 1,
          descrizione: 'Sussistenza requisiti di accesso al regime',
          valore: 'sì (da barrare)',
          nota: 'Attesta i requisiti di accesso e l\'assenza di cause di cessazione (art. 1, commi 54 e 71, L. 190/2014): va sempre barrata per applicare il forfettario.',
        },
        {
          rigo: 'LM21',
          colonna: 4,
          descrizione: 'Codice ATECO 2025',
          valore: 'da inserire',
          nota: 'Codice dell\'attività nella nuova classificazione ATECO 2025, in vigore dal 2025 (tabella sul sito AdE). Da non confondere con LM22 col. 1, che resta in ATECO 2007.',
        },
        {
          rigo: 'LM21',
          colonna: 3,
          descrizione: 'Regime start-up (aliquota 5%)',
          valore: regime.aliquota === 5 ? '1 (sì)' : '0 (no)',
          nota: regime.aliquota === 5 ? 'Imposta sostitutiva ridotta al 5%.' : 'Imposta sostitutiva ordinaria 15%.',
        },
      ],
    }
  })

  // ── Riepilogo LM (somma su tutti i moduli) e liquidazione ───────────────
  const redditoLordoTotale = regimi.reduce((s, r) => s + r.imponibileLordoRegime, 0)
  const redditoNetto = Math.max(0, redditoLordoTotale - contributiDedotti)
  const imposta = calcoli.totaleImposte
  const accontiVersati = calcoli.accontiImposteEffettivamenteVersatiPerAnnoCorrente
  const saldoDebito = calcoli.saldoImposteDaVersareAnnoCorrente
  const saldoCredito = calcoli.creditoImposteAnnoCorrente

  // Contributi dedotti effettivamente: non possono superare il reddito lordo (LM35 ≤ LM34)
  const contributiDeducibiliEffettivi = Math.min(contributiDedotti, redditoLordoTotale)

  const riepilogoLM: CampoDichiarazione[] = [
    {
      rigo: 'LM34',
      colonna: 3,
      descrizione: 'Reddito lordo (somma dei redditi dei moduli)',
      valore: eu(redditoLordoTotale),
      nota: 'Somma dei righi LM22 col. 5 di tutte le attività.',
    },
    {
      rigo: 'LM35',
      colonna: 1,
      descrizione: 'Contributi previdenziali e assistenziali versati',
      valore: eu(contributiDedotti),
      nota: 'Contributi INPS pagati nell\'anno (deducibili). Vedi anche quadro RS.',
    },
    {
      rigo: 'LM36',
      colonna: 1,
      descrizione: 'Reddito netto (LM34 - LM35)',
      valore: eu(redditoNetto),
      nota: contributiDedotti > redditoLordoTotale
        ? `Contributi dedotti limitati a ${eu(redditoLordoTotale)} (non superano il reddito lordo); l'eccedenza ${eu(contributiDedotti - redditoLordoTotale)} va nel quadro RS.`
        : `${eu(redditoLordoTotale)} - ${eu(contributiDeducibiliEffettivi)}`,
    },
    {
      rigo: 'LM38',
      colonna: 1,
      descrizione: 'Reddito imponibile (al netto delle perdite)',
      valore: eu(redditoNetto),
      nota: 'L\'app non gestisce perdite pregresse: coincide con LM36.',
    },
    {
      rigo: 'LM39',
      colonna: 2,
      descrizione: 'Imposta sostitutiva',
      valore: eu(imposta),
      nota: 'Imposta sostitutiva dovuta sul reddito imponibile.',
    },
    {
      rigo: 'LM42',
      colonna: 1,
      descrizione: 'Totale imposta sostitutiva',
      valore: eu(imposta),
      nota: 'Coincide con LM39 in assenza di altri redditi LM.',
    },
    {
      rigo: 'LM44',
      colonna: 1,
      descrizione: 'Acconti versati',
      valore: eu(accontiVersati),
      nota: '1° + 2° acconto imposta sostitutiva versati per l\'anno.',
    },
    {
      rigo: 'LM46',
      colonna: 1,
      descrizione: 'Imposta a debito (saldo)',
      valore: eu(saldoDebito),
      nota: 'LM42 - acconti, se positivo. Da versare a saldo.',
    },
    {
      rigo: 'LM47',
      colonna: 1,
      descrizione: 'Imposta a credito',
      valore: eu(saldoCredito),
      nota: 'Acconti - LM42, se positivo. A credito.',
    },
  ]

  // ── Contributi previdenziali: riepilogo della deduzione ──────────────────
  // La parte di contributi versati che supera il reddito del forfettario non
  // entra in LM35 (deduzione limitata a LM34): non si perde, si può dedurre dal
  // reddito complessivo nel quadro RP, rigo RP26, codice onere 76 — solo se si
  // hanno altri redditi IRPEF. NB: questo NON è il caso dei contributi versati
  // in più del dovuto (es. acconti sul minimale poi ridotti al 35%), che sono
  // un credito INPS gestito nel cassetto previdenziale, fuori dalla dichiarazione.
  const contributiSenzaCapienza = Math.max(0, contributiDedotti - redditoLordoTotale)
  const quadroRS: CampoDichiarazione[] = [
    {
      rigo: 'LM35',
      colonna: 1,
      descrizione: 'Contributi previdenziali versati e dedotti',
      valore: eu(contributiDeducibiliEffettivi),
      nota: 'Contributi INPS versati nell\'anno, dedotti dal reddito forfettario (max = reddito lordo).',
    },
    {
      rigo: 'RP26',
      descrizione: 'Contributi senza capienza nel forfettario (cod. 76)',
      valore: eu(contributiSenzaCapienza),
      nota: contributiSenzaCapienza > 0
        ? 'La parte di contributi che supera il reddito forfettario va nel quadro RP rigo RP26 con codice onere 76, deducibile dal reddito complessivo se hai altri redditi IRPEF.'
        : 'Nessun contributo eccede il reddito: tutto dedotto in LM35.',
    },
    {
      rigo: 'RS375–382',
      descrizione: 'Obblighi informativi forfettari',
      valore: 'da compilare',
      nota: 'Compila gli elementi conoscitivi (RS375–RS381: mezzi di trasporto, costi carburante, telefonia, compensi a terzi…) se hai dati da comunicare; altrimenti barra la casella RS382 "assenza di dati". Uno dei due è obbligatorio.',
    },
  ]

  return {
    anno,
    moduliLM,
    riepilogoLM,
    quadroRS,
    quadroRRArtComm: generaQuadroRRArtComm(calcoli, anno, input, anagrafica),
    quadroRRSeparata: generaQuadroRRSeparata(calcoli, anno, input),
    haCampiDaCompletare: true, // l'ATECO è sempre da inserire
  }
}

// ---------------------------------------------------------------------------
// Quadro RR — sezione I (artigiani e commercianti)
// ---------------------------------------------------------------------------

/**
 * Sezione I del quadro RR: un blocco per gestione (artigiani, commercianti)
 * presente nell'anno. Il dovuto viene dal motore di calcolo (fissi sul
 * minimale + eccedenza); il versato dalla lista dettagliata dei versamenti,
 * per COMPETENZA: rate 1ª–3ª versate nell'anno + 4ª rata versata a febbraio
 * dell'anno dopo, acconti eccedenza versati nell'anno + saldo versato l'anno
 * dopo. I crediti del precedente anno (col. 20, 34) sono stimati con lo stesso
 * conto dovuto/versato sull'anno prima, assumendo nessun rimborso chiesto.
 * Compaiono solo i campi con un valore ricavabile: rimborsi e compensazioni
 * F24 (col. 18–19, 21–22, 32–33, 35–36) restano scelte dell'utente, indicate
 * nelle note dei crediti.
 */
/**
 * Codice della colonna 7 "tipo riduzione" (istruzioni Redditi PF 2026,
 * fascicolo 2, quadro RR): A = 50% pensionati ultrasessantacinquenni,
 * C = 35% forfettari, D = 35% forfettari con superamento dei 100.000 € in
 * corso d'anno, E = 50% nuovi iscritti 2025 (art. 1 c. 186 L. 207/2024).
 * La riduzione '50' dell'app non distingue A da E: resta da inserire (null).
 */
const CODICE_TIPO_RIDUZIONE: Record<'35' | '50', string | null> = {
  '35': 'C',
  '50': null,
}

function generaQuadroRRArtComm(
  calcoli: RisultatoCalcolo,
  anno: number,
  input: CalcoloInput,
  anagrafica?: AnagraficaContribuente,
): SezioneRRGestione[] {
  const gestioni = (['artigiani', 'commercianti'] as const).filter((g) =>
    calcoli.dettagliRegimiCalcolati.some((r) => r.tipo === g),
  )
  if (gestioni.length === 0) return []

  // Anno non nel database costanti (proiezione): niente promemoria RR.
  let minimaleReddito: number
  try {
    minimaleReddito = datiFiscaliAnno(anno).minimaleReddito
  } catch {
    return []
  }

  const datiN = input.anni[anno]
  const datiN1 = input.anni[anno + 1]
  // Con entrambe le gestioni nello stesso anno i versamenti tipizzati non
  // distinguono a quale posizione appartengono: si lascia all'utente.
  const piuGestioni = gestioni.length > 1

  return gestioni.map((gestione, idx) => {
    const rigo = `RR${2 + idx}`
    const periodi = calcoli.dettagliRegimiCalcolati.filter((r) => r.tipo === gestione)
    const mesi = periodi.reduce((s, r) => s + r.mesiRegime, 0)
    const meseDal = Math.min(...periodi.map((r) => r.meseInizio))
    const meseAl = Math.max(...periodi.map((r) => r.meseFine))
    const reddito = periodi.reduce((s, r) => s + r.imponibileLordoRegime, 0)

    const { maternitaMensile } = contributoFissoAnno(anno, gestione)
    const maternita = maternitaMensile * mesi
    const fissi = periodi.reduce((s, r) => s + r.contributiFissiRegime, 0)
    const ivsMinimale = fissi - maternita
    const minimaleProporz = (minimaleReddito * mesi) / 12
    // Eccedenza calcolata per periodo (minimale rapportato ai mesi di ciascuno),
    // come fa il motore, poi sommata sulla gestione.
    const redditoEccedente = periodi.reduce(
      (s, r) => s + Math.max(0, Math.round(r.imponibileLordoRegime) - (minimaleReddito * r.mesiRegime) / 12),
      0,
    )
    const eccedenzaDovuta = periodi.reduce((s, r) => s + r.contributiEccedenzaRegime, 0)
    const riduzione = periodi
      .map((r) => r.riduzioneContributi)
      .find((x): x is '35' | '50' => x !== 'nessuna')

    const notaVersatiMancanti = piuGestioni
      ? 'Anno con entrambe le gestioni: i versamenti inseriti non distinguono artigiani da commercianti, ripartiscili a mano.'
      : 'Ricavabile solo dalla lista dettagliata dei versamenti (non dalla cifra unica).'
    const rate123 = piuGestioni ? null : versatiDaDettaglio(datiN, ['fissi-1', 'fissi-2', 'fissi-3'])
    const versatiMinimale =
      rate123 === null ? null : rate123 + (versatiDaDettaglio(datiN1, ['fissi-4-prec']) ?? 0)
    const accontiEcc = piuGestioni ? null : versatiDaDettaglio(datiN, ['ecc-acconto-1', 'ecc-acconto-2'])
    const versatiEccedenza =
      accontiEcc === null ? null : accontiEcc + (versatiDaDettaglio(datiN1, ['ecc-saldo']) ?? 0)

    // Codice INPS della posizione (17 cifre): stessa struttura della codeline
    // F24 con rata 6 (a percentuale) e importo 0 — verificato su dato reale.
    const codiceInps = anagrafica && /^\d{8}$/.test(anagrafica.matricolaInps)
      ? generaCodeline({
          matricola: anagrafica.matricolaInps,
          anno,
          codiceSoggetto: anagrafica.codiceSoggettoInps,
          rata: 6,
          importoEuro: 0,
          sap: anagrafica.sedeInps || undefined,
        })
      : null

    // Crediti dell'anno precedente (col. 20 e 34): stesso conto dovuto/versato
    // fatto sull'anno prima, possibile se quell'anno aveva una sola gestione
    // Art/Comm e versamenti in modalità dettaglio.
    const datiNm1 = input.anni[anno - 1]
    const periodiPrec = calcoli.datiAnnoPrecedente.dettagliRegimiCalcolati.filter((r) => r.tipo === gestione)
    const gestioniPrec = new Set(
      calcoli.datiAnnoPrecedente.dettagliRegimiCalcolati.filter((r) => r.tipo !== 'separata').map((r) => r.tipo),
    )
    let creditoPrecMinimale = 0
    let creditoPrecEccedenza = 0
    if (gestioniPrec.size === 1 && gestioniPrec.has(gestione)) {
      const dovutoMinPrec = periodiPrec.reduce((s, r) => s + r.contributiFissiRegime, 0)
      const dovutoEccPrec = periodiPrec.reduce((s, r) => s + r.contributiEccedenzaRegime, 0)
      const rate123Prec = versatiDaDettaglio(datiNm1, ['fissi-1', 'fissi-2', 'fissi-3'])
      const versatiMinPrec =
        rate123Prec === null ? null : rate123Prec + (versatiDaDettaglio(datiN, ['fissi-4-prec']) ?? 0)
      const accontiEccPrec = versatiDaDettaglio(datiNm1, ['ecc-acconto-1', 'ecc-acconto-2'])
      const versatiEccPrec =
        accontiEccPrec === null ? null : accontiEccPrec + (versatiDaDettaglio(datiN, ['ecc-saldo']) ?? 0)
      if (versatiMinPrec !== null) creditoPrecMinimale = Math.max(0, eu(versatiMinPrec) - eu(dovutoMinPrec))
      if (versatiEccPrec !== null) creditoPrecEccedenza = Math.max(0, eu(versatiEccPrec) - eu(dovutoEccPrec))
    }

    const campi: CampoDichiarazione[] = []

    if (anagrafica?.matricolaInps) {
      campi.push({
        rigo: 'RR1',
        colonna: 1,
        descrizione: 'Codice azienda INPS',
        valore: `${anagrafica.matricolaInps} + 2 caratteri di controllo`,
        nota: 'Matricola azienda (8 cifre) seguita dai 2 caratteri di controllo alfabetici: dal cassetto previdenziale INPS.',
      })
    }
    if (anagrafica?.codiceSoggettoInps === '10') {
      campi.push({
        rigo,
        descrizione: 'Tipologia iscritto',
        valore: '1 (titolare)',
        nota: 'Dedotta dal codice soggetto INPS 10 in anagrafica.',
      })
    }
    if (anagrafica?.codiceFiscale) {
      campi.push({ rigo, colonna: 1, descrizione: 'Codice fiscale', valore: anagrafica.codiceFiscale })
    }
    if (codiceInps) {
      campi.push({
        rigo,
        colonna: 2,
        descrizione: 'Codice INPS',
        valore: codiceInps,
        nota: 'Ricostruito con l\'algoritmo ufficiale della codeline (circolare INPS 123/1998) da matricola, anno, soggetto e sede: confrontalo col dato del cassetto previdenziale.',
      })
    }

    campi.push(
      {
        rigo,
        colonna: 3,
        descrizione: 'Reddito d\'impresa',
        valore: eu(reddito),
        nota: 'Totale dei redditi d\'impresa dell\'anno: per i forfettari è il reddito del quadro LM (rigo LM34), da indicare anche se sotto il minimale. I controlli ufficiali lo ricavano dal quadro LM: compila prima quello, altrimenti il software si aspetta 0.',
      },
      {
        rigo,
        colonna: 4,
        descrizione: 'Periodo di imposizione contributiva (col. 4–5)',
        valore: `da ${meseDal} a ${meseAl}`,
        nota: 'Mesi di attività della gestione nell\'anno.',
      },
    )

    if (riduzione) {
      const codice = CODICE_TIPO_RIDUZIONE[riduzione]
      campi.push(
        {
          rigo,
          colonna: 7,
          descrizione: 'Tipo riduzione',
          valore: codice ?? 'da inserire',
          nota: codice
            ? `Codice della riduzione ${riduzione}% forfettari (art. 1 c. 77–84 L. 190/2014), dalle istruzioni ufficiali. Se in corso d'anno hai superato i 100.000 € di ricavi, il codice è D.`
            : `Riduzione ${riduzione}% attiva: indica A se sei pensionato ultrasessantacinquenne (art. 59 c. 15 L. 449/97) o E se nuovo iscritto (art. 1 c. 186 L. 207/2024) — vedi istruzioni dell'anno.`,
        },
        {
          rigo,
          colonna: 8,
          descrizione: 'Periodo riduzione (col. 8–9)',
          valore: `da ${meseDal} a ${meseAl}`,
          nota: 'Mesi in cui la riduzione è stata attiva.',
        },
      )
    }

    campi.push(
      {
        rigo,
        colonna: 10,
        descrizione: 'Reddito minimale',
        valore: eu(minimaleProporz),
        nota: mesi === 12
          ? `Minimale annuo ${eu(minimaleReddito)} (${anno}).`
          : `Minimale annuo ${eu(minimaleReddito)} rapportato a ${mesi} mesi.`,
      },
      {
        rigo,
        colonna: 11,
        descrizione: 'Contributi IVS dovuti sul reddito minimale',
        valore: eu(ivsMinimale),
        nota: `Quota IVS dei contributi fissi${riduzione ? ` con riduzione ${riduzione}%` : ''} (${mesi} mesi), esclusa maternità.`,
      },
      {
        rigo,
        colonna: 12,
        descrizione: 'Contributi maternità',
        valore: eu(maternita),
        nota: `${maternitaMensile.toFixed(2).replace('.', ',')} al mese × ${mesi} mesi (non riducibile).`,
      },
      {
        rigo,
        colonna: 14,
        descrizione: 'Contributi versati sul minimale',
        valore: versatiMinimale === null ? 'da inserire' : eu(versatiMinimale),
        nota: versatiMinimale === null
          ? notaVersatiMancanti
          : `Rate fisse 1ª–3ª versate nel ${anno} + 4ª rata versata a febbraio ${anno + 1} (dai versamenti inseriti in quell'anno).`,
      },
    )

    if (versatiMinimale !== null) {
      const diff = eu(ivsMinimale) + eu(maternita) - eu(versatiMinimale)
      campi.push(diff >= 0
        ? {
            rigo,
            colonna: 16,
            descrizione: 'Contributo a debito sul reddito minimale',
            valore: diff,
            nota: 'Formula ufficiale: col. 11 + 12 + 13 − 14 − 15 (qui 13 e 15 valgono zero). Da versare col saldo.',
          }
        : {
            rigo,
            colonna: 17,
            descrizione: 'Contributo a credito sul reddito minimale',
            valore: -diff,
            nota: 'Col. 14 − col. 11 − col. 12. Decidi tu la destinazione: rimborso (col. 18), compensazione in F24 (col. 19) o nulla per lasciarlo in autoconguaglio INPS.',
          })
    }

    if (creditoPrecMinimale > 0) {
      campi.push({
        rigo,
        colonna: 20,
        descrizione: 'Credito del precedente anno',
        valore: creditoPrecMinimale,
        nota: `Versato oltre il dovuto sulle rate fisse ${anno - 1} (dai tuoi versamenti). Ufficialmente la col. 20 riprende la col. 19 del quadro RR dell'anno scorso (credito destinato alla compensazione): verifica che coincida. Quanto già compensato in F24 va in col. 21, il residuo in col. 22.`,
      })
    }

    campi.push(
      {
        rigo,
        colonna: 24,
        descrizione: 'Reddito eccedente il minimale',
        valore: eu(redditoEccedente),
        nota: 'Reddito d\'impresa oltre il minimale (rapportato ai mesi di attività).',
      },
      {
        rigo,
        colonna: 25,
        descrizione: 'Contributo IVS dovuto sul reddito che eccede il minimale',
        valore: eu(eccedenzaDovuta),
        nota: `Aliquota della gestione sull'eccedenza${riduzione ? `, con riduzione ${riduzione}%` : ''} (seconda fascia +1% oltre soglia).`,
      },
      {
        rigo,
        colonna: 27,
        descrizione: 'Contributi versati sul reddito che eccede il minimale',
        valore: versatiEccedenza === null ? 'da inserire' : eu(versatiEccedenza),
        nota: versatiEccedenza === null
          ? notaVersatiMancanti
          : `Acconti eccedenza versati nel ${anno} + saldo versato nel ${anno + 1} (dai versamenti inseriti in quell'anno).`,
      },
    )

    if (versatiEccedenza !== null) {
      const diff = eu(eccedenzaDovuta) - eu(versatiEccedenza)
      campi.push(diff >= 0
        ? {
            rigo,
            colonna: 29,
            descrizione: 'Contributo a debito sul reddito che eccede il minimale',
            valore: diff,
            nota: 'Formula ufficiale: col. 25 + 26 − 27 − 28 (qui 26 e 28 valgono zero). Da versare col saldo. Attenzione: la col. 28 è per contributi compensati con crediti previdenziali senza F24, non per il debito.',
          }
        : {
            rigo,
            colonna: 30,
            descrizione: 'Contributo a credito sul reddito che eccede il minimale',
            valore: -diff,
            nota: 'Col. 27 − col. 25: acconti versati oltre il dovuto. Decidi tu la destinazione: rimborso (col. 32), compensazione in F24 (col. 33) o nulla per lasciarlo in autoconguaglio INPS.',
          })
    }

    if (creditoPrecEccedenza > 0) {
      campi.push({
        rigo,
        colonna: 34,
        descrizione: 'Credito del precedente anno',
        valore: creditoPrecEccedenza,
        nota: `Versato oltre il dovuto sull'eccedenza ${anno - 1} (acconti + saldo, dai tuoi versamenti). Ufficialmente la col. 34 riprende la col. 33 del quadro RR dell'anno scorso (credito destinato alla compensazione): verifica che coincida. Quanto già compensato in F24 va in col. 35, il residuo in col. 36.`,
      })
    }

    return { rigo, gestione, campi }
  })
}

// ---------------------------------------------------------------------------
// Quadro RR — sezione II (gestione separata)
// ---------------------------------------------------------------------------

/**
 * Sezione II del quadro RR per i periodi in gestione separata: reddito
 * imponibile, contributo dovuto, acconti versati e saldo a debito/credito.
 * I numeri di colonna variano tra le annualità del modello, quindi si indica
 * solo il rigo.
 */
function generaQuadroRRSeparata(
  calcoli: RisultatoCalcolo,
  anno: number,
  input: CalcoloInput,
): CampoDichiarazione[] {
  const periodi = calcoli.dettagliRegimiCalcolati.filter((r) => r.tipo === 'separata')
  const reddito = periodi.reduce((s, r) => s + r.imponibileLordoRegime, 0)
  if (periodi.length === 0 || reddito <= 0) return []

  const aliquota = periodi[0].aliquotaContributi
  const dovuto = calcoli.totaleContributiSeparata
  const acconti = versatiDaDettaglio(input.anni[anno], ['gs-acconto-1', 'gs-acconto-2'])

  const campi: CampoDichiarazione[] = [
    {
      rigo: 'RR5',
      descrizione: 'Reddito imponibile gestione separata',
      valore: eu(reddito),
      nota: 'Reddito forfettario lordo dei periodi in gestione separata (rigo LM34).',
    },
    {
      rigo: 'RR5',
      descrizione: 'Contributo dovuto',
      valore: eu(dovuto),
      nota: `${eu(reddito)} × ${aliquota}%.`,
    },
    {
      rigo: 'RR5',
      descrizione: 'Acconti versati',
      valore: acconti === null ? 'da inserire' : eu(acconti),
      nota: acconti === null
        ? 'Ricavabile solo dalla lista dettagliata dei versamenti (non dalla cifra unica).'
        : `Acconti G.S. versati nel ${anno} (giugno + novembre).`,
    },
  ]

  if (acconti !== null) {
    const diff = eu(dovuto) - eu(acconti)
    campi.push(diff >= 0
      ? {
          rigo: 'RR7',
          descrizione: 'Contributo a debito',
          valore: diff,
          nota: 'Contributo dovuto − acconti versati: da versare col saldo.',
        }
      : {
          rigo: 'RR8',
          descrizione: 'Contributo a credito',
          valore: -diff,
          nota: 'Acconti versati − contributo dovuto: a rimborso, in compensazione F24 o in autoconguaglio.',
        })
  }

  return campi
}

/** Vero se ci sono dati sufficienti per mostrare i righi (almeno un regime con fatturato). */
export function haDatiPerDichiarazione(calcoli: RisultatoCalcolo): boolean {
  return calcoli.dettagliRegimiCalcolati.some((r) => r.fatturato > 0)
}
