import { History } from 'lucide-react'
import type { RisultatoCalcolo } from '@/domain/types'
import { Card, Metric } from '@/components/ui'
import { FunnelImposta } from '@/components/FunnelImposta'
import { formatEuro } from '@/domain/labels'
import { theme } from '@/theme'

interface Props {
  anno: number
  calcoli: RisultatoCalcolo
  contributiVersatiDuranteAnnoPrecedente: number | null
}

/** Riepilogo simulato dell'anno precedente, con funnel da fatturato a imposta. */
export function RiepilogoPrecedente({ anno, calcoli, contributiVersatiDuranteAnnoPrecedente }: Props) {
  const prev = calcoli.datiAnnoPrecedente
  if (!prev) return null

  const contributiBreakdown = [
    { label: 'Gestione separata', value: prev.totaleContributiSeparata },
    { label: 'Art/Comm fissi', value: prev.totaleContributiFissiArtComm },
    { label: 'Art/Comm eccedenza', value: prev.totaleContributiEccedenzaArtComm },
  ].filter((r) => r.value > 0.005)

  return (
    <Card title={`Riepilogo anno ${anno - 1}`} icon={History} iconIntent="neutral">
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <FunnelImposta
            fatturato={prev.totaleFatturato}
            imponibileLordo={prev.totaleImponibileLordo}
            imponibileNetto={prev.imponibileNettoTotalePerImposte}
            imposta={prev.totaleImposte}
            contributiDedotti={contributiVersatiDuranteAnnoPrecedente ?? 0}
          />
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
