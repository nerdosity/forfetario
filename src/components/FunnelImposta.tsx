import { formatEuro } from '@/domain/labels'
import { theme } from '@/theme'

interface Props {
  fatturato: number
  /** Imponibile lordo (fatturato × coefficiente): il resto non è tassato. */
  imponibileLordo: number
  /** Contributi INPS dovuti nell'anno. */
  contributiINPS: number
  /** Imposta sostitutiva dovuta. */
  imposta: number
  titolo?: string
}

interface Uscita {
  label: string
  value: number
  /** Colore del ramo/etichetta. */
  color: string
  bg: string
}

/**
 * Diagramma di flusso (stile Sankey) "dove va il fatturato": una colonna
 * centrale che parte dal fatturato e si assottiglia; a ogni stadio un ramo
 * esce di lato con la quota che NON finisce in tasca (parte non imponibile,
 * contributi INPS, imposta). In fondo resta il guadagno netto effettivo.
 *
 *   Fatturato − quota non imponibile − INPS − imposta = Netto in tasca
 */
export function FunnelImposta({
  fatturato,
  imponibileLordo,
  contributiINPS,
  imposta,
  titolo = 'Dove va il fatturato',
}: Props) {
  const quotaNonImponibile = Math.max(0, fatturato - imponibileLordo)
  const nettoInTasca = Math.max(0, fatturato - contributiINPS - imposta)
  const max = Math.max(fatturato, 1)
  const pct = (v: number) => Math.max(0, Math.min(100, (v / max) * 100))
  const incidenzaNetto = fatturato > 0 ? (nettoInTasca / fatturato) * 100 : 0

  // Ogni "stadio" del flusso principale, col valore residuo che prosegue
  const flusso = [
    { label: 'Fatturato', residuo: fatturato, bar: 'bg-slate-400' },
    { label: 'Imponibile (tassabile)', residuo: imponibileLordo, bar: 'bg-blue-500' },
    { label: 'Dopo i contributi INPS', residuo: Math.max(0, imponibileLordo - contributiINPS), bar: 'bg-indigo-500' },
  ]

  // Le uscite "che cadono fuori", allineate agli stadi
  const uscite: (Uscita | null)[] = [
    quotaNonImponibile > 0.005
      ? { label: 'Quota non imponibile (coefficiente)', value: quotaNonImponibile, color: 'text-slate-500', bg: 'bg-slate-300' }
      : null,
    contributiINPS > 0.005
      ? { label: 'Contributi INPS', value: contributiINPS, color: 'text-amber-700', bg: 'bg-amber-400' }
      : null,
    imposta > 0.005
      ? { label: 'Imposta sostitutiva', value: imposta, color: 'text-rose-700', bg: 'bg-rose-500' }
      : null,
  ]

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className={theme.groupLabel}>{titolo}</h3>
        <span className="text-xs text-slate-400">In tasca {incidenzaNetto.toFixed(1)}% del fatturato</span>
      </div>

      <div className="space-y-0">
        {flusso.map((stadio, i) => {
          const uscita = uscite[i]
          const wRes = pct(stadio.residuo)
          return (
            <div key={stadio.label}>
              {/* Barra del flusso residuo */}
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">{stadio.label}</span>
                    <span className="text-sm font-semibold tabular-nums text-slate-700">{formatEuro(stadio.residuo)}</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${stadio.bar} transition-all`} style={{ width: `${wRes}%` }} />
                  </div>
                </div>
              </div>

              {/* Ramo che "cade fuori": freccia ↘ + importo che esce */}
              {uscita && (
                <div className="flex items-center gap-2 py-2 pl-4 sm:pl-6">
                  <span className="shrink-0 text-slate-300" aria-hidden>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path d="M4 4 v8 a4 4 0 0 0 4 4 h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="m14 12 5 4-5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${uscita.bg}`} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-500">{uscita.label}</span>
                  <span className={`shrink-0 text-sm font-semibold tabular-nums ${uscita.color}`}>− {formatEuro(uscita.value)}</span>
                </div>
              )}
            </div>
          )
        })}

        {/* Risultato: guadagno netto in tasca */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-emerald-800">Guadagno netto in tasca</p>
            <p className="text-xs text-emerald-600/80">Fatturato − contributi INPS − imposta</p>
          </div>
          <p className="text-lg font-bold tabular-nums text-emerald-700 sm:text-xl">{formatEuro(nettoInTasca)}</p>
        </div>
      </div>
    </div>
  )
}
