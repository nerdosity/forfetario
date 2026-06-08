import { Calendar } from 'lucide-react'
import type { RisultatoCalcolo, Scadenza } from '@/domain/types'
import { Card } from '@/components/ui'
import { formatEuro } from '@/domain/labels'
import { theme } from '@/theme'

interface Props {
  anno: number
  calcoli: RisultatoCalcolo
}

function ScadenzaCard({ scadenza, past }: { scadenza: Scadenza; past: boolean }) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        past
          ? 'border-red-200 bg-red-50 opacity-80'
          : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className={`font-semibold text-base ${past ? 'text-red-800' : 'text-slate-800'}`}>
            {scadenza.data}
          </div>
          <div className={`text-sm ${past ? 'text-red-700' : 'text-slate-600'}`}>
            {scadenza.descrizione}
          </div>
        </div>
        <div className={`font-bold text-lg tabular-nums whitespace-nowrap ${past ? 'text-red-700' : 'text-amber-700'}`}>
          {formatEuro(scadenza.importo)}
        </div>
      </div>

      {scadenza.componenti.length > 0 && (
        <div className={`rounded-md p-3 space-y-1 ${past ? 'bg-red-100' : 'bg-slate-50'}`}>
          <p className={theme.labelSmall}>Componenti</p>
          {scadenza.componenti.map((c, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-slate-600">· {c.tipo}</span>
              <span className="font-medium tabular-nums">{formatEuro(c.importo)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Calendario fiscale con scadenze dell'anno corrente e dell'anno successivo. */
export function CalendarioFiscale({ anno, calcoli }: Props) {
  const correnti = calcoli.scadenzeAnnoCorrente.filter((s) => s.importo > 0.005)
  const future = calcoli.scadenzeAnnoSuccessivo.filter((s) => s.importo > 0.005)

  return (
    <Card
      title="Calendario fiscale"
      icon={Calendar}
      iconIntent="warning"
      info="Le date indicate sono quelle nominali. Se cadono in giorni festivi o prefestivi slittano al primo giorno lavorativo utile."
    >
      {/* Anno corrente */}
      <div className="mb-6">
        <h3 className={`${theme.h3} mb-3`}>
          Scadenze {anno}
          <span className={`${theme.helpText} ml-2 font-normal`}>
            — pagamenti basati su {anno - 1}
          </span>
        </h3>
        <div className="space-y-3">
          {correnti.length > 0
            ? correnti.map((s, i) => <ScadenzaCard key={i} scadenza={s} past />)
            : <p className={theme.helpText}>Nessuna scadenza rilevante calcolata.</p>
          }
        </div>
      </div>

      {/* Anno successivo */}
      <div>
        <h3 className={`${theme.h3} mb-3`}>
          Scadenze {anno + 1}
          <span className={`${theme.helpText} ml-2 font-normal`}>
            — pagamenti basati su {anno}
          </span>
        </h3>
        <div className="space-y-3">
          {future.length > 0
            ? future.map((s, i) => <ScadenzaCard key={i} scadenza={s} past={false} />)
            : <p className={theme.helpText}>Nessuna scadenza rilevante calcolata.</p>
          }
        </div>
      </div>
    </Card>
  )
}
