import { History } from 'lucide-react'
import type { RisultatoCalcolo } from '@/domain/types'
import { Card, Metric } from '@/components/ui'
import { formatEuro } from '@/domain/labels'
import { theme } from '@/theme'

interface Props {
  anno: number
  calcoli: RisultatoCalcolo
  contributiVersatiDuranteAnnoPrecedente: number | null
}

interface Stage {
  label: string
  value: number
  /** Classe di sfondo della barra. */
  bar: string
  /** Classe del testo del valore. */
  text: string
}

/** Riepilogo simulato dell'anno precedente, con funnel da fatturato a imposta. */
export function RiepilogoPrecedente({ anno, calcoli, contributiVersatiDuranteAnnoPrecedente }: Props) {
  const prev = calcoli.datiAnnoPrecedente
  if (!prev) return null

  const deducibili = contributiVersatiDuranteAnnoPrecedente ?? 0

  // Funnel: ogni stadio è una frazione del fatturato, mostrato come barra in scala.
  const max = Math.max(prev.totaleFatturato, 1)
  const stages: Stage[] = [
    { label: 'Fatturato', value: prev.totaleFatturato, bar: 'bg-emerald-500', text: 'text-emerald-700' },
    { label: 'Imponibile lordo', value: prev.totaleImponibileLordo, bar: 'bg-blue-500', text: 'text-blue-700' },
    { label: 'Imponibile netto', value: prev.imponibileNettoTotalePerImposte, bar: 'bg-indigo-500', text: 'text-indigo-700' },
    { label: 'Imposta sostitutiva', value: prev.totaleImposte, bar: 'bg-red-500', text: 'text-red-700' },
  ]

  const pct = (v: number) => `${Math.max(2, Math.min(100, (v / max) * 100))}%`
  const incidenza = prev.totaleFatturato > 0 ? (prev.totaleImposte / prev.totaleFatturato) * 100 : 0

  const contributiBreakdown = [
    { label: 'Gestione separata', value: prev.totaleContributiSeparata },
    { label: 'Art/Comm fissi', value: prev.totaleContributiFissiArtComm },
    { label: 'Art/Comm eccedenza', value: prev.totaleContributiEccedenzaArtComm },
  ].filter((r) => r.value > 0.005)

  return (
    <Card title={`Riepilogo anno ${anno - 1}`} icon={History} iconIntent="neutral">
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Funnel */}
        <div className="lg:col-span-3">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className={theme.groupLabel}>Dal fatturato all'imposta</h3>
            <span className="text-xs text-slate-400">
              Incidenza imposta {incidenza.toFixed(1)}%
            </span>
          </div>

          <div className="space-y-2.5">
            {stages.map((s) => (
              <div key={s.label}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600">{s.label}</span>
                  <span className={`text-sm font-semibold tabular-nums ${s.text}`}>{formatEuro(s.value)}</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${s.bar} transition-all`} style={{ width: pct(s.value) }} />
                </div>
              </div>
            ))}
          </div>

          {deducibili > 0.005 && (
            <p className="mt-3 text-xs text-amber-700">
              Include {formatEuro(deducibili)} di contributi dedotti dall'imponibile.
            </p>
          )}
        </div>

        {/* Riepilogo contributi a lato */}
        <div className="lg:col-span-2">
          <Metric
            featured
            value={formatEuro(prev.totaleContributiINPS)}
            label={`Contributi INPS ${anno - 1} dovuti`}
            valueIntent="info"
          />
          {contributiBreakdown.length > 0 && (
            <div className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 px-3">
              {contributiBreakdown.map((r) => (
                <div key={r.label} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-600">{r.label}</span>
                  <span className="font-medium tabular-nums text-slate-800">{formatEuro(r.value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className={`mt-5 border-t border-slate-100 pt-4 ${theme.helpText}`}>
        Riepilogo basato sui dati inseriti per il {anno - 1}. L'imposta è calcolata deducendo i
        contributi indicati come versati durante il {anno - 1}.
      </p>
    </Card>
  )
}
