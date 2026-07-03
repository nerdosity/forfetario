import { FileSpreadsheet, ExternalLink } from 'lucide-react'
import { Button, Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from 'flowbite-react'
import type { CalcoloInput, RisultatoCalcolo } from '@/domain/types'
import type { AnagraficaContribuente } from '@/data/anagraficaStorage'
import { generaRighiDichiarazione, type CampoDichiarazione } from '@/domain/dichiarazione'
import { Card, Tooltip } from '@/components/ui'
import { formatEuro } from '@/domain/labels'
import { theme, tableTheme } from '@/theme'

interface Props {
  anno: number
  calcoli: RisultatoCalcolo
  input: CalcoloInput
  anagrafica: AnagraficaContribuente
}

/** Mostra un valore di campo: euro se numero, testo (es. "da inserire") altrimenti. */
function ValoreCampo({ valore }: { valore: number | string }) {
  if (typeof valore === 'number') {
    return <span className="font-semibold tabular-nums">{formatEuro(valore)}</span>
  }
  return <span className="text-amber-600 italic">{valore}</span>
}

/** Tabella di righi (rigo · colonna · descrizione · valore) con tooltip nota. */
function TabellaRighi({ titolo, righi }: { titolo: string; righi: CampoDichiarazione[] }) {
  return (
    <div>
      <p className={`${theme.groupLabel} mb-2`}>{titolo}</p>
      <Table theme={tableTheme}>
        <TableHead>
          <TableRow>
            <TableHeadCell className="w-16 whitespace-nowrap">Rigo</TableHeadCell>
            <TableHeadCell className="w-12 whitespace-nowrap">Col.</TableHeadCell>
            <TableHeadCell>Descrizione</TableHeadCell>
            <TableHeadCell className="w-28 text-right whitespace-nowrap">Valore</TableHeadCell>
          </TableRow>
        </TableHead>
        <TableBody className="divide-y divide-slate-100">
          {righi.map((c, i) => (
            <TableRow key={i} className="bg-white">
              <TableCell className="whitespace-nowrap py-2.5 font-semibold text-slate-700">{c.rigo}</TableCell>
              <TableCell className="py-2.5 text-slate-500 tabular-nums">{c.colonna ?? '—'}</TableCell>
              <TableCell className="py-2.5 pr-4 text-slate-700">
                <span className="inline-flex items-start gap-1.5">
                  <span>{c.descrizione}</span>
                  {c.nota && (
                    <span className="mt-0.5 shrink-0 leading-none">
                      <Tooltip content={c.nota} label="Dettaglio del campo" posizione="sotto" allinea="sinistra" />
                    </span>
                  )}
                </span>
              </TableCell>
              <TableCell className="whitespace-nowrap py-2.5 text-right tabular-nums">
                <ValoreCampo valore={c.valore} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/**
 * Pannello "Righi dichiarazione": traduce i calcoli nei campi dei quadri LM
 * (forfettario), RS (contributi dedotti) e RR (contributi INPS dovuti/versati)
 * da riportare nei Redditi PF. Apre il PDF promemoria in una nuova scheda.
 */

export function Dichiarazione({ anno, calcoli, input, anagrafica }: Props) {
  const righi = generaRighiDichiarazione(calcoli, anno, input, anagrafica)

  const apriPdf = async () => {
    const scheda = window.open('', '_blank')
    const { generaPdfDichiarazione } = await import('@/pdf/dichiarazionePdf')
    const url = await generaPdfDichiarazione(righi)
    if (scheda) scheda.location.replace(url)
    else window.open(url, '_blank', 'noopener')
  }

  return (
    <Card
      title="Righi dichiarazione"
      icon={FileSpreadsheet}
      iconIntent="info"
      info="Traduzione dei calcoli nei campi dei quadri LM (regime forfettario), RS (contributi dedotti) e RR (contributi INPS) da riportare nei Redditi PF. Promemoria di compilazione: non sostituisce la dichiarazione."
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className={theme.helpText}>
            Quadro LM sezione II, quadro RS e quadro RR per l'anno d'imposta {anno}.
          </p>
          <Button size="sm" onClick={apriPdf}>
            <ExternalLink size={15} className="mr-2" aria-hidden />
            Apri PDF
          </Button>
        </div>

        {righi.moduliLM.map((m) => (
          <TabellaRighi
            key={m.modulo}
            titolo={righi.moduliLM.length > 1 ? `Quadro LM — attività ${m.modulo}` : 'Quadro LM — attività'}
            righi={m.campi}
          />
        ))}

        <TabellaRighi titolo="Quadro LM — liquidazione imposta" righi={righi.riepilogoLM} />
        <TabellaRighi titolo="Contributi previdenziali — deduzione" righi={righi.quadroRS} />

        {righi.quadroRRArtComm.map((s) => (
          <TabellaRighi
            key={s.gestione}
            titolo={`Quadro RR sezione I — ${s.gestione} (${s.rigo})`}
            righi={s.campi}
          />
        ))}
        {righi.quadroRRSeparata.length > 0 && (
          <TabellaRighi titolo="Quadro RR sezione II — gestione separata" righi={righi.quadroRRSeparata} />
        )}

        {righi.haCampiDaCompletare && (
          <p className={theme.helpText}>
            I campi <span className="text-amber-600">in arancione</span> (es. il codice ATECO) vanno
            riportati a mano: non sono ricavabili dai dati inseriti. Nel quadro RR compaiono solo i
            campi con un valore ricavabile: rimborsi chiesti e compensazioni F24 sono scelte tue e
            vanno indicati a mano (le note dei crediti dicono in quali colonne). Promemoria di
            compilazione, non sostituisce la dichiarazione né il software ufficiale.
          </p>
        )}
      </div>
    </Card>
  )
}
