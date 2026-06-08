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
import { Card } from '@/components/ui'
import { formatEuro } from '@/domain/labels'
import { theme } from '@/theme'

interface Props {
  anno: number
  calcoli: RisultatoCalcolo
}

interface Riga {
  voce: string
  dovuto: number
  acconti: number
  saldo: number
  credito?: number
}

/** Saldi e crediti dell'anno corrente (da versare o compensare nell'anno successivo). */
export function SaldiCrediti({ anno, calcoli }: Props) {
  const righe: Riga[] = [
    {
      voce: 'Imposta sostitutiva',
      dovuto: calcoli.totaleImposte,
      acconti: calcoli.accontiImposteEffettivamenteVersatiPerAnnoCorrente,
      saldo: calcoli.saldoImposteDaVersareAnnoCorrente,
      credito: calcoli.creditoImposteAnnoCorrente,
    },
    {
      voce: 'Contributi gestione separata',
      dovuto: calcoli.totaleContributiSeparata,
      acconti: calcoli.accontiGSVersatiPerAnnoRif,
      saldo: calcoli.saldoContributiGSAnnoCorrente,
    },
    {
      voce: 'Contributi eccedenza Art/Comm',
      dovuto: calcoli.totaleContributiEccedenzaArtComm,
      acconti: calcoli.accontiEccArtCommVersatiPerAnnoRif,
      saldo: calcoli.saldoContributiEccArtCommAnnoCorrente,
    },
  ].filter((r) => r.dovuto > 0.005 || r.acconti > 0.005)

  const totaleSaldi =
    calcoli.saldoImposteDaVersareAnnoCorrente +
    calcoli.saldoContributiGSAnnoCorrente +
    calcoli.saldoContributiEccArtCommAnnoCorrente

  return (
    <Card
      title={`Saldi e crediti ${anno}`}
      icon={FileText}
      iconIntent="cost"
      info={`I saldi rappresentano gli importi dovuti per il ${anno} al netto degli acconti già versati. Vengono tipicamente pagati a giugno ${anno + 1}.`}
    >
      {/* Box totale in evidenza */}
      <div className="mb-5 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-5 py-4">
        <div>
          <p className="text-sm font-medium text-red-700">Totale saldi da versare</p>
          <p className="text-xs text-red-600/80">Scadenza giugno {anno + 1}</p>
        </div>
        <p className="text-2xl font-bold tabular-nums text-red-700">{formatEuro(totaleSaldi)}</p>
      </div>

      {righe.length > 0 ? (
        <div className="overflow-x-auto">
          <Table hoverable>
            <TableHead>
              <TableRow>
                <TableHeadCell>Voce</TableHeadCell>
                <TableHeadCell className="text-right">Dovuto</TableHeadCell>
                <TableHeadCell className="text-right">Acconti</TableHeadCell>
                <TableHeadCell className="text-right">Saldo</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody className="divide-y">
              {righe.map((r) => (
                <TableRow key={r.voce} className="bg-white">
                  <TableCell className="font-medium text-slate-800">{r.voce}</TableCell>
                  <TableCell className="text-right tabular-nums text-slate-600">{formatEuro(r.dovuto)}</TableCell>
                  <TableCell className="text-right tabular-nums text-slate-500">
                    {r.acconti > 0.005 ? `− ${formatEuro(r.acconti)}` : '—'}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {r.credito && r.credito > 0.005 ? (
                      <span className="text-emerald-700">+ {formatEuro(r.credito)}</span>
                    ) : (
                      <span className={r.saldo > 0.005 ? 'text-red-700' : 'text-slate-400'}>
                        {formatEuro(r.saldo)}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className={theme.helpText}>Nessun saldo da versare con i dati inseriti.</p>
      )}

      {calcoli.totaleContributiFissiArtComm > 0.005 && (
        <p className={`${theme.helpText} mt-4`}>
          I contributi fissi Art/Comm ({formatEuro(calcoli.totaleContributiFissiArtComm)}) si pagano
          in rate trimestrali durante il {anno}, separatamente dai saldi qui sopra.
        </p>
      )}

      <p className={`${theme.helpText} mt-2`}>
        Gli acconti per il {anno + 1} (calcolati su imposte e contributi del {anno}) si versano nel
        corso del {anno + 1} a giugno e novembre, solo se l'attività prosegue.
      </p>
    </Card>
  )
}
