import { Calendar } from 'lucide-react'
import type { RisultatoCalcolo, Scadenza } from '@/domain/types'
import { Card } from '@/components/ui'
import { formatEuro } from '@/domain/labels'
import { theme } from '@/theme'

interface Props {
  anno: number
  calcoli: RisultatoCalcolo
}

const ABBR_MESE: Record<string, string> = {
  Gennaio: 'GEN', Febbraio: 'FEB', Marzo: 'MAR', Aprile: 'APR', Maggio: 'MAG', Giugno: 'GIU',
  Luglio: 'LUG', Agosto: 'AGO', Settembre: 'SET', Ottobre: 'OTT', Novembre: 'NOV', Dicembre: 'DIC',
}

/** Estrae giorno e abbreviazione mese da "GG Mese AAAA". */
function parseData(data: string): { giorno: string; mese: string } {
  const [gg, mese] = data.split(' ')
  return { giorno: gg, mese: ABBR_MESE[mese] ?? mese?.slice(0, 3).toUpperCase() ?? '' }
}

/**
 * Una scadenza mostra il dettaglio componenti solo se aggiunge informazione:
 * più di una componente, oppure una sola ma con importo diverso dal totale.
 */
function haDettaglioUtile(s: Scadenza): boolean {
  if (s.componenti.length > 1) return true
  if (s.componenti.length === 1) return Math.abs(s.componenti[0].importo - s.importo) > 0.005
  return false
}

function VoceScadenza({ scadenza, past }: { scadenza: Scadenza; past: boolean }) {
  const { giorno, mese } = parseData(scadenza.data)
  return (
    <li className="flex gap-4">
      {/* Blocco data tipo calendario */}
      <div
        className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border ${
          past ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-700'
        }`}
      >
        <span className="text-lg font-bold leading-none tabular-nums">{giorno}</span>
        <span className="mt-0.5 text-[10px] font-semibold tracking-wide">{mese}</span>
      </div>

      {/* Contenuto */}
      <div className="min-w-0 flex-1 border-b border-slate-100 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800">{scadenza.descrizione}</p>
            <p className="text-xs text-slate-400">{scadenza.data}</p>
          </div>
          <span className={`shrink-0 text-base font-bold tabular-nums ${past ? 'text-red-700' : 'text-amber-700'}`}>
            {formatEuro(scadenza.importo)}
          </span>
        </div>

        {haDettaglioUtile(scadenza) && (
          <ul className="mt-2 space-y-1 rounded-md bg-slate-50 px-3 py-2">
            {scadenza.componenti.map((c, i) => (
              <li key={i} className="flex justify-between text-xs">
                <span className="text-slate-500">{c.tipo}</span>
                <span className="font-medium tabular-nums text-slate-700">{formatEuro(c.importo)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  )
}

function GruppoAnno({ titolo, sottotitolo, scadenze, past }: {
  titolo: string
  sottotitolo?: string
  scadenze: Scadenza[]
  past: boolean
}) {
  const totale = scadenze.reduce((s, x) => s + x.importo, 0)
  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="flex items-baseline gap-2">
          <span className={theme.h3}>{titolo}</span>
          {sottotitolo && <span className={`${theme.helpText} font-normal`}>{sottotitolo}</span>}
        </h3>
        {scadenze.length > 0 && (
          <span className="text-xs text-slate-400">
            {scadenze.length} scaden{scadenze.length > 1 ? 'ze' : 'za'} · {formatEuro(totale)}
          </span>
        )}
      </div>
      {scadenze.length > 0 ? (
        <ul className="space-y-4">
          {scadenze.map((s, i) => <VoceScadenza key={i} scadenza={s} past={past} />)}
        </ul>
      ) : (
        <p className={theme.helpText}>Nessuna scadenza rilevante calcolata.</p>
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
      <div className="space-y-8">
        <GruppoAnno titolo={`Scadenze ${anno}`} scadenze={correnti} past />
        <GruppoAnno
          titolo={`Scadenze ${anno + 1}`}
          sottotitolo={`— saldo e acconti su ${anno}`}
          scadenze={future}
          past={false}
        />
      </div>
    </Card>
  )
}
