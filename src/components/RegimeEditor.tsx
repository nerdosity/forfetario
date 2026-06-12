import { Plus, Trash2, TriangleAlert } from 'lucide-react'
import type { Aliquota, Regime, RiduzioneContributi, TipoRegime } from '@/domain/types'
import { regimeVuoto } from '@/domain/regimeFactory'
import { NOMI_MESI, giorniPermanenza, giorniInMese, validaPeriodo } from '@/domain/dates'
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
}

/**
 * Editor riutilizzabile dei periodi/regimi di un anno. Le date di inizio/fine
 * periodo sono sempre richieste: il calcolo prorata i contributi sui giorni/mesi
 * di permanenza, quindi servono anche per l'anno precedente con più periodi.
 */
export function RegimeEditor({ titolo, anno, regimi, onChange }: RegimeEditorProps) {
  const aggiungi = () => onChange([...regimi, regimeVuoto()])
  const rimuovi = (id: string) => onChange(regimi.filter((r) => r.id !== id))
  const aggiorna = <K extends keyof Regime>(id: string, campo: K, valore: Regime[K]) =>
    onChange(regimi.map((r) => (r.id === id ? { ...r, [campo]: valore } : r)))

  // Cambiando il mese, riduce il giorno se eccede i giorni di quel mese (es. 31 → 28 a febbraio)
  const aggiornaMese = (id: string, campoMese: 'meseInizio' | 'meseFine', campoGiorno: 'giornoInizio' | 'giornoFine', mese: number) =>
    onChange(
      regimi.map((r) => {
        if (r.id !== id) return r
        const maxGiorno = giorniInMese(mese, anno)
        return { ...r, [campoMese]: mese, [campoGiorno]: Math.min(r[campoGiorno], maxGiorno) }
      }),
    )

  // Imposta un giorno limitandolo all'intervallo [1, giorni del mese]
  const aggiornaGiorno = (id: string, campoGiorno: 'giornoInizio' | 'giornoFine', mese: number, giorno: number) => {
    const maxGiorno = giorniInMese(mese, anno)
    aggiorna(id, campoGiorno, Math.max(1, Math.min(giorno, maxGiorno)))
  }

  return (
    <div className={theme.sectionFlat}>
      <div className="flex items-center justify-between">
        {titolo ? <h3 className={theme.h3}>{titolo}</h3> : <span className={theme.helpText}>Periodi</span>}
        <button type="button" onClick={aggiungi} className={theme.btnIcon} aria-label="Aggiungi periodo">
          <Plus size={18} aria-hidden />
        </button>
      </div>

      {regimi.map((regime, index) => {
        const erroreData = validaPeriodo(
          regime.meseInizio, regime.giornoInizio,
          regime.meseFine, regime.giornoFine, anno,
        )
        return (
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

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Field label="Da mese" small>
              <Select<number>
                small
                value={regime.meseInizio}
                onChange={(v) => aggiornaMese(regime.id, 'meseInizio', 'giornoInizio', v)}
                options={NOMI_MESI.map((m, i) => ({ value: i + 1, label: m }))}
              />
            </Field>
            <Field label="Giorno" small>
              <NumberInput
                small
                value={regime.giornoInizio}
                onChange={(v) => aggiornaGiorno(regime.id, 'giornoInizio', regime.meseInizio, v ?? 1)}
                min={1}
                max={giorniInMese(regime.meseInizio, anno)}
              />
            </Field>
            <Field label="A mese" small>
              <Select<number>
                small
                value={regime.meseFine}
                onChange={(v) => aggiornaMese(regime.id, 'meseFine', 'giornoFine', v)}
                options={NOMI_MESI.map((m, i) => ({ value: i + 1, label: m }))}
              />
            </Field>
            <Field label="Giorno" small>
              <NumberInput
                small
                value={regime.giornoFine}
                onChange={(v) => aggiornaGiorno(regime.id, 'giornoFine', regime.meseFine, v ?? 1)}
                min={1}
                max={giorniInMese(regime.meseFine, anno)}
              />
            </Field>
          </div>

          <Field
            label="Fatturato (compensi incassati nel periodo)"
            info="Totale dei compensi incassati nel periodo, al lordo di imposte e contributi. È il dato di partenza: l'imponibile si ottiene applicando il coefficiente di redditività."
          >
            <MoneyInput
              value={regime.fatturato}
              onChange={(v) => aggiorna(regime.id, 'fatturato', v ?? 0)}
              min={0}
              step={1000}
              placeholder="es. 30000"
            />
          </Field>

          {erroreData ? (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
              <span>{erroreData}</span>
            </div>
          ) : (
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
        )
      })}
    </div>
  )
}
