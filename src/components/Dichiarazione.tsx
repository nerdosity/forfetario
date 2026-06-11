import { useEffect, useState } from 'react'
import { FileSpreadsheet, ExternalLink, Copy } from 'lucide-react'
import { Badge, Button, Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow, TextInput } from 'flowbite-react'
import type { RisultatoCalcolo } from '@/domain/types'
import { generaRighiDichiarazione, type CampoDichiarazione } from '@/domain/dichiarazione'
import { righeCodelineDaScadenze } from '@/domain/codelineInps'
import { SEDI_INPS } from '@/data/sediInps'
import { caricaAnagrafica, salvaAnagrafica } from '@/data/anagraficaStorage'
import { Card, Field, Tooltip } from '@/components/ui'
import { formatEuro } from '@/domain/labels'
import { theme } from '@/theme'

interface Props {
  anno: number
  calcoli: RisultatoCalcolo
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
      <div className="overflow-x-auto">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeadCell className="w-20">Rigo</TableHeadCell>
              <TableHeadCell className="w-16">Col.</TableHeadCell>
              <TableHeadCell>Descrizione</TableHeadCell>
              <TableHeadCell className="text-right">Valore</TableHeadCell>
            </TableRow>
          </TableHead>
          <TableBody className="divide-y">
            {righi.map((c, i) => (
              <TableRow key={i} className="bg-white">
                <TableCell className="font-semibold text-slate-700">{c.rigo}</TableCell>
                <TableCell className="text-slate-500 tabular-nums">{c.colonna ?? '—'}</TableCell>
                <TableCell className="text-slate-700">
                  <span className="flex items-center gap-1.5">
                    {c.descrizione}
                    {c.nota && <Tooltip content={c.nota} label="Dettaglio del campo" posizione="sotto" allinea="sinistra" />}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <ValoreCampo valore={c.valore} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

/**
 * Pannello "Righi dichiarazione": traduce i calcoli nei campi del quadro LM
 * (forfettario) e RS (contributi) da riportare nei Redditi PF. Apre il PDF
 * promemoria in una nuova scheda.
 */
/** Sezione Codeline INPS: input sede/matricola/soggetto + tabella codeline contributi. */
function SezioneCodeline({ calcoli }: { calcoli: RisultatoCalcolo }) {
  const [anag, setAnag] = useState(caricaAnagrafica)
  useEffect(() => { salvaAnagrafica(anag) }, [anag])

  // testo mostrato nel campo sede (nome + SAP), inizializzato dal SAP salvato
  const [sedeTesto, setSedeTesto] = useState(() => {
    const s = SEDI_INPS.find((x) => x.sap === anag.sedeInps)
    return s ? `${s.nome} (${s.sap})` : ''
  })

  const scadenzeContributi = [...calcoli.scadenzeAnnoCorrente, ...calcoli.scadenzeAnnoSuccessivo]
    .filter((s) => /Contributi (fissi|eccedenza)/i.test(s.categoria ?? '') && s.importo > 0.005)

  const matricolaValida = /^\d{8}$/.test(anag.matricolaInps)
  const soggettoValido = /^\d{2}$/.test(anag.codiceSoggettoInps)
  const sedeValida = /^\d{4}$/.test(anag.sedeInps)
  const datiCompleti = matricolaValida && soggettoValido && sedeValida

  const righe = datiCompleti
    ? righeCodelineDaScadenze(scadenzeContributi, anag.matricolaInps, anag.codiceSoggettoInps, anag.sedeInps)
    : []

  return (
    <div className="space-y-3">
      <p className={`${theme.groupLabel}`}>Codeline INPS — sezione INPS del modello F24</p>
      <div className="grid gap-4 sm:grid-cols-[14rem_8rem]">
        <Field label="Sede INPS" htmlFor="cl-sede" info="Digita il nome della sede (SAP) che gestisce la tua posizione artigiani/commercianti e selezionala dall'elenco.">
          <TextInput
            id="cl-sede"
            list="sedi-inps"
            value={sedeTesto}
            placeholder="es. Milano, Roma Eur…"
            color={!sedeTesto || sedeValida ? undefined : 'failure'}
            onChange={(e) => {
              const testo = e.target.value
              setSedeTesto(testo)
              const sede = SEDI_INPS.find((s) => `${s.nome} (${s.sap})` === testo)
              setAnag((a) => ({ ...a, sedeInps: sede ? sede.sap : '' }))
            }}
          />
          <datalist id="sedi-inps">
            {SEDI_INPS.map((s) => (
              <option key={s.sap} value={`${s.nome} (${s.sap})`} />
            ))}
          </datalist>
        </Field>
        <Field label="Codice soggetto" htmlFor="cl-sogg" info="10 = titolare; 11, 12… per i collaboratori familiari.">
          <TextInput
            id="cl-sogg"
            value={anag.codiceSoggettoInps}
            maxLength={2}
            color={soggettoValido ? undefined : 'failure'}
            onChange={(e) => setAnag((a) => ({ ...a, codiceSoggettoInps: e.target.value.replace(/\D/g, '').slice(0, 2) }))}
            className="font-mono"
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-[14rem_8rem]">
        <Field label="Matricola INPS azienda" htmlFor="cl-matr" info="8 cifre, dalla tua posizione contributiva artigiani/commercianti.">
          <TextInput
            id="cl-matr"
            value={anag.matricolaInps}
            maxLength={8}
            placeholder="10130045"
            color={!anag.matricolaInps || matricolaValida ? undefined : 'failure'}
            onChange={(e) => setAnag((a) => ({ ...a, matricolaInps: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
            className="font-mono"
          />
        </Field>
      </div>

      {!datiCompleti ? (
        <p className={theme.helpText}>
          Seleziona la sede e inserisci matricola (8 cifre) e codice soggetto per generare le codeline dei contributi.
        </p>
      ) : righe.length === 0 ? (
        <p className={theme.helpText}>Nessuna scadenza di contributi artigiani/commercianti per cui generare la codeline.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeadCell>Contributo</TableHeadCell>
                <TableHeadCell>Causale</TableHeadCell>
                <TableHeadCell className="text-right">Importo</TableHeadCell>
                <TableHeadCell>Codeline (codice INPS)</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody className="divide-y">
              {righe.map((r, i) => (
                <TableRow key={i} className="bg-white">
                  <TableCell className="text-slate-700">{r.descrizione}</TableCell>
                  <TableCell className="font-mono text-slate-600">{r.causale}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatEuro(r.importo)}</TableCell>
                  <TableCell>
                    {r.codeline ? (
                      <span className="flex items-center gap-2">
                        <span className="font-mono font-semibold tracking-wide">{r.codeline}</span>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard?.writeText(r.codeline!)}
                          title="Copia la codeline"
                          aria-label="Copia la codeline"
                          className={theme.btnIcon}
                        >
                          <Copy size={14} aria-hidden />
                        </button>
                        {!r.affidabile && (
                          <Tooltip
                            content="Questa codeline è una stima: per questa matricola l'algoritmo non è ancora garantito esatto. Verificala sullo strumento ufficiale del Cassetto INPS prima di usarla per il pagamento."
                            label="Codeline da verificare"
                            posizione="sotto"
                            allinea="sinistra"
                          />
                        )}
                      </span>
                    ) : (
                      <span className="text-amber-600 italic">calcola sul sito INPS</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {righe.some((r) => r.codeline && !r.affidabile) && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <Badge color="warning" className="mt-0.5 w-fit shrink-0">Da verificare</Badge>
              <p className="text-sm text-amber-800">
                Alcune righe usano un codice soggetto o una sede non coperti dalla validazione
                (icona di avviso). L'algoritmo è quello ufficiale, ma per sicurezza verifica queste
                codeline sullo strumento del Cassetto previdenziale INPS prima del pagamento.
              </p>
            </div>
          )}
          <p className={`${theme.helpText} mt-2`}>
            Codice INPS da riportare nel campo "matricola INPS/codice INPS" della sezione INPS del modello F24.
            Calcolato con l'algoritmo ufficiale INPS (controcodice modulo 99 a blocchi e check digit finale
            modulo 11) descritto nella{' '}
            <a
              href="https://servizi2.inps.it/servizi/Bussola/VisualizzaDoc.aspx?sVirtualURL=/Circolari/Circolare%20numero%20123%20del%209-6-1998.htm&Accessibile=yes"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline hover:text-blue-700"
            >
              Circolare INPS n. 123 del 9/6/1998
            </a>.
          </p>
          <p className={`${theme.helpText} mt-1 italic`}>
            Strumento di supporto non ufficiale: verifica il codice sul Cassetto previdenziale INPS
            prima del versamento. Nessuna responsabilità per errori o pagamenti respinti.
          </p>
        </div>
      )}
    </div>
  )
}

export function Dichiarazione({ anno, calcoli }: Props) {
  const righi = generaRighiDichiarazione(calcoli, anno)

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
      info="Traduzione dei calcoli nei campi del quadro LM (regime forfettario) e del quadro RS (contributi) da riportare nei Redditi PF. Promemoria di compilazione: non sostituisce la dichiarazione."
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className={theme.helpText}>
            Quadro LM sezione II e quadro RS per l'anno d'imposta {anno}.
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

        <SezioneCodeline calcoli={calcoli} />

        {righi.haCampiDaCompletare && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <Badge color="warning" className="mt-0.5 w-fit shrink-0">Da completare</Badge>
            <p className="text-sm text-amber-800">
              I campi in arancione (es. il codice ATECO) non sono ricavabili dai dati inseriti:
              riportarli a mano. Il documento è un promemoria di compilazione, non sostituisce la
              dichiarazione né i controlli del software ufficiale.
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}
