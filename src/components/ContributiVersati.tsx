import { Plus, Trash2 } from 'lucide-react'
import { Button, Dropdown, DropdownItem } from 'flowbite-react'
import type { OpzioniRateazione, RisultatoCalcolo, TipoVersamento, VersamentoContributo } from '@/domain/types'
import { versamentoVuoto } from '@/domain/regimeFactory'
import { chiaveRateazioneVersamento, numeroRatePerChiave } from '@/domain/rateazione'
import { Field, MoneyInput, Select, Tooltip } from '@/components/ui'
import { formatEuro } from '@/domain/labels'
import { theme } from '@/theme'

interface Props {
  anno: number
  calcoli: RisultatoCalcolo | null
  /** Vero se l'anno corrente ha almeno un periodo in gestione separata. */
  hasGSCorrente: boolean
  modalita: 'totale' | 'dettaglio'
  totale: number | null
  dettaglio: VersamentoContributo[]
  /** Scelte di rateazione globali: determinano quante rate mostrare per una voce. */
  rateazioniImposta: Record<string, OpzioniRateazione>
  onChangeModalita: (m: 'totale' | 'dettaglio') => void
  onChangeTotale: (v: number | null) => void
  onChangeDettaglio: (righe: VersamentoContributo[]) => void
}

/** Tipi di versamento contributi che possono essere rateizzati dal calendario. */
const TIPI_RATEIZZABILI = ['gs-saldo', 'gs-acconto-1', 'ecc-saldo', 'ecc-acconto-1'] as const
type TipoRateizzabile = (typeof TIPI_RATEIZZABILI)[number]
const isRateizzabile = (tipo: TipoVersamento): tipo is TipoRateizzabile =>
  (TIPI_RATEIZZABILI as readonly string[]).includes(tipo)

const TIPI: { value: TipoVersamento; label: string }[] = [
  { value: 'gs-saldo', label: 'G.S. · saldo (anno prec.)' },
  { value: 'gs-acconto-1', label: 'G.S. · 1° acconto' },
  { value: 'gs-acconto-2', label: 'G.S. · 2° acconto' },
  { value: 'fissi-1', label: 'Fissi · 1ª rata' },
  { value: 'fissi-2', label: 'Fissi · 2ª rata' },
  { value: 'fissi-3', label: 'Fissi · 3ª rata' },
  { value: 'fissi-4-prec', label: 'Fissi · 4ª rata (anno prec.)' },
  { value: 'ecc-saldo', label: 'Eccedenza · saldo (anno prec.)' },
  { value: 'ecc-acconto-1', label: 'Eccedenza · 1° acconto' },
  { value: 'ecc-acconto-2', label: 'Eccedenza · 2° acconto' },
  { value: 'altro', label: 'Altro' },
]

// Menu di aggiunta raggruppati per categoria (le voci 'altro' restano un bottone a sé)
const MENU: { label: string; voci: { tipo: TipoVersamento; label: string }[] }[] = [
  {
    label: 'Gestione separata',
    voci: [
      { tipo: 'gs-saldo', label: 'Saldo (anno prec.)' },
      { tipo: 'gs-acconto-1', label: '1° acconto' },
      { tipo: 'gs-acconto-2', label: '2° acconto' },
    ],
  },
  {
    label: 'Artigiani/Commercianti',
    voci: [
      { tipo: 'fissi-1', label: 'Fissi · 1ª rata' },
      { tipo: 'fissi-2', label: 'Fissi · 2ª rata' },
      { tipo: 'fissi-3', label: 'Fissi · 3ª rata' },
      { tipo: 'fissi-4-prec', label: 'Fissi · 4ª rata (anno prec.)' },
      { tipo: 'ecc-saldo', label: 'Eccedenza · saldo (anno prec.)' },
      { tipo: 'ecc-acconto-1', label: 'Eccedenza · 1° acconto' },
      { tipo: 'ecc-acconto-2', label: 'Eccedenza · 2° acconto' },
    ],
  },
]

/**
 * Importo suggerito (placeholder) per una tipologia di versamento, secondo le
 * regole di cassa INPS (nel forfettario i contributi a percentuale si versano
 * a saldo l'anno dopo, con acconti per l'anno in corso):
 * - G.S. saldo  → dovuto G.S. dell'anno precedente.
 * - G.S. acconto → 40% del dovuto G.S. dell'anno precedente (regola ADE: acconto
 *   = 80% in due rate del 40%), solo se ancora in G.S.
 * - Fissi 1-3 → rata trimestrale esatta dell'anno corrente.
 * - Fissi 4ª  → rata trimestrale dell'anno precedente (si versa a febbraio).
 * - Eccedenza saldo → eccedenza dovuta dell'anno precedente.
 * - Eccedenza acconto → eccedenza dovuta dell'anno corrente, 50% a rata.
 */
function suggerimento(
  tipo: TipoVersamento,
  calcoli: RisultatoCalcolo | null,
  hasGSCorrente: boolean,
): number | null {
  if (!calcoli) return null
  const prec = calcoli.datiAnnoPrecedente
  // G.S.: 40% del dovuto dell'anno precedente per rata; eccedenza: 50% a rata.
  const accGS = hasGSCorrente ? ((prec?.totaleContributiSeparata ?? 0) * 0.8) / 2 : 0
  const accEcc = calcoli.totaleContributiEccedenzaArtComm / 2
  switch (tipo) {
    case 'gs-saldo': return prec?.totaleContributiSeparata ?? 0
    case 'gs-acconto-1':
    case 'gs-acconto-2': return accGS
    case 'fissi-1': return calcoli.rateFisse[0]
    case 'fissi-2': return calcoli.rateFisse[1]
    case 'fissi-3': return calcoli.rateFisse[2]
    case 'fissi-4-prec': return prec?.rateFisse[3] ?? 0
    case 'ecc-saldo': return prec?.totaleContributiEccedenzaArtComm ?? 0
    case 'ecc-acconto-1':
    case 'ecc-acconto-2': return accEcc
    default: return null
  }
}

/**
 * Inserimento dei contributi versati nell'anno: o una cifra unica modificabile,
 * o una lista di versamenti la cui somma (non modificabile) è il valore usato.
 * Le due modalità conservano i rispettivi dati: cambiare scheda non cancella nulla.
 */
export function ContributiVersati({
  anno,
  calcoli,
  hasGSCorrente,
  modalita,
  totale,
  dettaglio,
  rateazioniImposta,
  onChangeModalita,
  onChangeTotale,
  onChangeDettaglio,
}: Props) {
  const somma = dettaglio.reduce((s, r) => s + (r.importo ?? 0), 0)

  // Numero di rate attive per un tipo rateizzabile (1 = nessuna rateazione).
  const numeroRate = (tipo: TipoVersamento): number =>
    isRateizzabile(tipo)
      ? numeroRatePerChiave(rateazioniImposta, chiaveRateazioneVersamento(tipo, anno))
      : 1

  // Ogni voce tipizzata è unica per anno (una riga per numeroRata se rateizzata
  // con più rate); solo 'altro' può ripetersi liberamente. Un tipo/rata già
  // presente non è riaggiungibile/riselezionabile.
  const giaUsato = (tipo: TipoVersamento, escludiId?: string) => {
    if (tipo === 'altro') return false
    const righeTipo = dettaglio.filter((r) => r.tipo === tipo && r.id !== escludiId)
    return righeTipo.length >= numeroRate(tipo)
  }

  const aggiungi = (tipo: TipoVersamento) => {
    if (giaUsato(tipo)) return
    const n = numeroRate(tipo)
    if (n <= 1) {
      onChangeDettaglio([...dettaglio, versamentoVuoto(tipo)])
      return
    }
    // Rateizzata: crea in un colpo solo le righe per tutte le rate mancanti.
    const presenti = new Set(dettaglio.filter((r) => r.tipo === tipo).map((r) => r.numeroRata))
    const nuove = Array.from({ length: n }, (_, i) => i + 1)
      .filter((numeroRata) => !presenti.has(numeroRata))
      .map((numeroRata) => ({ ...versamentoVuoto(tipo), numeroRata }))
    onChangeDettaglio([...dettaglio, ...nuove])
  }
  const rimuovi = (id: string) => onChangeDettaglio(dettaglio.filter((r) => r.id !== id))
  const aggiorna = (id: string, patch: Partial<VersamentoContributo>) =>
    onChangeDettaglio(
      dettaglio.map((r) => {
        if (r.id !== id) return r
        const next = { ...r, ...patch }
        // I versamenti obbligatori (tutti tranne 'altro') sono sempre deducibili:
        // forziamo true per sicurezza, la scelta resta solo per 'altro'.
        if (next.tipo !== 'altro') next.deducibile = true
        return next
      }),
    )

  const suggerimentoRiga = (r: VersamentoContributo): number | null =>
    r.tipo === 'altro' ? null : suggerimento(r.tipo, calcoli, hasGSCorrente)

  const placeholderRiga = (r: VersamentoContributo): string => {
    const s = suggerimentoRiga(r)
    return s && s > 0.005 ? `Suggerito: ${formatEuro(s)}` : '0'
  }

  const etichettaRiga = (r: VersamentoContributo): string | undefined => {
    if (r.numeroRata == null) return undefined
    const n = numeroRate(r.tipo)
    return n > 1 ? `Rata ${r.numeroRata} di ${n}` : undefined
  }

  return (
    <div className="space-y-4">
      {/* Selettore modalità (radio) */}
      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-sm">
        <button
          type="button"
          onClick={() => onChangeModalita('totale')}
          className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
            modalita === 'totale' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Cifra unica
        </button>
        <button
          type="button"
          onClick={() => onChangeModalita('dettaglio')}
          className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
            modalita === 'dettaglio' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Lista versamenti
        </button>
      </div>

      {modalita === 'totale' ? (
        <Field
          label="Contributi INPS versati"
          info={`Somma di tutti i contributi INPS versati durante il ${anno}. Deducibile dall'imponibile prima del calcolo dell'imposta sostitutiva ${anno}.`}
        >
          <MoneyInput
            value={totale}
            onChange={onChangeTotale}
            placeholder={`Stima: ${formatEuro(calcoli?.totaleContributiINPS ?? 0)}`}
            min={0}
            step={0.01}
            nullable
          />
        </Field>
      ) : (
        <div className="space-y-3">
          {dettaglio.length === 0 && (
            <p className={theme.helpText}>
              Aggiungi i versamenti effettuati nel {anno}. La loro somma sarà il valore usato per la deducibilità.
            </p>
          )}

          {dettaglio.map((r) => {
            const etichettaRata = etichettaRiga(r)
            return (
            <div key={r.id} className="space-y-2">
              <div className="flex items-start gap-2">
                {/* Tipo: elastico. Importo: stretto (~8 cifre). Cestino: a destra.
                    Le righe-rata (parte di un piano di rateazione) mostrano il
                    tipo come testo fisso: cambiarlo su una singola rata non ha senso. */}
                <div className="min-w-0 flex-1">
                  {etichettaRata ? (
                    <div className="flex h-full min-h-[2.125rem] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-600">
                      <span className="font-medium text-slate-700">
                        {TIPI.find((t) => t.value === r.tipo)?.label ?? r.tipo}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span>{etichettaRata}</span>
                    </div>
                  ) : (
                    <Select<TipoVersamento>
                      small
                      value={r.tipo}
                      onChange={(v) => {
                        if (giaUsato(v, r.id)) return // tipo già presente in un'altra riga
                        aggiorna(r.id, { tipo: v })
                      }}
                      // Mostra solo i tipi non già usati altrove (più quello corrente)
                      options={TIPI.filter((t) => !giaUsato(t.value, r.id))}
                    />
                  )}
                </div>
                <div className="w-28 shrink-0">
                  <MoneyInput
                    small
                    value={r.importo}
                    onChange={(v) => aggiorna(r.id, { importo: v })}
                    placeholder={placeholderRiga(r)}
                    min={0}
                    step={0.01}
                    nullable
                  />
                </div>
                <button
                  type="button"
                  onClick={() => rimuovi(r.id)}
                  className={`${theme.btnIconDanger} mt-0.5 shrink-0`}
                  aria-label="Rimuovi versamento"
                >
                  <Trash2 size={15} aria-hidden />
                </button>
              </div>
              {/* La deducibilità si chiede SOLO per i versamenti "altro" (volontari):
                  i contributi previdenziali obbligatori sono sempre deducibili. */}
              {r.tipo === 'altro' && (
                <div className="space-y-2">
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={r.deducibile !== false}
                      onChange={(e) => aggiorna(r.id, { deducibile: e.target.checked })}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30"
                    />
                    deducibile in dichiarazione
                    <Tooltip
                      content="Spunta per i contributi previdenziali obbligatori (anche rate pregresse o ravvedimenti pagati quest'anno: deducibili per cassa). Togli la spunta per i versamenti volontari extra IVS, che vanno solo annotati e non sono deducibili."
                      label="Quando è deducibile"
                      posizione="sotto"
                      allinea="sinistra"
                    />
                  </label>
                  <input
                    type="text"
                    value={r.descrizione}
                    onChange={(e) => aggiorna(r.id, { descrizione: e.target.value })}
                    placeholder="Descrizione (es. ravvedimento, rata pregressa…)"
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
              )}
            </div>
            )
          })}

          {/* Aggiunta per categoria: le voci già inserite spariscono dai menu */}
          <div className="flex flex-wrap gap-2">
            {MENU.map((m) => {
              const disponibili = m.voci.filter((v) => !giaUsato(v.tipo))
              if (disponibili.length === 0) return null // tutte usate → nascondi il menu
              return (
                <Dropdown
                  key={m.label}
                  size="xs"
                  color="light"
                  label={
                    <span className="inline-flex items-center">
                      <Plus size={13} className="mr-1" /> {m.label}
                    </span>
                  }
                  dismissOnClick
                >
                  {disponibili.map((v) => (
                    <DropdownItem key={v.tipo} onClick={() => aggiungi(v.tipo)}>
                      {v.label}
                    </DropdownItem>
                  ))}
                </Dropdown>
              )
            })}

            <Button color="light" size="xs" onClick={() => aggiungi('altro')}>
              <Plus size={13} className="mr-1" />
              Altro
            </Button>
          </div>

          {/* Somma (non modificabile) */}
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <span className="text-sm font-medium text-slate-600">Totale versato (somma)</span>
            <span className="text-base font-bold tabular-nums text-slate-900">{formatEuro(somma)}</span>
          </div>
        </div>
      )}

      {calcoli && (
        <p className={theme.helpText}>
          Valore usato per la deducibilità: {formatEuro(calcoli.contributiVersatiAnnoImpostaPerDeducibilita)}
        </p>
      )}
    </div>
  )
}
