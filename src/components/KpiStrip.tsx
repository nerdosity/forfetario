import { Wallet, Landmark, Receipt, CalendarClock } from 'lucide-react'
import type { ComponentType } from 'react'
import type { LucideProps } from 'lucide-react'
import type { RisultatoCalcolo } from '@/domain/types'
import { formatEuro } from '@/domain/labels'
import { theme, intent, type Intent } from '@/theme'

interface Props {
  anno: number
  calcoli: RisultatoCalcolo
}

interface Kpi {
  label: string
  value: string
  caption: string
  icon: ComponentType<LucideProps>
  tone: Intent
}

/** Striscia di indicatori chiave in cima alla pagina. */
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
      icon: Wallet,
      tone: 'income',
    },
    {
      label: 'Contributi INPS',
      value: formatEuro(calcoli.totaleContributiINPS),
      caption: 'Dovuti',
      icon: Landmark,
      tone: 'info',
    },
    {
      label: 'Imposta sostitutiva',
      value: formatEuro(calcoli.totaleImposte),
      caption: 'Dovuta',
      icon: Receipt,
      tone: 'warning',
    },
    {
      label: 'Saldo da versare',
      value: formatEuro(totaleSaldi),
      caption: `Giugno ${anno + 1}`,
      icon: CalendarClock,
      tone: 'cost',
    },
  ]

  return (
    <div className={theme.kpiStrip}>
      {kpis.map((k) => (
        <div key={k.label} className={theme.kpiCard}>
          <span className={`${theme.kpiIcon} ${intent[k.tone].badge}`}>
            <k.icon size={17} aria-hidden />
          </span>
          <p className={`${theme.kpiValue} ${intent[k.tone].amount}`}>{k.value}</p>
          <p className={theme.kpiLabel}>{k.label}</p>
          <p className={theme.kpiCaption}>{k.caption}</p>
        </div>
      ))}
    </div>
  )
}
