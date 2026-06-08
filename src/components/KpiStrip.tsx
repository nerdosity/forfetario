import type { RisultatoCalcolo } from '@/domain/types'
import { formatEuro } from '@/domain/labels'
import { theme } from '@/theme'

interface Props {
  anno: number
  calcoli: RisultatoCalcolo
}

interface Kpi {
  label: string
  value: string
  caption: string
  bg: string
}

/** Striscia di indicatori chiave a tiles piene colorate (stile Fiscozen). */
export function KpiStrip({ anno, calcoli }: Props) {
  const totaleSaldi =
    calcoli.saldoImposteDaVersareAnnoCorrente +
    calcoli.saldoContributiGSAnnoCorrente +
    calcoli.saldoContributiEccArtCommAnnoCorrente

  const kpis: Kpi[] = [
    {
      label: 'Fatturato',
      value: formatEuro(calcoli.totaleFatturato),
      caption: `Anno ${anno}`,
      bg: 'bg-emerald-500',
    },
    {
      label: 'Contributi INPS',
      value: formatEuro(calcoli.totaleContributiINPS),
      caption: 'Dovuti',
      bg: 'bg-sky-500',
    },
    {
      label: 'Imposta sostitutiva',
      value: formatEuro(calcoli.totaleImposte),
      caption: 'Dovuta',
      bg: 'bg-amber-400',
    },
    {
      label: 'Saldo da versare',
      value: formatEuro(totaleSaldi),
      caption: `Giugno ${anno + 1}`,
      bg: 'bg-rose-500',
    },
  ]

  return (
    <div className={theme.kpiStrip}>
      {kpis.map((k) => (
        <div key={k.label} className={`${theme.kpiTile} ${k.bg}`}>
          <p className={theme.kpiTileValue}>{k.value}</p>
          <p className={theme.kpiTileLabel}>{k.label}</p>
          <p className={theme.kpiTileCaption}>{k.caption}</p>
        </div>
      ))}
    </div>
  )
}
