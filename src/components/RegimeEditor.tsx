import { Plus, Trash2 } from 'lucide-react'
import type { Aliquota, Regime, RiduzioneContributi, TipoRegime } from '@/domain/types'
import { regimeVuoto } from '@/domain/regimeFactory'
import { NOMI_MESI, giorniPermanenza } from '@/domain/dates'
import { getMesiInPeriodo } from '@/domain/contributi'
import { labelTipo, formatEuro } from '@/domain/labels'
import { Field, NumberInput, MoneyInput, Select } from '@/components/ui'
import { theme } from '@/theme'

const TIPI: TipoRegime[] = ['separata', 'artigiani', 'commercianti']
const ALIQUOTE: Aliquota[] = [5, 15]
const COEFFICIENTI = [40, 54, 62, 67, 78, 86]

const RIDUZIONI: { value: RiduzioneContributi; label: string }[] = [
  { value: 'nessuna', label: 'Nessuna riduzione' },
  { value: '35', label: 'Riduzione 35% (forfettari)' },
  { value: '50', label: 'Riduzione 50% (altri casi)' },
]

interface RegimeEditorProps {
  titolo: string
  anno: number
  regimi: Regime[]
  onChange: (regimi: Regime[]) => void
  /** Mostra i campi periodo (mese/giorno inizio-fine). */
  mostraDate?: boolean
}

/** Editor riutilizzabile dei periodi/regimi di un anno. */
export function RegimeEditor({
  titolo,
  anno,
  regimi,
  onChange,
  mostraDate = false,
}: RegimeEditorProps) {
  const aggiungi = () => onChange([...regimi, regimeVuoto()])
  const rimuovi = (id: string) => onChange(regimi.filter((r) => r.id !== id))
  const aggiorna = <K extends keyof Regime>(id: string, campo: K, valore: Regime[K]) =>
    onChange(regimi.map((r) => (r.id === id ? { ...r, [campo]: valore } : r)))

  return (
    <div className={theme.sectionFlat}>
      <div className="flex items-center justify-between">
        <h3 className={theme.h3}>{titolo}</h3>
        <button type="button" onClick={aggiungi} className={theme.btnIcon} aria-label="Aggiungi periodo">
          <Plus size={18} aria-hidden />
        </button>
      </div>

      {regimi.map((regime, index) => (
        <div key={regime.id} className={theme.cardInner}>
          <div className="flex items-center justify-between">
            <span className={theme.labelSmall}>Periodo {index + 1}</span>
            {regimi.length > 1 && (
              <button
                type="button"
                onClick={() => rimuovi(regime.id)}
                className={theme.btnIconDanger}
                aria-label="Rimuovi periodo"
              >
                <Trash2 size={15} aria-hidden />
              </button>
            )}
          </div>

          <Field
            label="Tipo regime"
            small
            info="Gestione INPS: separata (percentuale flat sul reddito) oppure artigiani/commercianti (contributi fissi mensili più contributi sull'eccedenza del minimale)."
          >
            <Select<TipoRegime>
              small
              value={regime.tipo}
              onChange={(v) => aggiorna(regime.id, 'tipo', v)}
              options={TIPI.map((t) => ({ value: t, label: labelTipo(t) }))}
            />
          </Field>

          {regime.tipo !== 'separata' && (
            <Field
              label="Riduzione contributi"
              small
              info="Riduzione applicata alla sola quota IVS. La quota di maternità non è riducibile. 35%: regime forfettario ex L. 190/2014. 50%: altri casi di legge."
            >
              <Select<RiduzioneContributi>
                small
                value={regime.riduzioneContributi}
                onChange={(v) => aggiorna(regime.id, 'riduzioneContributi', v)}
                options={RIDUZIONI}
              />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Field
              label="Aliquota"
              small
              info="Imposta sostitutiva: 5% per le nuove attività nei primi 5 anni (se rispettati i requisiti), 15% a regime."
            >
              <Select<Aliquota>
                small
                value={regime.aliquota}
                onChange={(v) => aggiorna(regime.id, 'aliquota', v)}
                options={ALIQUOTE.map((a) => ({ value: a, label: `${a}%` }))}
              />
            </Field>
            <Field
              label="Coefficiente"
              small
              info="Coefficiente di redditività legato al codice ATECO: la percentuale del fatturato considerata reddito imponibile ai fini sia dell'imposta sia dei contributi."
            >
              <Select<number>
                small
                value={regime.coefficiente}
                onChange={(v) => aggiorna(regime.id, 'coefficiente', v)}
                options={COEFFICIENTI.map((c) => ({ value: c, label: `${c}%` }))}
              />
            </Field>
          </div>

          {mostraDate && (
            <div className="grid grid-cols-4 gap-2">
              <Field label="Da mese" small>
                <Select<number>
                  small
                  value={regime.meseInizio}
                  onChange={(v) => aggiorna(regime.id, 'meseInizio', v)}
                  options={NOMI_MESI.map((m, i) => ({ value: i + 1, label: m }))}
                />
              </Field>
              <Field label="Giorno" small>
                <NumberInput
                  small
                  value={regime.giornoInizio}
                  onChange={(v) => aggiorna(regime.id, 'giornoInizio', v ?? 1)}
                  min={1}
                  max={31}
                />
              </Field>
              <Field label="A mese" small>
                <Select<number>
                  small
                  value={regime.meseFine}
                  onChange={(v) => aggiorna(regime.id, 'meseFine', v)}
                  options={NOMI_MESI.map((m, i) => ({ value: i + 1, label: m }))}
                />
              </Field>
              <Field label="Giorno" small>
                <NumberInput
                  small
                  value={regime.giornoFine}
                  onChange={(v) => aggiorna(regime.id, 'giornoFine', v ?? 1)}
                  min={1}
                  max={31}
                />
              </Field>
            </div>
          )}

          <Field label="Fatturato periodo" small info="Compensi incassati nel periodo, al lordo di imposte e contributi.">
            <MoneyInput
              small
              value={regime.fatturato}
              onChange={(v) => aggiorna(regime.id, 'fatturato', v ?? 0)}
              min={0}
              step={1000}
            />
          </Field>

          {mostraDate && (
            <div className="rounded-md bg-white border border-slate-200 p-2 text-xs text-slate-500">
              <span>{labelTipo(regime.tipo)} · {regime.aliquota}% · </span>
              <span>
                {getMesiInPeriodo(
                  regime.meseInizio, regime.giornoInizio,
                  regime.meseFine, regime.giornoFine,
                )}{' '}
                mesi ({giorniPermanenza(
                  regime.meseInizio, regime.giornoInizio,
                  regime.meseFine, regime.giornoFine, anno,
                )} giorni)
              </span>
              <span> · imponibile {formatEuro((regime.fatturato * regime.coefficiente) / 100)}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
