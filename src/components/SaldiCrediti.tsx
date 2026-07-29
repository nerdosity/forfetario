import { FileText } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from 'flowbite-react'
import type { RisultatoCalcolo } from '@/domain/types'
import { Card, Tooltip } from '@/components/ui'
import { formatEuro } from '@/domain/labels'
import { theme, tableTheme } from '@/theme'

interface Props {
  anno: number
  calcoli: RisultatoCalcolo
}

interface Riga {
  voce: string
  dovuto: number
  /** Acconti DOVUTI (metodo INPS) scalati dal saldo. */
  acconti: number
  /** Acconti effettivamente VERSATI dall'utente (se inseriti). */
  accontiVersati: number
  saldo: number
  credito?: number
  /** Nota metodologica sul saldo (es. calcolato col fallback sugli acconti versati). */
  nota?: string
}

/**
 * Saldo contributi di una gestione così come finisce in calendario e F24: si
 * legge dalla scadenza di saldo dell'anno successivo, unica fonte del netting
 * (che include l'eventuale fallback sugli acconti realmente versati). Senza
 * questa lettura la sezione mostrerebbe il dovuto pieno mentre calendario e F24
 * espongono il netto, e le due viste divergerebbero.
 */
function saldoDaScadenze(
  calcoli: RisultatoCalcolo,
  anno: number,
  gestione: 'separata' | 'eccedenza',
): { importo: number; nota?: string } | null {
  const s = calcoli.scadenzeAnnoSuccessivo.find(
    (x) =>
      new RegExp(gestione === 'separata' ? 'Gestione separata' : 'eccedenza', 'i').test(x.categoria ?? '') &&
      x.voce === `Saldo · competenza ${anno}`,
  )
  return s ? { importo: s.importo, nota: s.nota } : null
}

/** Saldi e crediti dell'anno corrente (da versare o compensare nell'anno successivo). */
export function SaldiCrediti({ anno, calcoli }: Props) {
  // Saldi contributi: stessa fonte del calendario/F24. Se la scadenza non c'è
  // (saldo interamente coperto dagli acconti) il saldo è zero.
  const saldoGs = saldoDaScadenze(calcoli, anno, 'separata')
  const saldoEcc = saldoDaScadenze(calcoli, anno, 'eccedenza')
  const importoGs = saldoGs?.importo ?? 0
  const importoEcc = saldoEcc?.importo ?? 0

  const righe: Riga[] = [
    {
      voce: 'Imposta sostitutiva',
      dovuto: calcoli.totaleImposte,
      acconti: calcoli.accontiImposteEffettivamenteVersatiPerAnnoCorrente,
      accontiVersati: calcoli.accontiImposteEffettivamenteVersatiPerAnnoCorrente,
      saldo: calcoli.saldoImposteDaVersareAnnoCorrente,
      credito: calcoli.creditoImposteAnnoCorrente,
    },
    {
      voce: 'Contributi gestione separata',
      dovuto: calcoli.totaleContributiSeparata,
      acconti: calcoli.accontiGSVersatiPerAnnoRif,
      accontiVersati: calcoli.accontiGSVersatiRealiPerAnnoRif,
      saldo: importoGs,
      nota: saldoGs?.nota,
    },
    {
      voce: 'Contributi eccedenza Art/Comm',
      dovuto: calcoli.totaleContributiEccedenzaArtComm,
      acconti: calcoli.accontiEccArtCommVersatiPerAnnoRif,
      accontiVersati: calcoli.accontiEccArtCommVersatiRealiPerAnnoRif,
      saldo: importoEcc,
      nota: saldoEcc?.nota,
    },
  ].filter((r) => r.dovuto > 0.005 || r.acconti > 0.005)

  const totaleSaldi =
    calcoli.saldoImposteDaVersareAnnoCorrente + importoGs + importoEcc

  // Conguagli per gestione: di-più versato sulle rate obbligatorie, scalabile sul
  // saldo. Letti dalle scadenze dell'anno successivo (dove il saldo porta
  // l'importoConsigliato). Solo quelli effettivamente presenti (credito > 0).
  const conguagli = calcoli.scadenzeAnnoSuccessivo
    .filter(
      (s) =>
        s.importoConsigliato != null &&
        /Contributi (gestione separata|eccedenza)/i.test(s.categoria ?? '') &&
        s.voce?.startsWith('Saldo'),
    )
    .map((s) => ({
      gestione: /eccedenza/i.test(s.categoria ?? '') ? 'artigiani/commercianti' : 'gestione separata',
      credito: s.importo - (s.importoConsigliato ?? s.importo),
      dovuto: s.importo,
      consigliato: s.importoConsigliato ?? s.importo,
    }))
    .filter((c) => c.credito > 0.005)

  return (
    <Card
      title={`Saldi e crediti ${anno}`}
      icon={FileText}
      iconIntent="cost"
      info={`Anno d'imposta ${anno}. Il saldo = dovuto del ${anno} meno gli acconti dovuti (metodo INPS). Saldo e 1° acconto del ${anno + 1} si versano a giugno ${anno + 1}.`}
    >
      {/* Box totale in evidenza */}
      <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 sm:px-5 sm:py-4">
        <div>
          <p className="text-sm font-medium text-red-700">Totale saldi da versare — anno d'imposta {anno}</p>
          <p className="text-xs text-red-600/80">Da versare entro giugno {anno + 1}</p>
        </div>
        <p className="text-xl font-bold tabular-nums text-red-700 sm:text-2xl">{formatEuro(totaleSaldi)}</p>
      </div>

      {righe.length > 0 ? (
        <div>
          <Table hoverable theme={tableTheme}>
            <TableHead>
              <TableRow>
                <TableHeadCell>Voce</TableHeadCell>
                <TableHeadCell className="text-right">Dovuto {anno}</TableHeadCell>
                <TableHeadCell className="text-right">Acconti dovuti</TableHeadCell>
                <TableHeadCell className="text-right">Acconti versati ({anno})</TableHeadCell>
                <TableHeadCell className="text-right">Saldo</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody className="divide-y">
              {righe.map((r) => {
                // L'imposta usa già l'acconto versato come "dovuto" → evito di ripetere
                const versatoDistinto = Math.abs(r.accontiVersati - r.acconti) > 0.005
                return (
                  <TableRow key={r.voce} className="bg-white">
                    <TableCell className="font-medium text-slate-800">{r.voce}</TableCell>
                    <TableCell className="text-right tabular-nums text-slate-600">{formatEuro(r.dovuto)}</TableCell>
                    <TableCell className="text-right tabular-nums text-slate-500">
                      {r.acconti > 0.005 ? `- ${formatEuro(r.acconti)}` : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-500">
                      {r.accontiVersati > 0.005
                        ? (versatoDistinto ? formatEuro(r.accontiVersati) : '= dovuti')
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      <span className="inline-flex items-center justify-end gap-1">
                        {r.credito && r.credito > 0.005 ? (
                          <span className="text-emerald-700">+ {formatEuro(r.credito)}</span>
                        ) : (
                          <span className={r.saldo > 0.005 ? 'text-red-700' : 'text-slate-400'}>
                            {formatEuro(r.saldo)}
                          </span>
                        )}
                        {r.nota && (
                          <Tooltip content={r.nota} label="Come è calcolato il saldo" posizione="sotto" allinea="destra" />
                        )}
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <p className={`${theme.helpText} mt-2`}>
            <strong>Acconti dovuti</strong>: quanto l'INPS calcola come acconto del {anno} (sul reddito
            dell'anno prima), scalato dal saldo. <strong>Acconti versati</strong>: quanto hai realmente
            pagato in acconto nel {anno} (dalle rate inserite). Se i due valori differiscono, la
            differenza è un credito/debito che emerge a conguaglio. Sui contributi il{' '}
            <strong>saldo</strong> è lo stesso importo esposto nel calendario e negli F24: quando gli
            acconti dovuti non sono calcolabili (manca l'anno precedente) viene scalato con gli acconti
            versati, come segnalato dalla nota sulla riga.
          </p>
        </div>
      ) : (
        <p className={theme.helpText}>Nessun saldo da versare con i dati inseriti.</p>
      )}

      {/* Conguaglio contributi: di-più versato sulle rate, scalabile sul saldo */}
      {conguagli.map((c) => (
        <div
          key={c.gestione}
          className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3"
        >
          <p className="text-sm text-emerald-800">
            Sui contributi {c.gestione} hai versato <strong>{formatEuro(c.credito)}</strong> in più del
            dovuto sulle rate obbligatorie: puoi scontarli sul saldo e versare{' '}
            <strong>{formatEuro(c.consigliato)}</strong> invece di {formatEuro(c.dovuto)}. La cifra
            dovuta ufficiale resta {formatEuro(c.dovuto)}; il conguaglio è un suggerimento.
          </p>
        </div>
      ))}

      {calcoli.totaleContributiFissiArtComm > 0.005 && (
        <p className={`${theme.helpText} mt-4`}>
          I contributi fissi Art/Comm ({formatEuro(calcoli.totaleContributiFissiArtComm)}) si pagano
          in rate trimestrali durante il {anno}, separatamente dai saldi qui sopra.
        </p>
      )}

      <p className={`${theme.helpText} mt-2`}>
        Promemoria sugli anni: il <strong>saldo {anno}</strong> e il <strong>1° acconto {anno + 1}</strong>{' '}
        si versano insieme a giugno {anno + 1}; il <strong>2° acconto {anno + 1}</strong> a novembre {anno + 1}.
        Gli acconti del {anno} mostrati sopra sono quelli versati nel corso del {anno} (giugno e novembre {anno}).
      </p>
    </Card>
  )
}
