import { Plus, Trash2 } from 'lucide-react'
import { Button } from 'flowbite-react'
import type { RisultatoCalcolo, TipoVersamento, VersamentoContributo } from '@/domain/types'
import { versamentoVuoto } from '@/domain/regimeFactory'
import { Field, MoneyInput, Select } from '@/components/ui'
import { formatEuro } from '@/domain/labels'
import { theme } from '@/theme'

interface Props {
  anno: number
  calcoli: RisultatoCalcolo | null
  /** Modalità attiva: cifra unica oppure lista di versamenti. */
  modalita: 'totale' | 'dettaglio'
  /** Totale unico (usato in modalità 'totale'). */
  totale: number | null
  /** Righe di dettaglio (usate in modalità 'dettaglio'). */
  dettaglio: VersamentoContributo[]
  onChangeModalita: (m: 'totale' | 'dettaglio') => void
  onChangeTotale: (v: number | null) => void
  onChangeDettaglio: (righe: VersamentoContributo[]) => void
}

const TIPI: { value: TipoVersamento; label: string }[] = [
  { value: 'separata', label: 'Gestione separata' },
  { value: 'fissi', label: 'Fissi Art/Comm' },
  { value: 'eccedenza', label: 'Eccedenza Art/Comm' },
  { value: 'altro', label: 'Altro' },
]

const labelTipo = (t: TipoVersamento) => TIPI.find((x) => x.value === t)?.label ?? 'Altro'

/** Importo "dovuto" stimato per tipologia, usato come placeholder sensato. */
function dovutoPerTipo(calcoli: RisultatoCalcolo | null, tipo: TipoVersamento): number {
  if (!calcoli) return 0
  switch (tipo) {
    case 'separata': return calcoli.totaleContributiSeparata
    case 'fissi': return calcoli.totaleContributiFissiArtComm
    case 'eccedenza': return calcoli.totaleContributiEccedenzaArtComm
    default: return 0
  }
}

/**
 * Inserimento dei contributi versati nell'anno: o una cifra unica modificabile,
 * o una lista di versamenti la cui somma (non modificabile) è il valore usato.
 */
export function ContributiVersati({
  anno,
  calcoli,
  modalita,
  totale,
  dettaglio,
  onChangeModalita,
  onChangeTotale,
  onChangeDettaglio,
}: Props) {
  const somma = dettaglio.reduce((s, r) => s + (r.importo ?? 0), 0)

  const aggiungi = (tipo: TipoVersamento) =>
    onChangeDettaglio([...dettaglio, versamentoVuoto(tipo)])
  const rimuovi = (id: string) => onChangeDettaglio(dettaglio.filter((r) => r.id !== id))
  const aggiorna = (id: string, patch: Partial<VersamentoContributo>) =>
    onChangeDettaglio(dettaglio.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  return (
    <div className="space-y-4">
      {/* Selettore modalità */}
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
              <div className="grid flex-1 grid-cols-2 gap-2">
                <Select<TipoVersamento>
                  small
                  value={r.tipo}
                  onChange={(v) => aggiorna(r.id, { tipo: v })}
                  options={TIPI}
                />
                <MoneyInput
                  small
                  value={r.importo}
                  onChange={(v) => aggiorna(r.id, { importo: v })}
                  placeholder={
                    r.tipo === 'altro'
                      ? '0'
                      : `Dovuto: ${formatEuro(dovutoPerTipo(calcoli, r.tipo))}`
                  }
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

          {/* Aggiunta righe pre-etichettate */}
          <div className="flex flex-wrap gap-2">
            {TIPI.map((t) => (
              <Button key={t.value} color="light" size="xs" onClick={() => aggiungi(t.value)}>
                <Plus size={13} className="mr-1" />
                {t.label}
              </Button>
            ))}
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
