import type { CalcoloInput, OpzioniRateazione, Regime, TipoVersamento, VersamentoContributo } from '@/domain/types'
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

/**
 * Carica l'input salvato, fondendolo con uno stato di default. Restituisce
 * `null` se non c'è nulla di valido in localStorage (l'app userà il default).
 */
export function caricaInput(base: CalcoloInput): CalcoloInput | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as Record<string, unknown>

    // L'anno salvato deve essere ancora disponibile, altrimenti usa il default
    const anniOk = anniDisponibili()
    const anno = typeof o.anno === 'number' && anniOk.includes(o.anno) ? o.anno : base.anno

    return {
      anno,
      regimiCorrente: normalizzaRegimi(o.regimiCorrente),
      regimiPrecedente: normalizzaRegimi(o.regimiPrecedente),
      contributiVersatiDuranteAnno: numOrNull(o.contributiVersatiDuranteAnno),
      modalitaContributiVersati: o.modalitaContributiVersati === 'dettaglio' ? 'dettaglio' : 'totale',
      contributiVersatiDettaglio: normalizzaDettaglio(o.contributiVersatiDettaglio),
      contributiVersatiDuranteAnnoPrecedente: numOrNull(o.contributiVersatiDuranteAnnoPrecedente),
      impostaSaldoVersatoAnnoCorrente: numOrNull(o.impostaSaldoVersatoAnnoCorrente),
      impostaAcconto1VersatoAnnoCorrente: numOrNull(o.impostaAcconto1VersatoAnnoCorrente),
      impostaAcconto2VersatoAnnoCorrente: numOrNull(o.impostaAcconto2VersatoAnnoCorrente),
      accontiImposteVersatiPerAnnoPrecedente: numOrNull(o.accontiImposteVersatiPerAnnoPrecedente),
      rateazioniImposta: normalizzaRateazioni(o.rateazioniImposta),
    }
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

/** Rimuove l'input salvato (reset). */
export function pulisciInput(): void {
  try {
    localStorage.removeItem(LS_KEY)
  } catch {
    // ignora
  }
}
