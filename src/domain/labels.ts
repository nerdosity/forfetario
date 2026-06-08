import type { TipoRegime } from '@/domain/types'

export function labelTipo(tipo: TipoRegime): string {
  switch (tipo) {
    case 'separata':
      return 'Gestione Separata'
    case 'artigiani':
      return 'Artigiani'
    case 'commercianti':
      return 'Commercianti'
  }
}

export const formatEuro = (value: number | null | undefined): string =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value ?? 0)

export const formatPercent = (value: number, frazioni = 1): string =>
  `${value.toFixed(frazioni)}%`
