import { Plus, Trash2 } from 'lucide-react'
import { Button, Dropdown, DropdownItem } from 'flowbite-react'
import type { RisultatoCalcolo, TipoVersamento, VersamentoContributo } from '@/domain/types'
import { versamentoVuoto } from '@/domain/regimeFactory'
import { Field, MoneyInput, Select } from '@/components/ui'
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
  onChangeModalita: (m: 'totale' | 'dettaglio') => void
  onChangeTotale: (v: number | null) => void
  onChangeDettaglio: (righe: VersamentoContributo[]) => void
}

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

const labelTipo = (t: TipoVersamento) => TIPI.find((x) => x.value === t)?.label ?? 'Altro'

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
 * - G.S. acconto → dovuto G.S. dell'anno corrente, solo se ancora in G.S.
 * - Fissi 1-3 → rata trimestrale esatta dell'anno corrente.
 * - Fissi 4ª  → rata trimestrale dell'anno precedente (si versa a febbraio).
 * - Eccedenza saldo → eccedenza dovuta dell'anno precedente.
 * - Eccedenza acconto → eccedenza dovuta dell'anno corrente.
 */
function suggerimento(
  tipo: TipoVersamento,
  calcoli: RisultatoCalcolo | null,
  hasGSCorrente: boolean,
): number | null {
  if (!calcoli) return null
  const prec = calcoli.datiAnnoPrecedente
  // Gli acconti si versano in due rate (giugno e novembre), 50% ciascuna
  const accGS = hasGSCorrente ? calcoli.totaleContributiSeparata / 2 : 0
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
  onChangeModalita,
  onChangeTotale,
  onChangeDettaglio,
}: Props) {
  const somma = dettaglio.reduce((s, r) => s + (r.importo ?? 0), 0)

  // Ogni voce tipizzata (saldo, acconto, singola rata) è unica per anno; solo
  // 'altro' può ripetersi. Un tipo già presente non è riaggiungibile/riselezionabile.
  const giaUsato = (tipo: TipoVersamento, escludiId?: string) =>
    tipo !== 'altro' && dettaglio.some((r) => r.tipo === tipo && r.id !== escludiId)

  const aggiungi = (tipo: TipoVersamento) => {
    if (giaUsato(tipo)) return
    onChangeDettaglio([...dettaglio, versamentoVuoto(tipo)])
  }
  const rimuovi = (id: string) => onChangeDettaglio(dettaglio.filter((r) => r.id !== id))
  const aggiorna = (id: string, patch: Partial<VersamentoContributo>) =>
    onChangeDettaglio(dettaglio.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const suggerimentoRiga = (r: VersamentoContributo): number | null =>
    r.tipo === 'altro' ? null : suggerimento(r.tipo, calcoli, hasGSCorrente)

  const placeholderRiga = (r: VersamentoContributo): string => {
    const s = suggerimentoRiga(r)
    return s && s > 0.005 ? `Suggerito: ${formatEuro(s)}` : '0'
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

          {dettaglio.map((r) => (
            <div key={r.id} className="flex items-start gap-2">
              <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
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
                <MoneyInput
                  small
                  value={r.importo}
                  onChange={(v) => aggiorna(r.id, { importo: v })}
                  placeholder={placeholderRiga(r)}
                  min={0}
                  step={0.01}
                  nullable
                />
                {r.tipo === 'altro' && (
                  <input
                    type="text"
                    value={r.descrizione}
                    onChange={(e) => aggiorna(r.id, { descrizione: e.target.value })}
                    placeholder="Descrizione (es. ravvedimento, rata pregressa…)"
                    className="col-span-2 rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                )}
              </div>
              <button
                type="button"
                onClick={() => rimuovi(r.id)}
                className={`${theme.btnIconDanger} mt-0.5`}
                aria-label="Rimuovi versamento"
              >
                <Trash2 size={15} aria-hidden />
              </button>
            </div>
          ))}

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

export { labelTipo as labelTipoVersamento }
