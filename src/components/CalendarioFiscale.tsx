import { Calendar } from 'lucide-react'
import type { RisultatoCalcolo, Scadenza } from '@/domain/types'
import { Card, Tooltip } from '@/components/ui'
import { formatEuro } from '@/domain/labels'
import { theme } from '@/theme'

interface Props {
  anno: number
  calcoli: RisultatoCalcolo
}

const MESE_NUM: Record<string, number> = {
  Gennaio: 0, Febbraio: 1, Marzo: 2, Aprile: 3, Maggio: 4, Giugno: 5,
  Luglio: 6, Agosto: 7, Settembre: 8, Ottobre: 9, Novembre: 10, Dicembre: 11,
}

type Stato = 'scaduta' | 'in-scadenza' | 'prevista'

const STATO_LABEL: Record<Stato, string> = {
  scaduta: 'Scaduta',
  'in-scadenza': 'In scadenza',
  prevista: 'Prevista',
}
const STATO_BADGE: Record<Stato, string> = {
  scaduta: 'bg-rose-100 text-rose-700',
  'in-scadenza': 'bg-amber-100 text-amber-700',
  prevista: 'bg-sky-100 text-sky-700',
}

/** Determina lo stato di una scadenza rispetto a oggi (>30gg futura = prevista). */
function statoScadenza(data: string): Stato {
  const [gg, mese, aaaa] = data.split(' ')
  const d = new Date(Number(aaaa), MESE_NUM[mese] ?? 0, Number(gg))
  const oggi = new Date()
  oggi.setHours(0, 0, 0, 0)
  if (d < oggi) return 'scaduta'
  const giorniMancanti = (d.getTime() - oggi.getTime()) / 86_400_000
  return giorniMancanti <= 30 ? 'in-scadenza' : 'prevista'
}

/** Mostra il dettaglio componenti solo se aggiunge informazione. */
function dettaglioUtile(s: Scadenza): string | null {
  if (s.componenti.length > 1 || (s.componenti.length === 1 && Math.abs(s.componenti[0].importo - s.importo) > 0.005)) {
    return s.componenti.map((c) => `${c.tipo}: ${formatEuro(c.importo)}`).join('\n')
  }
  return null
}

function RigaScadenza({ scadenza }: { scadenza: Scadenza }) {
  const stato = statoScadenza(scadenza.data)
  const dettaglio = dettaglioUtile(scadenza)
  const scaduta = stato === 'scaduta'

  return (
    <tr className={theme.tableRow}>
      <td className={theme.tableCell}>
        <div className="flex items-center gap-1.5">
          <span className={`font-medium ${scaduta ? 'text-slate-400' : 'text-slate-800'}`}>
            {scadenza.descrizione}
          </span>
          {dettaglio && <Tooltip content={dettaglio} label="Dettaglio componenti" />}
        </div>
      </td>
      <td className={theme.tableCell}>
        <span className={`${theme.statusBadge} ${STATO_BADGE[stato]}`}>{STATO_LABEL[stato]}</span>
      </td>
      <td className={`${theme.tableCell} text-right tabular-nums font-semibold ${scaduta ? 'text-slate-400' : 'text-slate-800'}`}>
        {formatEuro(scadenza.importo)}
      </td>
      <td className={`${theme.tableCell} whitespace-nowrap text-right tabular-nums ${scaduta ? 'text-slate-400' : 'text-slate-600'}`}>
        {scadenza.data}
      </td>
    </tr>
  )
}

function TabellaScadenze({ titolo, sottotitolo, scadenze }: {
  titolo: string
  sottotitolo?: string
  scadenze: Scadenza[]
}) {
  const totale = scadenze.reduce((s, x) => s + x.importo, 0)
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="flex items-baseline gap-2">
          <span className={theme.h3}>{titolo}</span>
          {sottotitolo && <span className={`${theme.helpText} font-normal`}>{sottotitolo}</span>}
        </h3>
        {scadenze.length > 0 && (
          <span className="text-xs text-slate-400">Totale {formatEuro(totale)}</span>
        )}
      </div>

      {scadenze.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className={theme.table}>
            <thead className={theme.tableHead}>
              <tr>
                <th className={theme.tableHeadCell}>Adempimento</th>
                <th className={theme.tableHeadCell}>Stato</th>
                <th className={`${theme.tableHeadCell} text-right`}>Importo</th>
                <th className={`${theme.tableHeadCell} text-right`}>Scadenza</th>
              </tr>
            </thead>
            <tbody>
              {scadenze.map((s, i) => <RigaScadenza key={i} scadenza={s} />)}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={theme.helpText}>Nessuna scadenza rilevante calcolata.</p>
      )}
    </div>
  )
}

/** Calendario fiscale: adempimenti dell'anno corrente e del successivo in tabella. */
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
        <TabellaScadenze titolo={`Scadenze ${anno}`} scadenze={correnti} />
        <TabellaScadenze
          titolo={`Scadenze ${anno + 1}`}
          sottotitolo={`— saldo e acconti su ${anno}`}
          scadenze={future}
        />
      </div>
    </Card>
  )
}
