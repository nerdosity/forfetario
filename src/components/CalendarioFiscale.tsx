import { useState } from 'react'
import { Calendar, CalendarClock } from 'lucide-react'
import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from 'flowbite-react'
import type { CalcoloInput, OpzioniRateazione, RisultatoCalcolo, Scadenza } from '@/domain/types'
import { scadenzaPagata, versatoPerScadenza, bilancioPagamenti, type BilancioCategoria } from '@/domain/scadenze'
import { Card, Tooltip } from '@/components/ui'
import { RateazioneModal } from '@/components/RateazioneModal'
import { formatEuro } from '@/domain/labels'
import { theme, tableTheme } from '@/theme'

interface Props {
  anno: number
  calcoli: RisultatoCalcolo
  input: CalcoloInput
  /** Salva (o rimuove, con null) la scelta di rateazione per una chiave. */
  onRateazioneChange?: (chiave: string, opzioni: OpzioniRateazione | null) => void
}

const MESE_NUM: Record<string, number> = {
  Gennaio: 0, Febbraio: 1, Marzo: 2, Aprile: 3, Maggio: 4, Giugno: 5,
  Luglio: 6, Agosto: 7, Settembre: 8, Ottobre: 9, Novembre: 10, Dicembre: 11,
}

const MESE_BREVE: Record<string, string> = {
  Gennaio: 'GEN', Febbraio: 'FEB', Marzo: 'MAR', Aprile: 'APR', Maggio: 'MAG', Giugno: 'GIU',
  Luglio: 'LUG', Agosto: 'AGO', Settembre: 'SET', Ottobre: 'OTT', Novembre: 'NOV', Dicembre: 'DIC',
}

/**
 * Colori per tipo di scadenza: ambra=fissi, viola=eccedenza, teal=GS, indaco=imposte.
 * Restituisce le classi Tailwind per bg, testo e bordo del bollino.
 */
function coloreCategoria(categoria: string | undefined, tenue: boolean): { bg: string; giorno: string; mese: string } {
  if (tenue) return { bg: 'bg-slate-100', giorno: 'text-slate-400', mese: 'text-slate-400' }
  if (!categoria) return { bg: 'bg-slate-100', giorno: 'text-slate-500', mese: 'text-slate-400' }
  if (/fissi/i.test(categoria))     return { bg: 'bg-amber-50',   giorno: 'text-amber-700',  mese: 'text-amber-500' }
  if (/eccedenza/i.test(categoria)) return { bg: 'bg-violet-50',  giorno: 'text-violet-700', mese: 'text-violet-500' }
  if (/separata/i.test(categoria))  return { bg: 'bg-teal-50',    giorno: 'text-teal-700',   mese: 'text-teal-500' }
  if (/imposta/i.test(categoria))   return { bg: 'bg-indigo-50',  giorno: 'text-indigo-700', mese: 'text-indigo-500' }
  return { bg: 'bg-slate-100', giorno: 'text-slate-500', mese: 'text-slate-400' }
}

/** Bollino data calendario: giorno grande + mese anno piccolo. */
function BollinoData({ data, categoria, tenue }: { data: string; categoria: string | undefined; tenue: boolean }) {
  const [gg, mese, aaaa] = data.split(' ')
  const c = coloreCategoria(categoria, tenue)
  return (
    <span className={`inline-flex flex-col items-center justify-center rounded-lg px-2.5 py-1 ${c.bg} min-w-[3rem]`}>
      <span className={`text-lg font-bold leading-none tabular-nums ${c.giorno}`}>{gg}</span>
      <span className={`text-[0.6rem] font-semibold uppercase leading-tight tracking-wide ${c.mese}`}>
        {MESE_BREVE[mese] ?? mese} {aaaa}
      </span>
    </span>
  )
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

/**
 * Riga di una componente del dettaglio. Le componenti NEGATIVE sono voci che si
 * sottraggono dal dovuto (tipicamente gli acconti già versati): si rendono con
 * il segno meno staccato e il valore assoluto, così si leggono come una
 * detrazione e non come un importo negativo da versare.
 */
function rigaComponente(c: { tipo: string; importo: number }): string {
  return c.importo < -0.005
    ? `${c.tipo}: − ${formatEuro(-c.importo)}`
    : `${c.tipo}: ${formatEuro(c.importo)}`
}

/**
 * Mostra il dettaglio componenti solo se aggiunge informazione. Con più
 * componenti si chiude con il totale, così il conto (dovuto − detrazioni) è
 * verificabile a colpo d'occhio.
 */
function dettaglioUtile(s: Scadenza): string | null {
  if (s.componenti.length > 1) {
    return [
      ...s.componenti.map(rigaComponente),
      `Totale da versare: ${formatEuro(s.importo)}`,
    ].join('\n')
  }
  if (s.componenti.length === 1 && Math.abs(s.componenti[0].importo - s.importo) > 0.005) {
    return rigaComponente(s.componenti[0])
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
      : `- ${formatEuro(-cat.saldo)} in meno`
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1.5 text-sm">
      <span className="font-medium text-slate-600">{etichetta}</span>
      <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
        <span className="text-xs text-slate-400">
          dovuto {formatEuro(cat.dovuto)} · pagato {formatEuro(cat.pagato)}
        </span>
        <Badge color={colore} className="w-fit">{testo}</Badge>
      </span>
    </div>
  )
}

function TabellaScadenze({ titolo, sottotitolo, scadenze, input, mostraBilancio, onRateizza }: {
  titolo: string
  sottotitolo?: string
  scadenze: Scadenza[]
  input: CalcoloInput
  mostraBilancio?: boolean
  /** Apre il popup di rateazione per la scadenza (presente solo se gestita). */
  onRateizza?: (scadenza: Scadenza) => void
}) {
  const totale = scadenze.reduce((s, x) => s + x.importo, 0)
  const bilancio = bilancioPagamenti(scadenze, input)
  const hasBilancio =
    mostraBilancio &&
    (bilancio.artComm.dovuto > 0.005 || bilancio.gs.dovuto > 0.005 || bilancio.imposte.dovuto > 0.005)
  // Colonna rateazione: solo se almeno una voce della tabella è rateizzabile.
  const hasRateazione = !!onRateizza && scadenze.some((s) => s.chiaveRateazione)

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
        <div>
          <Table hoverable theme={tableTheme}>
            <TableHead>
              <TableRow>
                <TableHeadCell>Adempimento</TableHeadCell>
                {hasRateazione && <TableHeadCell className="w-12 text-center">Rate</TableHeadCell>}
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
                // Differenza dovuto - pagato. Entro ±1 € è solo arrotondamento (F24
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
                  : diff > 0 ? `- ${formatEuro(diff)}` : `+ ${formatEuro(-diff)}`
                return (
                  <TableRow key={i} className="bg-white">
                    <TableCell className={testo}>
                      <span className="flex items-center gap-1.5">
                        <span className="flex flex-col">
                          {s.categoria ? (
                            <>
                              <span className="font-semibold leading-tight">{s.categoria}</span>
                              {s.voce && <span className="text-xs font-normal text-slate-500 leading-tight">{s.voce}</span>}
                            </>
                          ) : (
                            <span className="font-medium">{s.descrizione}</span>
                          )}
                        </span>
                        {s.stimata && (
                          <Tooltip
                            content={`Importo e data sono una proiezione basata sulle costanti dell'anno corrente: i valori ufficiali ${s.annoScadenza} non sono ancora disponibili.`}
                            label="Valore stimato"
                          />
                        )}
                        {dettaglio && <Tooltip content={dettaglio} label="Dettaglio componenti" />}
                        {s.nota && <Tooltip content={s.nota} label="Come è calcolato l'importo" />}
                      </span>
                    </TableCell>
                    {hasRateazione && (
                      <TableCell className="text-center">
                        {/* Niente rateazione su voci già pagate: il versamento è chiuso. */}
                        {s.chiaveRateazione && onRateizza && !pagata && (
                          <button
                            type="button"
                            onClick={() => onRateizza(s)}
                            title={
                              input.rateazioniImposta[s.chiaveRateazione]
                                ? 'Modifica la rateazione del versamento'
                                : 'Rateizza il versamento'
                            }
                            aria-label="Rateizza il versamento"
                            className={
                              input.rateazioniImposta[s.chiaveRateazione]
                                ? theme.btnIconOutlineActive
                                : theme.btnIconOutline
                            }
                          >
                            <CalendarClock size={16} aria-hidden />
                          </button>
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge color={s.stimata ? 'gray' : STATO_COLOR[stato]} className="w-fit">
                        {s.stimata ? 'Stima' : STATO_LABEL[stato]}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right tabular-nums ${tenue ? 'text-slate-400' : 'text-slate-700'}`}>
                      {s.stimata ? '≈ ' : ''}{formatEuro(s.importo)}
                      {s.importoConsigliato != null && (
                        <span className="mt-0.5 flex items-center justify-end gap-1 text-xs font-medium text-blue-600">
                          Consigliato {s.importoConsigliato > 0 ? formatEuro(s.importoConsigliato) : '0,00 € (a credito)'}
                          {s.notaConsigliato && (
                            <Tooltip content={s.notaConsigliato} label="Perché consigliato" posizione="sotto" allinea="sinistra" />
                          )}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-600">
                      {versato == null ? '—' : formatEuro(versato)}
                    </TableCell>
                    <TableCell className={`text-right font-semibold tabular-nums ${diffClasse}`}>
                      {diffTesto}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        <BollinoData data={s.data} categoria={s.categoria} tenue={tenue} />
                      </div>
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
            <RigaBilancio etichetta="Contributi artigiani/commercianti" cat={bilancio.artComm} />
            <RigaBilancio etichetta="Contributi gestione separata" cat={bilancio.gs} />
            <RigaBilancio etichetta="Imposta sostitutiva" cat={bilancio.imposte} />
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Calcolato sulle voci con un versamento collegato, separato per gestione (il conguaglio INPS
            si applica per gestione). Differenze entro ~1 € sono arrotondamenti F24.
          </p>
        </div>
      )}
    </div>
  )
}

/** Calendario fiscale: adempimenti dell'anno corrente e del successivo in tabella. */
export function CalendarioFiscale({ anno, calcoli, input, onRateazioneChange }: Props) {
  const correnti = calcoli.scadenzeAnnoCorrente.filter((s) => s.importo > 0.005)
  const future = calcoli.scadenzeAnnoSuccessivo.filter((s) => s.importo > 0.005)

  // Scadenza per cui è aperto il popup di rateazione (null = chiuso).
  const [daRateizzare, setDaRateizzare] = useState<Scadenza | null>(null)
  const onRateizza = onRateazioneChange ? setDaRateizzare : undefined

  return (
    <Card
      title="Calendario fiscale"
      icon={Calendar}
      iconIntent="warning"
      info="Le date indicate sono quelle nominali. Se cadono in giorni festivi o prefestivi slittano al primo giorno lavorativo utile. Le voci già coperte da un versamento inserito appaiono barrate."
    >
      <div className="space-y-8">
        <TabellaScadenze
          titolo={`Scadenze ${anno}`}
          scadenze={correnti}
          input={input}
          mostraBilancio
          onRateizza={onRateizza}
        />
        <TabellaScadenze
          titolo={`Scadenze ${anno + 1}`}
          sottotitolo={`— saldo e acconti su ${anno}`}
          scadenze={future}
          input={input}
          onRateizza={onRateizza}
        />
      </div>

      {daRateizzare?.chiaveRateazione && onRateazioneChange && (
        <RateazioneModal
          scadenza={daRateizzare}
          opzioniAttuali={input.rateazioniImposta[daRateizzare.chiaveRateazione]}
          onClose={() => setDaRateizzare(null)}
          onSave={(opzioni) => {
            onRateazioneChange(daRateizzare.chiaveRateazione!, opzioni)
            setDaRateizzare(null)
          }}
        />
      )}
    </Card>
  )
}
