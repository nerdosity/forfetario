import { History } from 'lucide-react'
import type { RisultatoCalcolo } from '@/domain/types'
import { Card, Metric } from '@/components/ui'
import { SankeyFlusso } from '@/components/SankeyFlusso'
import { formatEuro } from '@/domain/labels'
import { theme } from '@/theme'

interface Props {
  anno: number
  calcoli: RisultatoCalcolo
}

/** Riepilogo simulato dell'anno precedente, con funnel da fatturato a imposta. */
export function RiepilogoPrecedente({ anno, calcoli }: Props) {
  const prev = calcoli.datiAnnoPrecedente
  if (!prev) return null

  return (
    <Card title={`Riepilogo anno ${anno - 1}`} icon={History} iconIntent="neutral">
      {/* Il dettaglio per gestione è già nella legenda del diagramma: a lato
          resta solo il totale contributi, per non ripetere le stesse cifre. */}
      <div className="mb-5">
        <Metric
          featured
          value={formatEuro(prev.totaleContributiINPS)}
          label={`Contributi INPS ${anno - 1} dovuti`}
          valueIntent="info"
        />
      </div>

      <SankeyFlusso
        fatturato={prev.totaleFatturato}
        imponibileLordo={prev.totaleImponibileLordo}
        contributiINPS={prev.totaleContributiINPS}
        imposte={prev.totaleImposte}
        contributiSeparata={prev.totaleContributiSeparata}
        contributiFissiArtComm={prev.totaleContributiFissiArtComm}
        contributiEccedenzaArtComm={prev.totaleContributiEccedenzaArtComm}
      />

      <p className={`mt-5 border-t border-slate-100 pt-4 ${theme.helpText}`}>
        Riepilogo basato sui dati inseriti per il {anno - 1}. L'imposta è calcolata deducendo i
        contributi indicati come versati durante il {anno - 1}.
      </p>
    </Card>
  )
}
