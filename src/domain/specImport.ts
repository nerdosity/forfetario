/**
 * Specifica del formato JSON di importazione, pensata per essere data a un
 * assistente AI insieme ai documenti dell'utente (dichiarazione, F24, movimenti
 * bancari). Il formato coincide con quello esportato dall'app e letto da
 * `normalizzaInput`: l'esempio è verificato da un test, così non può divergere.
 */

export const SPEC_IMPORT = `# Formato JSON per l'importazione dei dati

Il file è un oggetto JSON con questi campi di primo livello.

- anno (intero): anno di riferimento selezionato, ad esempio 2025.
- anni (oggetto): mappa "anno solare" -> dati di quell'anno. Le chiavi sono gli anni come stringhe ("2024", "2025"). Ogni anno contiene i regimi di competenza di quell'anno e i versamenti effettuati DURANTE quell'anno solare (principio di cassa).
- rateazioniImposta (oggetto): scelte di rateazione, per chiave. Chiavi possibili: "saldo-AAAA", "acconto1-AAAA" (imposta), "gs-saldo-AAAA", "gs-acconto1-AAAA", "ecc-saldo-AAAA", "ecc-acconto1-AAAA" (contributi), con AAAA anno di competenza. Valore: { "inizio": "giugno" | "luglio", "numeroRate": intero >= 2 }. Se non ci sono rateazioni usare {}.
- inizioAttivita (stringa | null): data di apertura della partita IVA in formato "AAAA-MM-GG". null se non nota.

## Dati di un anno (valore di ogni chiave di "anni")

- regimi (array): uno o più periodi dell'anno. Un anno può cambiare gestione a metà anno (ad esempio separata fino a giugno, poi artigiani).
- modalitaContributi ("totale" | "dettaglio"): "totale" se si conosce solo la cifra complessiva dei contributi versati nell'anno, "dettaglio" se si elencano i singoli versamenti. Preferire "dettaglio" quando i documenti lo consentono.
- contributiVersatiTotale (numero | null): usato solo con modalitaContributi "totale". Contributi versati nell'anno, in euro.
- contributiVersati (array): usato solo con modalitaContributi "dettaglio". Elenco dei versamenti di contributi fatti nell'anno (vedi sotto).
- impostaSaldoVersato (numero | null): imposta sostitutiva, saldo versato nell'anno (riferito all'anno precedente), in euro.
- impostaAcconto1Versato (numero | null): imposta sostitutiva, 1° acconto versato nell'anno (giugno/luglio).
- impostaAcconto2Versato (numero | null): imposta sostitutiva, 2° acconto versato nell'anno (novembre).
- impostaSaldoVersatoRate, impostaAcconto1VersatoRate (array di numeri | null, facoltativi): solo se saldo o 1° acconto sono stati rateizzati; un importo per rata, nell'ordine. Sostituiscono il campo scalare corrispondente.

Tutti gli importi sono numeri in euro con il punto decimale (1234.56), senza simbolo e senza separatore delle migliaia. Se un dato non risulta dai documenti usare null.

## Regime (elemento di "regimi")

- tipo: "separata" | "artigiani" | "commercianti" | "enpap" | "spettacolo".
  - separata: Gestione separata INPS, percentuale sul reddito, versamenti automatici.
  - artigiani: gestione INPS artigiani, contributi fissi trimestrali più contributi sull'eccedenza del minimale.
  - commercianti: come artigiani, gestione commercianti.
  - enpap: ENPAP (psicologi), cassa professionale.
  - spettacolo: lavoratori dello spettacolo, contributo FPLS trattenuto in fattura dal committente.
- aliquota: 5 | 15. Aliquota dell'imposta sostitutiva: 5 per i primi cinque anni di attività (start-up), 15 a regime.
- coefficiente (numero): coefficiente di redditività in percentuale, legato al codice ATECO (ad esempio 78, 67, 86).
- meseInizio, giornoInizio (interi): data di inizio del periodo (mese 1-12, giorno 1-31). Per un anno intero 1 e 1.
- meseFine, giornoFine (interi): data di fine del periodo. Per un anno intero 12 e 31.
- fatturato (numero, euro): compensi INCASSATI nel periodo, per cassa (non fatturati): conta la data di incasso, non quella della fattura.
- riduzioneContributi: "nessuna" | "35" | "50". Riduzione dell'IVS per artigiani/commercianti (35 = riduzione del 35% per i forfettari, 50 = riduzione del 50% per i primi 36 mesi). Negli altri tipi usare "nessuna".
- Solo per tipo "enpap":
  - aliquotaSoggettivoEnpap: intero pari da 10 a 30 (10, 12, ..., 30), aliquota del contributo soggettivo. Default 10.
  - riduzioneMinimoEnpap: "nessuna" | "meta" | "terzo" | "quinto", riduzione del minimo soggettivo (1/2, 1/3, 1/5).

## Versamento di contributi (elemento di "contributiVersati")

- tipo: uno tra i valori seguenti.
  - gs-saldo: Gestione separata, saldo dell'anno precedente.
  - gs-acconto-1: Gestione separata, 1° acconto dell'anno.
  - gs-acconto-2: Gestione separata, 2° acconto dell'anno.
  - fissi-1, fissi-2, fissi-3: artigiani/commercianti, 1ª, 2ª e 3ª rata trimestrale dei contributi fissi dell'anno (maggio, agosto, novembre).
  - fissi-4-prec: artigiani/commercianti, 4ª rata dei contributi fissi dell'anno PRECEDENTE, versata a febbraio.
  - ecc-saldo: artigiani/commercianti, saldo dell'eccedenza sul minimale (anno precedente).
  - ecc-acconto-1: artigiani/commercianti, 1° acconto sull'eccedenza.
  - ecc-acconto-2: artigiani/commercianti, 2° acconto sull'eccedenza.
  - enpap-soggettivo: ENPAP, contributo soggettivo.
  - enpap-integrativo: ENPAP, contributo integrativo (rivalsa sul cliente, mai deducibile).
  - enpap-maternita: ENPAP, contributo di maternità.
  - fpls-trattenute: spettacolo FPLS, quota trattenuta in fattura dal committente.
  - altro: qualsiasi altro versamento, descritto in "descrizione".
- descrizione (stringa): testo libero, utile soprattutto per "altro"; altrimenti "".
- importo (numero | null): euro versati.
- deducibile (booleano): true se il versamento è deducibile dal reddito (default), false per versamenti non deducibili (ad esempio contributi volontari extra). Per enpap-integrativo è sempre false.
`

export const ESEMPIO_IMPORT = {
  anno: 2025,
  anni: {
    '2024': {
      regimi: [
        {
          tipo: 'artigiani',
          aliquota: 5,
          coefficiente: 86,
          meseInizio: 1,
          giornoInizio: 1,
          meseFine: 12,
          giornoFine: 31,
          fatturato: 38000,
          riduzioneContributi: '35',
        },
      ],
      modalitaContributi: 'dettaglio',
      contributiVersatiTotale: null,
      contributiVersati: [
        { tipo: 'fissi-4-prec', descrizione: '', importo: 900.5, deducibile: true },
        { tipo: 'fissi-1', descrizione: '', importo: 900.5, deducibile: true },
        { tipo: 'fissi-2', descrizione: '', importo: 900.5, deducibile: true },
        { tipo: 'fissi-3', descrizione: '', importo: 900.5, deducibile: true },
      ],
      impostaSaldoVersato: null,
      impostaAcconto1Versato: 650,
      impostaAcconto2Versato: 650,
    },
    '2025': {
      regimi: [
        {
          tipo: 'artigiani',
          aliquota: 5,
          coefficiente: 86,
          meseInizio: 1,
          giornoInizio: 1,
          meseFine: 12,
          giornoFine: 31,
          fatturato: 42000,
          riduzioneContributi: '35',
        },
      ],
      modalitaContributi: 'dettaglio',
      contributiVersatiTotale: null,
      contributiVersati: [
        { tipo: 'fissi-4-prec', descrizione: '', importo: 900.5, deducibile: true },
        { tipo: 'fissi-1', descrizione: '', importo: 910.25, deducibile: true },
        { tipo: 'fissi-2', descrizione: '', importo: 910.25, deducibile: true },
        { tipo: 'fissi-3', descrizione: '', importo: 910.25, deducibile: true },
        { tipo: 'ecc-saldo', descrizione: '', importo: 1200, deducibile: true },
        { tipo: 'ecc-acconto-1', descrizione: '', importo: 600, deducibile: true },
        { tipo: 'ecc-acconto-2', descrizione: '', importo: 600, deducibile: true },
        { tipo: 'altro', descrizione: 'Contributo volontario', importo: 150, deducibile: false },
      ],
      impostaSaldoVersato: 800,
      impostaAcconto1Versato: 700,
      impostaAcconto2Versato: 700,
    },
  },
  rateazioniImposta: {},
  inizioAttivita: '2022-03-01',
}

export const PROMPT_IMPORT = `Sei un assistente che prepara i dati di un contribuente in regime forfettario italiano per l'importazione in un'applicazione di calcolo di imposte e contributi. Ti allego documenti (vecchia dichiarazione dei redditi, PDF dei modelli F24, movimenti bancari). Devi produrre un unico file JSON nel formato descritto dalla specifica qui sotto.

Regole.
1. Compila solo quanto risulta dai documenti. Se un dato non è presente o non è certo, usa null (oppure "" per le descrizioni): non stimare e non inventare importi.
2. Principio di cassa: i compensi (fatturato) sono quelli INCASSATI nell'anno solare, non quelli fatturati. I versamenti vanno nell'anno solare in cui sono stati materialmente pagati (data di addebito o di versamento), non nell'anno di competenza. Il saldo e gli acconti versati a giugno/luglio e novembre di un anno vanno nell'anno solare del pagamento.
3. Un anno per ogni anno solare per cui hai documenti, dentro "anni". "anno" è l'anno di riferimento più recente.
4. Se per un anno conosci solo il totale dei contributi, usa modalitaContributi "totale" e contributiVersatiTotale; se hai i singoli F24, usa "dettaglio" con un elemento per ogni versamento.
5. Mappa dei codici tributo e delle causali che compaiono negli F24.
   Imposta sostitutiva (sezione Erario):
   - 1790 -> impostaAcconto1Versato (1° acconto, giugno/luglio)
   - 1791 -> impostaAcconto2Versato (2° acconto, novembre)
   - 1792 -> impostaSaldoVersato (saldo dell'anno precedente, giugno/luglio)
   - 1668 -> interessi da rateazione: NON è imposta, non sommarlo agli importi sopra
   Contributi artigiani e commercianti (sezione INPS):
   - causale AF, rata 1, 2, 3 -> fissi-1, fissi-2, fissi-3 (scadenze maggio, agosto, novembre)
   - causale AF, rata 4 versata a febbraio dell'anno solare successivo -> fissi-4-prec nell'anno in cui la paghi
   - causale AP (rata 6) di saldo (giugno/luglio) -> ecc-saldo; di acconto: primo (giugno/luglio) -> ecc-acconto-1, secondo (novembre) -> ecc-acconto-2
   - causale APR (eccedenza rateizzata): stesse voci ecc-*; causale API (interessi): non sono contributi, ignorali
   Gestione separata (sezione INPS):
   - causale PXX (o P10 se iscritto ad altra forma previdenziale) di saldo -> gs-saldo; di acconto: primo -> gs-acconto-1, secondo -> gs-acconto-2
   - causale PXXR (rateizzata): stesse regole; DPPI (interessi): ignorala
   ENPAP e FPLS: nessun codice tributo noto, riconosci i versamenti dalla descrizione (enpap-soggettivo, enpap-integrativo, enpap-maternita, fpls-trattenute); in caso di dubbio usa "altro" con una descrizione.
6. Il tipo di regime (separata, artigiani, commercianti, enpap, spettacolo) si deduce dalla sezione INPS/cassa degli F24 o dai quadri della dichiarazione; l'aliquota (5 o 15) e il coefficiente di redditività dal quadro LM della dichiarazione. Se non si deducono, usa null e segnalalo fuori dal JSON.
7. Restituisci SOLO JSON valido: nessun testo prima o dopo, nessun blocco di codice, nessun commento, nessuna virgola finale.

Specifica del formato:

${SPEC_IMPORT}
Esempio di file completo:

${JSON.stringify(ESEMPIO_IMPORT, null, 2)}
`
