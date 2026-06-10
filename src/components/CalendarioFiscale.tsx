import { Calendar } from 'lucide-react'
import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from 'flowbite-react'
import type { CalcoloInput, RisultatoCalcolo, Scadenza } from '@/domain/types'
import { scadenzaPagata, versatoPerScadenza, bilancioPagamenti, type BilancioCategoria } from '@/domain/scadenze'
import { Card, Tooltip } from '@/components/ui'
import { formatEuro } from '@/domain/labels'
import { theme } from '@/theme'

interface Props {
  anno: number
  calcoli: RisultatoCalcolo
  input: CalcoloInput
}

const MESE_NUM: Record<string, number> = {
  Gennaio: 0, Febbraio: 1, Marzo: 2, Aprile: 3, Maggio: 4, Giugno: 5,
  Luglio: 6, Agosto: 7, Settembre: 8, Ottobre: 9, Novembre: 10, Dicembre: 11,
}

type Stato = 'pagata' | 'scaduta' | 'in-scadenza' | 'prevista'

const STATO_LABEL: Record<Stato, string> = {
  pagata: 'Pagata',
  scaduta: 'Scaduta',
  'in-scadenza': 'In scadenza',
  prevista: 'Prevista',
}
const STATO_COLOR = {
  pagata: 'success',
  scaduta: 'failure',
  'in-scadenza': 'warning',
  prevista: 'info',
} as const

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

/** Riga del bilancio: categoria + dovuto/pagato + badge saldo (più/meno/in pari). */
function RigaBilancio({ etichetta, cat }: { etichetta: string; cat: BilancioCategoria }) {
  if (cat.dovuto < 0.005 && cat.pagato < 0.005) return null
  const inPari = Math.abs(cat.saldo) <= 1 // entro arrotondamento
  const colore = inPari ? 'success' : cat.saldo > 0 ? 'warning' : 'failure'
  const testo = inPari
    ? 'In pari'
    : cat.saldo > 0
      ? `+ ${formatEuro(cat.saldo)} in più`
      : `− ${formatEuro(-cat.saldo)} in meno`
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
      <span className="text-slate-600">{etichetta}</span>
      <span className="flex items-center gap-3">
        <span className="text-xs text-slate-400">
          dovuto {formatEuro(cat.dovuto)} · pagato {formatEuro(cat.pagato)}
        </span>
        <Badge color={colore} className="w-fit">{testo}</Badge>
      </span>
    </div>
  )
}

function TabellaScadenze({ titolo, sottotitolo, scadenze, input, mostraBilancio }: {
  titolo: string
  sottotitolo?: string
  scadenze: Scadenza[]
  input: CalcoloInput
  mostraBilancio?: boolean
}) {
  const totale = scadenze.reduce((s, x) => s + x.importo, 0)
  const bilancio = bilancioPagamenti(scadenze, input)
  const hasBilancio =
    mostraBilancio &&
    (bilancio.contributi.dovuto > 0.005 || bilancio.imposte.dovuto > 0.005)

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
        <div className="overflow-x-auto">
          <Table hoverable>
            <TableHead>
              <TableRow>
                <TableHeadCell>Adempimento</TableHeadCell>
                <TableHeadCell>Stato</TableHeadCell>
                <TableHeadCell className="text-right">Dovuto</TableHeadCell>
                <TableHeadCell className="text-right">Pagato</TableHeadCell>
                <TableHeadCell className="text-right">Differenza</TableHeadCell>
                <TableHeadCell className="text-right">Scadenza</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody className="divide-y">
              {scadenze.map((s, i) => {
                const versato = versatoPerScadenza(s, input) // null = non tracciabile
                const pagata = scadenzaPagata(s, input)
                const stato: Stato = pagata ? 'pagata' : statoScadenza(s.data)
                const dettaglio = dettaglioUtile(s)
                const tenue = pagata || stato === 'scaduta'
                const testo = pagata ? 'text-slate-400 line-through' : tenue ? 'text-slate-400' : 'text-slate-800'
                // Differenza dovuto − pagato. Entro ±1 € è solo arrotondamento (F24
                // si paga all'euro): si mostra in verde, non come mancanza/eccedenza.
                const diff = versato == null ? null : s.importo - versato
                const entroArrotond = diff != null && Math.abs(diff) <= 1
                const diffClasse =
                  diff == null ? 'text-slate-300'
                  : entroArrotond ? 'text-emerald-600'
                  : diff > 0 ? 'text-rose-600'
                  : 'text-amber-600'
                const diffTesto =
                  diff == null ? '—'
                  : Math.abs(diff) < 0.005 ? '0,00 €'
                  : diff > 0 ? `− ${formatEuro(diff)}` : `+ ${formatEuro(-diff)}`
                return (
                  <TableRow key={i} className="bg-white">
                    <TableCell className={`font-medium ${testo}`}>
                      <span className="inline-flex items-center gap-1.5">
                        {s.descrizione}
                        {s.stimata && (
                          <Tooltip
                            content={`Importo e data sono una proiezione basata sulle costanti dell'anno corrente: i valori ufficiali ${s.annoScadenza} non sono ancora disponibili.`}
                            label="Valore stimato"
                          />
                        )}
                        {dettaglio && <Tooltip content={dettaglio} label="Dettaglio componenti" />}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge color={s.stimata ? 'gray' : STATO_COLOR[stato]} className="w-fit">
                        {s.stimata ? 'Stima' : STATO_LABEL[stato]}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right tabular-nums ${tenue ? 'text-slate-400' : 'text-slate-700'}`}>
                      {s.stimata ? '≈ ' : ''}{formatEuro(s.importo)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-600">
                      {versato == null ? '—' : formatEuro(versato)}
                    </TableCell>
                    <TableCell className={`text-right font-semibold tabular-nums ${diffClasse}`}>
                      {diffTesto}
                    </TableCell>
                    <TableCell className={`whitespace-nowrap text-right tabular-nums ${tenue ? 'text-slate-400' : 'text-slate-600'}`}>
                      {s.data}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className={theme.helpText}>Nessuna scadenza rilevante calcolata.</p>
      )}

      {/* Bilancio dell'anno: quanto versato in più/meno rispetto al dovuto */}
      {hasBilancio && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className={`${theme.groupLabel} mb-1`}>Bilancio pagamenti {titolo.replace('Scadenze ', '')}</p>
          <div className="divide-y divide-slate-200/70">
            <RigaBilancio etichetta="Contributi INPS" cat={bilancio.contributi} />
            <RigaBilancio etichetta="Imposta sostitutiva" cat={bilancio.imposte} />
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Calcolato sulle voci con un versamento collegato. Differenze entro ~1 € sono arrotondamenti F24.
          </p>
        </div>
      )}
    </div>
  )
}

/** Calendario fiscale: adempimenti dell'anno corrente e del successivo in tabella. */
export function CalendarioFiscale({ anno, calcoli, input }: Props) {
  const correnti = calcoli.scadenzeAnnoCorrente.filter((s) => s.importo > 0.005)
  const future = calcoli.scadenzeAnnoSuccessivo.filter((s) => s.importo > 0.005)

  return (
    <Card
      title="Calendario fiscale"
      icon={Calendar}
      iconIntent="warning"
      info="Le date indicate sono quelle nominali. Se cadono in giorni festivi o prefestivi slittano al primo giorno lavorativo utile. Le voci già coperte da un versamento inserito appaiono barrate."
    >
      <div className="space-y-8">
        <TabellaScadenze titolo={`Scadenze ${anno}`} scadenze={correnti} input={input} mostraBilancio />
        <TabellaScadenze
          titolo={`Scadenze ${anno + 1}`}
          sottotitolo={`— saldo e acconti su ${anno}`}
          scadenze={future}
          input={input}
        />
      </div>
    </Card>
  )
}
