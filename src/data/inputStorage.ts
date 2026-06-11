import type { CalcoloInput, DatiAnno, OpzioniRateazione, Regime, TipoVersamento, VersamentoContributo } from '@/domain/types'
import { datiAnnoVuoto } from '@/domain/types'
import { regimeVuoto, versamentoVuoto } from '@/domain/regimeFactory'
import { normalizzaOpzioni, rateazioneNeutra } from '@/domain/rateazione'
import { anniDisponibili } from '@/data/taxData'

const LS_KEY = 'forfettario_input'

/**
 * Persistenza dell'input utente (regimi, importi, anno selezionato) in
 * localStorage. I dati salvati sono trattati come non fidati: vengono
 * normalizzati e ricondotti a una forma valida prima dell'uso, così un
 * payload vecchio o corrotto non rompe l'app.
 */

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/** Ricostruisce un Regime valido da dati grezzi, partendo da un regime vuoto. */
function normalizzaRegime(raw: unknown): Regime {
  const base = regimeVuoto()
  if (typeof raw !== 'object' || raw === null) return base
  const o = raw as Record<string, unknown>

  const tipo = o.tipo === 'artigiani' || o.tipo === 'commercianti' ? o.tipo : 'separata'
  const aliquota = o.aliquota === 5 || o.aliquota === 15 ? o.aliquota : base.aliquota
  const riduzione =
    o.riduzioneContributi === '35' || o.riduzioneContributi === '50' ? o.riduzioneContributi : 'nessuna'

  return {
    id: base.id, // sempre un id fresco, evita collisioni
    tipo,
    aliquota,
    coefficiente: num(o.coefficiente, base.coefficiente),
    meseInizio: num(o.meseInizio, base.meseInizio),
    giornoInizio: num(o.giornoInizio, base.giornoInizio),
    meseFine: num(o.meseFine, base.meseFine),
    giornoFine: num(o.giornoFine, base.giornoFine),
    fatturato: num(o.fatturato, 0),
    riduzioneContributi: riduzione,
  }
}

function normalizzaRegimi(raw: unknown): Regime[] {
  if (!Array.isArray(raw) || raw.length === 0) return [regimeVuoto()]
  return raw.map(normalizzaRegime)
}

const TIPI_VERS: TipoVersamento[] = [
  'gs-saldo', 'gs-acconto-1', 'gs-acconto-2',
  'fissi-1', 'fissi-2', 'fissi-3', 'fissi-4-prec',
  'ecc-saldo', 'ecc-acconto-1', 'ecc-acconto-2', 'altro',
]

/** Ricostruisce una riga di versamento valida da dati grezzi. */
function normalizzaVersamento(raw: unknown): VersamentoContributo {
  const base = versamentoVuoto()
  if (typeof raw !== 'object' || raw === null) return base
  const o = raw as Record<string, unknown>
  return {
    id: base.id,
    tipo: TIPI_VERS.includes(o.tipo as TipoVersamento) ? (o.tipo as TipoVersamento) : 'altro',
    descrizione: typeof o.descrizione === 'string' ? o.descrizione : '',
    importo: numOrNull(o.importo),
    // default true: voce deducibile salvo che sia stata esplicitamente esclusa
    deducibile: o.deducibile === false ? false : true,
  }
}

function normalizzaDettaglio(raw: unknown): VersamentoContributo[] {
  if (!Array.isArray(raw)) return []
  return raw.map(normalizzaVersamento)
}

/** Ricostruisce le scelte di rateazione valide, scartando quelle neutre. */
function normalizzaRateazioni(raw: unknown): Record<string, OpzioniRateazione> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
  const out: Record<string, OpzioniRateazione> = {}
  for (const [chiave, valore] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof valore !== 'object' || valore === null) continue
    const o = valore as Record<string, unknown>
    const opzioni = normalizzaOpzioni({
      inizio: o.inizio === 'luglio' ? 'luglio' : 'giugno',
      numeroRate: num(o.numeroRate, 1),
    })
    if (!rateazioneNeutra(opzioni)) out[chiave] = opzioni
  }
  return out
}

/** Ricostruisce un DatiAnno valido da dati grezzi. */
function normalizzaDatiAnno(raw: unknown): DatiAnno {
  const base = datiAnnoVuoto([regimeVuoto()])
  if (typeof raw !== 'object' || raw === null) return base
  const o = raw as Record<string, unknown>
  return {
    regimi: normalizzaRegimi(o.regimi),
    modalitaContributi: o.modalitaContributi === 'dettaglio' ? 'dettaglio' : 'totale',
    contributiVersatiTotale: numOrNull(o.contributiVersatiTotale),
    contributiVersati: normalizzaDettaglio(o.contributiVersati),
    impostaSaldoVersato: numOrNull(o.impostaSaldoVersato),
    impostaAcconto1Versato: numOrNull(o.impostaAcconto1Versato),
    impostaAcconto2Versato: numOrNull(o.impostaAcconto2Versato),
  }
}

/** Normalizza la mappa anni→DatiAnno (chiavi numeriche valide). */
function normalizzaAnni(raw: unknown): Record<number, DatiAnno> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
  const out: Record<number, DatiAnno> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const anno = Number(k)
    if (Number.isInteger(anno) && anno > 1990 && anno < 2200) out[anno] = normalizzaDatiAnno(v)
  }
  return out
}

/**
 * MIGRAZIONE dal vecchio formato mono-anno (campi piatti regimiCorrente/
 * Precedente, contributiVersati*, imposta*…) al nuovo per-anno. Mappa:
 * - anno → regimi correnti, contributi/imposte versati durante l'anno
 * - anno-1 → regimi precedenti, contributi versati durante l'anno precedente
 *   (gli acconti imposta "per l'anno precedente" diventano gli acconti versati
 *   durante l'anno-1; il saldo/acconti "versati nell'anno corrente" restano
 *   nell'anno corrente).
 * - versamentiAnnoSuccessivo → anno+1.
 */
function migraDalVecchio(o: Record<string, unknown>, anno: number): Record<number, DatiAnno> {
  const anni: Record<number, DatiAnno> = {}
  // Anno di riferimento
  anni[anno] = {
    regimi: normalizzaRegimi(o.regimiCorrente),
    modalitaContributi: o.modalitaContributiVersati === 'dettaglio' ? 'dettaglio' : 'totale',
    contributiVersatiTotale: numOrNull(o.contributiVersatiDuranteAnno),
    contributiVersati: normalizzaDettaglio(o.contributiVersatiDettaglio),
    impostaSaldoVersato: numOrNull(o.impostaSaldoVersatoAnnoCorrente),
    impostaAcconto1Versato: numOrNull(o.impostaAcconto1VersatoAnnoCorrente),
    impostaAcconto2Versato: numOrNull(o.impostaAcconto2VersatoAnnoCorrente),
  }
  // Anno precedente
  anni[anno - 1] = {
    regimi: normalizzaRegimi(o.regimiPrecedente),
    modalitaContributi: 'totale',
    contributiVersatiTotale: numOrNull(o.contributiVersatiDuranteAnnoPrecedente),
    contributiVersati: [],
    impostaSaldoVersato: null,
    // gli acconti imposta "per l'anno precedente" sono stati versati durante l'anno-1;
    // li conserviamo come unico totale sul 1° acconto (l'utente potrà ripartirli).
    impostaAcconto1Versato: numOrNull(o.accontiImposteVersatiPerAnnoPrecedente),
    impostaAcconto2Versato: null,
  }
  // Anno successivo (pagamenti già fatti per N+1)
  const versSucc = normalizzaDettaglio(o.versamentiAnnoSuccessivo)
  if (versSucc.length > 0) {
    anni[anno + 1] = { ...datiAnnoVuoto([regimeVuoto()]), modalitaContributi: 'dettaglio', contributiVersati: versSucc }
  }
  return anni
}

/**
 * Ricostruisce un CalcoloInput valido da un oggetto grezzo (già parsato). Accetta
 * sia il formato nuovo (mappa `anni`) sia il vecchio mono-anno (migrato). `base`
 * fornisce l'anno di default se quello salvato non è più disponibile.
 */
export function normalizzaInput(o: Record<string, unknown>, base: CalcoloInput): CalcoloInput {
  const anniOk = anniDisponibili()
  const anno = typeof o.anno === 'number' && anniOk.includes(o.anno) ? o.anno : base.anno
  const anni = o.anni !== undefined ? normalizzaAnni(o.anni) : migraDalVecchio(o, anno)
  return { anno, anni, rateazioniImposta: normalizzaRateazioni(o.rateazioniImposta) }
}

/**
 * Carica l'input salvato. Restituisce `null` se non c'è nulla di valido.
 * Riconosce sia il nuovo formato (con `anni`) sia il vecchio mono-anno, che
 * viene migrato automaticamente.
 */
export function caricaInput(base: CalcoloInput): CalcoloInput | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    return normalizzaInput(JSON.parse(raw) as Record<string, unknown>, base)
  } catch {
    return null
  }
}

/** Salva l'input corrente in localStorage. Silenzioso su errori (quota, ecc.). */
export function salvaInput(input: CalcoloInput): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(input))
  } catch {
    // storage non disponibile o quota superata — ignora
  }
}

/** Serializza l'input come stringa JSON indentata, per l'esportazione su file. */
export function esportaInput(input: CalcoloInput): string {
  return JSON.stringify(input, null, 2)
}

/**
 * Importa l'input da una stringa JSON (file caricato). Restituisce l'input
 * normalizzato, o lancia se il JSON è malformato. `base` dà l'anno di default.
 */
export function importaInput(json: string, base: CalcoloInput): CalcoloInput {
  const o = JSON.parse(json) as Record<string, unknown>
  if (typeof o !== 'object' || o === null) throw new Error('Formato non valido')
  return normalizzaInput(o, base)
}

/** Rimuove l'input salvato (reset). */
export function pulisciInput(): void {
  try {
    localStorage.removeItem(LS_KEY)
  } catch {
    // ignora
  }
}
