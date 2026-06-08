import { BarChart3 } from 'lucide-react'
import type { RisultatoCalcolo } from '@/domain/types'
import { Card, SummaryRow, Metric, Tooltip } from '@/components/ui'
import { labelTipo, formatEuro } from '@/domain/labels'
import { theme } from '@/theme'

interface Props {
  anno: number
  calcoli: RisultatoCalcolo
}

/** Dettaglio dei calcoli per ciascun regime dell'anno corrente. */
export function DettaglioRegimi({ anno, calcoli }: Props) {
  return (
    <Card title={`Dettaglio calcoli per regime (${anno})`} icon={BarChart3} iconIntent="info">
      {calcoli.dettagliRegimiCalcolati.map((regime, index) => (
        <div key={regime.id} className={`${theme.cardCompact} mb-4`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className={theme.h3}>
              Periodo {index + 1}: {labelTipo(regime.tipo)} · {regime.aliquota}%
              {regime.riduzioneContributi !== 'nessuna' && ` · rid. contr. ${regime.riduzioneContributi}%`}
            </h3>
            <span className={theme.helpText}>
              {regime.mesiRegime} mes{regime.mesiRegime > 1 ? 'i' : 'e'} ({regime.giorniRegime} giorni)
            </span>
          </div>

          <div className="space-y-2">
            <SummaryRow label="Fatturato" value={regime.fatturato} />
            <SummaryRow
              label={`Imponibile lordo (${regime.coefficiente}%)`}
              value={regime.imponibileLordoRegime}
            />

            {/* Contributi INPS con tooltip che mostra il dettaglio del calcolo */}
            <div className={theme.row}>
              <span className={`${theme.rowLabel} flex items-center gap-1`}>
                Contributi INPS dovuti
                {regime.dettaglioCalcoloContributi && (
                  <Tooltip content={regime.dettaglioCalcoloContributi} label="Dettaglio calcolo contributi" />
                )}
              </span>
              <span className="font-medium text-red-700">{formatEuro(regime.contributiRegimeINPS)}</span>
            </div>

            {/* Imposta sostitutiva con tooltip sulla formula */}
            <div className={theme.row}>
              <span className={`${theme.rowLabel} flex items-center gap-1`}>
                Quota contributi deducibili
                <Tooltip content={`Quota proporzionale dei contributi versati durante il ${anno} attribuita a questo regime in base al peso sul totale imponibile. Si deduce dall'imponibile prima di calcolare l'imposta sostitutiva.`} />
              </span>
              <span className="font-medium text-amber-700">− {formatEuro(regime.contributiVersatiQuotaParte)}</span>
            </div>

            <SummaryRow label="Imponibile netto" value={regime.imponibileNettoRegime} />

            <div className={theme.row}>
              <span className={`${theme.rowLabel} flex items-center gap-1`}>
                Imposta sostitutiva
                <Tooltip content={`${formatEuro(regime.imponibileNettoRegime)} × ${regime.aliquota}% = ${formatEuro(regime.imposteRegime)}`} label="Formula imposta sostitutiva" />
              </span>
              <span className="font-semibold text-red-700">{formatEuro(regime.imposteRegime)}</span>
            </div>
          </div>
        </div>
      ))}

      {/* Totali riepilogativi */}
      <div className={`${theme.section} mt-2`}>
        <h4 className={theme.h3}>Riepilogo anno {anno}</h4>
        <div className="grid md:grid-cols-3 gap-4 mt-3">
          <Metric
            value={formatEuro(calcoli.totaleFatturato)}
            label="Fatturato totale"
            valueIntent="income"
          />
          <Metric
            value={formatEuro(calcoli.totaleContributiINPS)}
            label="Contributi INPS dovuti"
            caption={
              <>
                G.S.: {formatEuro(calcoli.totaleContributiSeparata)}<br />
                Art/Comm fissi: {formatEuro(calcoli.totaleContributiFissiArtComm)}<br />
                Art/Comm ecc.: {formatEuro(calcoli.totaleContributiEccedenzaArtComm)}
              </>
            }
            valueIntent="cost"
          />
          <Metric
            value={formatEuro(calcoli.totaleImposte)}
            label="Imposta sostitutiva"
            caption={`Su ${formatEuro(calcoli.imponibileNettoTotalePerImposte)} imponibile netto`}
            valueIntent="cost"
          />
        </div>
      </div>
    </Card>
  )
}
