import { History } from 'lucide-react'
import type { RisultatoCalcolo } from '@/domain/types'
import { Card, SummaryRow } from '@/components/ui'

import { theme } from '@/theme'

interface Props {
  anno: number
  calcoli: RisultatoCalcolo
  contributiVersatiDuranteAnnoPrecedente: number | null
}

/** Riepilogo simulato dell'anno precedente, basato sui dati inseriti. */
export function RiepilogoPrecedente({ anno, calcoli, contributiVersatiDuranteAnnoPrecedente }: Props) {
  const prev = calcoli.datiAnnoPrecedente
  if (!prev) return null

  return (
    <Card title={`Riepilogo anno ${anno - 1}`} icon={History} iconIntent="info">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <SummaryRow label="Fatturato totale" value={prev.totaleFatturato} />
          <SummaryRow label="Imponibile lordo" value={prev.totaleImponibileLordo} />
          <SummaryRow
            label={`Contributi versati nel ${anno - 1} (deducibili)`}
            value={contributiVersatiDuranteAnnoPrecedente ?? 0}
            sign="-"
            valueIntent="warning"
          />
          <SummaryRow
            label="Imponibile netto per imposte"
            value={prev.imponibileNettoTotalePerImposte}
          />
          <SummaryRow
            label={`Imposta sostitutiva ${anno - 1} dovuta`}
            value={prev.totaleImposte}
            total
            valueIntent="cost"
          />
        </div>

        <div className="space-y-2">
          <SummaryRow label={`Contributi INPS ${anno - 1} dovuti`} value={prev.totaleContributiINPS} valueIntent="cost" />
          <div className="pl-3 space-y-1">
            <SummaryRow label="G.S." value={prev.totaleContributiSeparata} />
            <SummaryRow label="Art/Comm fissi" value={prev.totaleContributiFissiArtComm} />
            <SummaryRow label="Art/Comm eccedenza" value={prev.totaleContributiEccedenzaArtComm} />
          </div>
        </div>
      </div>

      <p className={`mt-4 ${theme.helpText}`}>
        Riepilogo basato sui dati inseriti per il {anno - 1}. L'imposta è calcolata deducendo i contributi indicati come versati durante il {anno - 1}.
      </p>
    </Card>
  )
}
