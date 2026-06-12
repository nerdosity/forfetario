import { BarChart3 } from 'lucide-react'
import { Badge } from 'flowbite-react'
import type { RisultatoCalcolo } from '@/domain/types'
import { Card, SummaryRow, Metric, Tooltip } from '@/components/ui'
import { FunnelImposta } from '@/components/FunnelImposta'
import { labelTipo, formatEuro } from '@/domain/labels'
import { theme } from '@/theme'

interface Props {
  anno: number
  calcoli: RisultatoCalcolo
}

/** Dettaglio dei calcoli per ciascun regime dell'anno corrente. */
export function DettaglioRegimi({ anno, calcoli }: Props) {
  const contributiCaption = [
    calcoli.totaleContributiSeparata > 0.005 && `G.S. ${formatEuro(calcoli.totaleContributiSeparata)}`,
    calcoli.totaleContributiFissiArtComm > 0.005 && `Fissi ${formatEuro(calcoli.totaleContributiFissiArtComm)}`,
    calcoli.totaleContributiEccedenzaArtComm > 0.005 && `Eccedenza ${formatEuro(calcoli.totaleContributiEccedenzaArtComm)}`,
  ].filter(Boolean) as string[]

  return (
    <Card title={`Dettaglio calcoli per regime (${anno})`} icon={BarChart3} iconIntent="info">
      {/* Riepilogo metriche in cima */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Metric featured value={formatEuro(calcoli.totaleFatturato)} label="Fatturato totale" valueIntent="income" />
        <Metric
          featured
          value={formatEuro(calcoli.totaleContributiINPS)}
          label="Contributi INPS dovuti"
          caption={contributiCaption.length ? contributiCaption.join(' · ') : undefined}
          valueIntent="info"
        />
        <Metric
          featured
          value={formatEuro(calcoli.totaleImposte)}
          label="Imposta sostitutiva"
          caption={`Su ${formatEuro(calcoli.imponibileNettoTotalePerImposte)} imponibile`}
          valueIntent="warning"
        />
      </div>

      {/* Funnel dal fatturato all'imposta */}
      <div className="mb-6">
        <FunnelImposta
          fatturato={calcoli.totaleFatturato}
          imponibileLordo={calcoli.totaleImponibileLordo}
          contributiINPS={calcoli.totaleContributiINPS}
          imposta={calcoli.totaleImposte}
        />
      </div>

      {/* Dettaglio per periodo */}
      <div className="space-y-3">
        {calcoli.dettagliRegimiCalcolati.map((regime, index) => (
          <div key={regime.id} className={theme.cardInner}>
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h3 className={theme.h3}>Periodo {index + 1}</h3>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge color="info">{labelTipo(regime.tipo)}</Badge>
                <Badge color="gray">Imposta {regime.aliquota}%</Badge>
                {regime.riduzioneContributi !== 'nessuna' && (
                  <Badge color="warning">Riduzione contributi {regime.riduzioneContributi}%</Badge>
                )}
              </div>
              <span className={`${theme.helpText} ml-auto`}>
                {regime.mesiRegime} mes{regime.mesiRegime > 1 ? 'i' : 'e'} · {regime.giorniRegime} giorni
              </span>
            </div>

            <div className="space-y-2 rounded-lg bg-white p-3">
              <SummaryRow label="Fatturato" value={regime.fatturato} />
              <SummaryRow label={`Imponibile lordo (${regime.coefficiente}%)`} value={regime.imponibileLordoRegime} />

              <div className={theme.row}>
                <span className={`${theme.rowLabel} flex items-center gap-1`}>
                  Contributi INPS dovuti
                  {regime.dettaglioCalcoloContributi && (
                    <Tooltip content={regime.dettaglioCalcoloContributi} label="Dettaglio calcolo contributi" />
                  )}
                </span>
                <span className="font-medium text-red-700">{formatEuro(regime.contributiRegimeINPS)}</span>
              </div>

              {regime.contributiVersatiQuotaParte > 0.005 && (
                <div className={theme.row}>
                  <span className={`${theme.rowLabel} flex items-center gap-1`}>
                    Quota contributi deducibili
                    <Tooltip content={`Quota proporzionale dei contributi versati durante il ${anno} attribuita a questo regime in base al peso sul totale imponibile. Si deduce dall'imponibile prima di calcolare l'imposta sostitutiva.`} />
                  </span>
                  <span className="font-medium text-amber-700">- {formatEuro(regime.contributiVersatiQuotaParte)}</span>
                </div>
              )}

              <SummaryRow label="Imponibile netto" value={regime.imponibileNettoRegime} />

              <div className={theme.rowTotal}>
                <span className="flex items-center gap-1 text-slate-700">
                  Imposta sostitutiva
                  <Tooltip content={`${formatEuro(regime.imponibileNettoRegime)} × ${regime.aliquota}% = ${formatEuro(regime.imposteRegime)}`} label="Formula imposta sostitutiva" />
                </span>
                <span className="text-red-700">{formatEuro(regime.imposteRegime)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
