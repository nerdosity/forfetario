import type { InizioRateazione, OpzioniRateazione, Scadenza } from '@/domain/types'
import { formattaScadenza, giorniInMese, mmggDaLeggibile } from '@/domain/dates'

/**
 * Rateazione dei versamenti di saldo e 1° acconto (imposte e contributi da
 * quadro RR), replicata dal software ufficiale "Redditi PF" dell'Agenzia delle
 * Entrate (F24PerRPF, sogei.f24uniNN.utility.Costanti / FactoryF24DaUNI.rateazione):
 * - prima scadenza ordinaria (di norma 30/06) → fino a 7 rate; differita di
 *   30 giorni → fino a 6 rate, con maggiorazione dello 0,4% sull'intero importo;
 * - rate successive alla prima entro il giorno 16 di ciascun mese (20 ad
 *   agosto), con interessi di rateazione del 4% annuo (0,33% al mese) applicati
 *   come percentuale fissa cumulata per rata;
 * - i calcoli avvengono in centesimi interi: quota = floor(totale/n) con il
 *   resto sulla prima rata, interessi e maggiorazione arrotondati al centesimo.
 * Le date sono quelle nominali: se festive slittano al primo giorno lavorativo.
 *
 * Per i contributi INPS (causali DPPI / API) valgono due regole diverse:
 * - gli interessi di rateazione sono sempre dovuti dalla 2ª rata, anche se di
 *   pochi centesimi (la soglia di 1,03 € è propria del codice erariale 1668);
 * - la maggiorazione dello 0,4% del versamento differito non si ingloba nella
 *   quota, ma si espone a parte con la causale interessi.
 * Vedi il parametro `modalita` di calcolaPianoRateazione.
 */

/** Maggiorazione dovuta versando alla scadenza differita di 30 giorni. */
export const MAGGIORAZIONE_LUGLIO = 0.004

/**
 * Soglia (in centesimi) sotto la quale gli interessi di una rata non sono
 * dovuti: il software ufficiale non iscrive la riga interessi (codice 1668)
 * se l'importo non supera 1,03 € e lo azzera. Vale solo per l'erario: per i
 * contributi INPS gli interessi si espongono sempre (modalità 'inps').
 */
const SOGLIA_INTERESSI_CENTS = 103

/**
 * Ente destinatario del versamento rateizzato, da cui dipendono soglia degli
 * interessi e trattamento della maggiorazione 0,4%.
 */
export type ModalitaRateazione = 'erario' | 'inps'

/** Date nominali "MM-GG" delle rate successive alla prima (il 16, 20 ad agosto). */
const RATE_SUCCESSIVE = ['07-16', '08-20', '09-16', '10-16', '11-16', '12-16']

/** Prima scadenza ordinaria di default: 30 giugno (versamenti d'imposta). */
const PRIMA_DEFAULT: PrimaScadenza = { mmgg: '06-30', anno: 2025 }

/** Prima scadenza reale del versamento da rateizzare (per i contributi può differire dal 30/06). */
export interface PrimaScadenza {
  mmgg: string
  /** Anno solare della scadenza (serve per i giorni del mese nel differimento). */
  anno: number
}

/** Sposta una data "MM-GG" avanti di 30 giorni (scadenza differita). */
export function piu30Giorni(mmgg: string, anno: number): string {
  const [mm, gg] = mmgg.split('-').map(Number)
  let mese = mm
  let giorno = gg + 30
  while (giorno > giorniInMese(mese, anno)) {
    giorno -= giorniInMese(mese, anno)
    mese++
  }
  return `${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`
}

/** Date "MM-GG" delle rate: prima scadenza (ordinaria o differita) + rate del 16. */
function dateRate(inizio: InizioRateazione, prima: PrimaScadenza): string[] {
  const primaData = inizio === 'giugno' ? prima.mmgg : piu30Giorni(prima.mmgg, prima.anno)
  // Confronto lessicografico: "MM-GG" zero-padded ordina come le date.
  return [primaData, ...RATE_SUCCESSIVE.filter((d) => d > primaData)]
}

/** Interessi di rateazione cumulati per rata (tabella ufficiale, 0,33%/mese). */
const INTERESSI_RATE: Record<InizioRateazione, number[]> = {
  giugno: [0, 0.0018, 0.0051, 0.0084, 0.0117, 0.015, 0.0183],
  luglio: [0, 0.0018, 0.0051, 0.0084, 0.0117, 0.015],
}

/** Numero massimo di rate consentito per la prima scadenza scelta. */
export function numeroRateMax(inizio: InizioRateazione): number {
  return INTERESSI_RATE[inizio].length
}

/** Riconduce le opzioni a valori validi (rate intere, entro il massimo). */
export function normalizzaOpzioni(opzioni: OpzioniRateazione): OpzioniRateazione {
  const inizio: InizioRateazione = opzioni.inizio === 'luglio' ? 'luglio' : 'giugno'
  const richieste = Number.isFinite(opzioni.numeroRate) ? Math.round(opzioni.numeroRate) : 1
  const numeroRate = Math.min(Math.max(1, richieste), numeroRateMax(inizio))
  return { inizio, numeroRate }
}

/** Vero se le opzioni coincidono col versamento unico ordinario (nessun piano). */
export function rateazioneNeutra(opzioni: OpzioniRateazione): boolean {
  const o = normalizzaOpzioni(opzioni)
  return o.inizio === 'giugno' && o.numeroRate === 1
}

/** Una rata del piano di versamento. */
export interface RataPiano {
  numero: number
  /** Data nominale "MM-GG" (l'anno è quello della scadenza). */
  dataMMGG: string
  /**
   * Quota capitale. In modalità 'erario' comprende la sua parte di
   * maggiorazione; in modalità 'inps' è la sola quota del contributo.
   */
  quota: number
  /** Aliquota interessi di rateazione applicata alla quota. */
  aliquotaInteressi: number
  interessi: number
  /**
   * Maggiorazione 0,4% esposta a parte sulla 1ª rata (solo modalità 'inps' con
   * prima scadenza differita): per i contributi non si ingloba nella quota.
   */
  maggiorazione?: number
  /** Totale da versare per la rata (quota + interessi + maggiorazione). */
  importo: number
}

/** Piano completo di rateazione di un versamento d'imposta. */
export interface PianoRateazione {
  opzioni: OpzioniRateazione
  importoOriginario: number
  /** Maggiorazione 0,4% (solo con inizio a luglio). */
  maggiorazione: number
  totaleInteressi: number
  /** Importo complessivo: originario + maggiorazione + interessi. */
  totale: number
  rate: RataPiano[]
}

/**
 * Calcola il piano di rateazione di un importo, con la stessa aritmetica del
 * software ufficiale: tutto in centesimi, quota = floor(totale/n) e resto
 * sulla prima rata, interessi arrotondati al centesimo per rata.
 *
 * `modalita` distingue i due enti: 'erario' ingloba la maggiorazione nelle
 * quote e azzera gli interessi di rata sotto 1,03 €; 'inps' rateizza il solo
 * importo del contributo, espone la maggiorazione a parte sulla prima rata e
 * non applica alcuna soglia agli interessi.
 */
export function calcolaPianoRateazione(
  importo: number,
  opzioni: OpzioniRateazione,
  prima: PrimaScadenza = PRIMA_DEFAULT,
  modalita: ModalitaRateazione = 'erario',
): PianoRateazione {
  const opz = normalizzaOpzioni(opzioni)
  const { inizio } = opz
  const date = dateRate(inizio, prima)
  const numeroRate = Math.min(opz.numeroRate, date.length)

  const centesimi = Math.round(importo * 100)
  const maggiorazione = inizio === 'luglio' ? Math.round(centesimi * MAGGIORAZIONE_LUGLIO) : 0
  // Per l'erario la maggiorazione si ripartisce fra le quote; per l'INPS resta
  // fuori dalla rateazione e si versa a parte con la causale interessi.
  const daRateizzare = modalita === 'inps' ? centesimi : centesimi + maggiorazione

  const quotaBase = Math.floor(daRateizzare / numeroRate)
  const resto = daRateizzare - quotaBase * numeroRate

  const rate: RataPiano[] = []
  let totaleInteressi = 0
  for (let i = 0; i < numeroRate; i++) {
    const quota = quotaBase + (i === 0 ? resto : 0)
    const aliquota = INTERESSI_RATE[inizio][i]
    const calcolati = Math.round(quota * aliquota)
    // Sotto la soglia gli interessi della rata non sono dovuti (regola AdE),
    // che però non vale per i contributi INPS.
    const interessi =
      modalita === 'inps' || calcolati > SOGLIA_INTERESSI_CENTS ? calcolati : 0
    const maggiorazioneRata = modalita === 'inps' && i === 0 ? maggiorazione : 0
    totaleInteressi += interessi
    rate.push({
      numero: i + 1,
      dataMMGG: date[i],
      quota: quota / 100,
      aliquotaInteressi: aliquota,
      interessi: interessi / 100,
      ...(maggiorazioneRata > 0 ? { maggiorazione: maggiorazioneRata / 100 } : {}),
      importo: (quota + interessi + maggiorazioneRata) / 100,
    })
  }

  return {
    opzioni: { inizio, numeroRate },
    importoOriginario: centesimi / 100,
    maggiorazione: maggiorazione / 100,
    totaleInteressi: totaleInteressi / 100,
    totale: (centesimi + maggiorazione + totaleInteressi) / 100,
    rate,
  }
}

/**
 * Modalità di rateazione dedotta dalla chiave: le chiavi dei contributi INPS
 * ("gs-…", "ecc-…") seguono le regole INPS, tutte le altre quelle erariali.
 */
export function modalitaDaChiave(chiave?: string): ModalitaRateazione {
  return chiave?.startsWith('gs-') || chiave?.startsWith('ecc-') ? 'inps' : 'erario'
}

/**
 * Espande una scadenza d'imposta rateizzata nelle sue righe-rata per il
 * calendario. Con opzioni neutre (giugno, rata unica) restituisce la scadenza
 * invariata. Le righe-rata non sono collegate ai versamenti inseriti
 * (l'importo cambia per maggiorazione/interessi), salvo il caso di rata unica
 * differita a luglio, che resta un singolo versamento tracciabile.
 */
export function espandiRateazione(scadenza: Scadenza, opzioni: OpzioniRateazione): Scadenza[] {
  if (rateazioneNeutra(opzioni)) return [scadenza]

  const anno = scadenza.annoScadenza
  // Il piano parte dalla data reale della scadenza (per i contributi può non
  // essere il 30/06); se non riconoscibile si ricade sull'ordinaria.
  const prima: PrimaScadenza = { mmgg: mmggDaLeggibile(scadenza.data) ?? '06-30', anno }
  const modalita = modalitaDaChiave(scadenza.chiaveRateazione)
  const piano = calcolaPianoRateazione(scadenza.importo, opzioni, prima, modalita)
  const n = piano.opzioni.numeroRate

  return piano.rate.map((rata) => {
    const componenti = [
      {
        // Per l'INPS la maggiorazione è una voce a sé, non parte della quota.
        tipo:
          modalita === 'erario' && piano.maggiorazione > 0
            ? 'Quota (incl. maggiorazione 0,4%)'
            : 'Quota',
        importo: rata.quota,
      },
      ...(rata.interessi > 0
        ? [{
            tipo: `Interessi rateazione ${(rata.aliquotaInteressi * 100).toFixed(2).replace('.', ',')}%`,
            importo: rata.interessi,
          }]
        : []),
      ...(rata.maggiorazione
        ? [{ tipo: 'Maggiorazione 0,4%', importo: rata.maggiorazione }]
        : []),
    ]
    const voceRata = n > 1 ? ` · rata ${rata.numero} di ${n}` : ' · differito di 30 giorni'
    return {
      data: formattaScadenza(rata.dataMMGG, anno),
      descrizione: `${scadenza.descrizione}${voceRata}`,
      categoria: scadenza.categoria,
      voce: `${scadenza.voce ?? ''}${voceRata}`,
      importo: rata.importo,
      componenti,
      annoScadenza: anno,
      stimata: scadenza.stimata,
      chiaveRateazione: scadenza.chiaveRateazione,
      importoRateazioneBase: scadenza.importo,
      dataRateazioneBase: scadenza.data,
      // Con più rate il collegamento ai versamenti inseriti perde significato.
      riferimenti: n === 1 ? scadenza.riferimenti : undefined,
    }
  })
}
