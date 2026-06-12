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
import { theme, tableTheme } from '@/theme'

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
      info={`I saldi rappresentano gli importi dovuti per il ${anno} al netto degli acconti già versati. Vengono tipicamente pagati a giugno ${anno + 1}.`}
    >
      {/* Box totale in evidenza */}
      <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 sm:px-5 sm:py-4">
        <div>
          <p className="text-sm font-medium text-red-700">Totale saldi da versare</p>
          <p className="text-xs text-red-600/80">Scadenza giugno {anno + 1}</p>
        </div>
        <p className="text-xl font-bold tabular-nums text-red-700 sm:text-2xl">{formatEuro(totaleSaldi)}</p>
      </div>

      {righe.length > 0 ? (
        <div>
          <Table hoverable theme={tableTheme}>
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
                    {r.acconti > 0.005 ? `- ${formatEuro(r.acconti)}` : '—'}
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
        Gli acconti per il {anno + 1} (calcolati su imposte e contributi del {anno}) si versano nel
        corso del {anno + 1} a giugno e novembre, solo se l'attività prosegue.
      </p>
    </Card>
  )
}
