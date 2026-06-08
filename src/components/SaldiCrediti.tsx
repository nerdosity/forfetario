import { FileText } from 'lucide-react'
import type { RisultatoCalcolo } from '@/domain/types'
import { Card, SummaryRow, Metric } from '@/components/ui'
import { formatEuro } from '@/domain/labels'
import { theme } from '@/theme'

interface Props {
  anno: number
  calcoli: RisultatoCalcolo
}

/** Saldi e crediti dell'anno corrente (da versare o compensare nell'anno successivo). */
export function SaldiCrediti({ anno, calcoli }: Props) {
  return (
    <Card
      title={`Saldi e crediti anno ${anno}`}
      icon={FileText}
      iconIntent="neutral"
      info={`I saldi rappresentano gli importi dovuti per il ${anno} al netto degli acconti già versati. Vengono tipicamente pagati a giugno ${anno + 1}.`}
    >
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          {/* Imposte sostitutive */}
          <div className={theme.cardCompact}>
            <h3 className={`${theme.h3} mb-3`}>Imposta sostitutiva {anno}</h3>
            <div className="space-y-2">
              <SummaryRow label={`Dovuta per il ${anno}`} value={calcoli.totaleImposte} />
              <SummaryRow
                label={`Acconti versati PER il ${anno}`}
                value={calcoli.accontiImposteEffettivamenteVersatiPerAnnoCorrente}
                sign="-"
                valueIntent="income"
              />
              {calcoli.saldoImposteDaVersareAnnoCorrente > 0.005 && (
                <SummaryRow
                  label={`Saldo da versare (giugno ${anno + 1})`}
                  value={calcoli.saldoImposteDaVersareAnnoCorrente}
                  total
                  valueIntent="cost"
                />
              )}
              {calcoli.creditoImposteAnnoCorrente > 0.005 && (
                <SummaryRow
                  label={`Credito imposte ${anno}`}
                  value={calcoli.creditoImposteAnnoCorrente}
                  total
                  valueIntent="income"
                />
              )}
            </div>
          </div>

          {/* Contributi Gestione Separata */}
          <div className={theme.cardCompact}>
            <h3 className={`${theme.h3} mb-3`}>Contributi gestione separata {anno}</h3>
            <div className="space-y-2">
              <SummaryRow label={`Dovuti per il ${anno}`} value={calcoli.totaleContributiSeparata} />
              <SummaryRow
                label={`Acconti versati PER il ${anno}`}
                value={calcoli.accontiGSVersatiPerAnnoRif}
                sign="-"
                valueIntent="income"
              />
              {calcoli.saldoContributiGSAnnoCorrente > 0.005 && (
                <SummaryRow
                  label={`Saldo da versare (giugno ${anno + 1})`}
                  value={calcoli.saldoContributiGSAnnoCorrente}
                  total
                  valueIntent="cost"
                />
              )}
            </div>
          </div>

          {/* Contributi eccedenza Art/Comm */}
          <div className={theme.cardCompact}>
            <h3 className={`${theme.h3} mb-3`}>Contributi eccedenza Art/Comm {anno}</h3>
            <div className="space-y-2">
              <SummaryRow label={`Dovuti per il ${anno}`} value={calcoli.totaleContributiEccedenzaArtComm} />
              <SummaryRow
                label={`Acconti versati PER il ${anno}`}
                value={calcoli.accontiEccArtCommVersatiPerAnnoRif}
                sign="-"
                valueIntent="income"
              />
              {calcoli.saldoContributiEccArtCommAnnoCorrente > 0.005 && (
                <SummaryRow
                  label={`Saldo da versare (giugno ${anno + 1})`}
                  value={calcoli.saldoContributiEccArtCommAnnoCorrente}
                  total
                  valueIntent="cost"
                />
              )}
              <p className={`${theme.helpText} mt-2`}>
                I contributi fissi Art/Comm ({formatEuro(calcoli.totaleContributiFissiArtComm)}) si pagano in rate trimestrali durante il {anno}.
              </p>
            </div>
          </div>
        </div>

        {/* Nota esplicativa */}
        <div className="space-y-4">
          <Metric
            value={formatEuro(
              calcoli.saldoImposteDaVersareAnnoCorrente +
              calcoli.saldoContributiGSAnnoCorrente +
              calcoli.saldoContributiEccArtCommAnnoCorrente,
            )}
            label={`Totale saldi da versare a giugno ${anno + 1}`}
            valueIntent="cost"
          />

          <div className={`${theme.section} text-sm text-slate-600 space-y-3`}>
            <p>
              I saldi si riferiscono agli importi dovuti per il {anno} al netto degli acconti già versati per quell'anno.
            </p>
            <p>
              Gli acconti per il {anno + 1} (calcolati sulle imposte/contributi del {anno}) vengono pagati nel corso del {anno + 1} a giugno e novembre, solo se l'attività è presunta continuare.
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}
