import { useEffect, useMemo, useState } from 'react'
import { FileDown, FileText } from 'lucide-react'
import { Button, Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow, TextInput } from 'flowbite-react'
import type { RisultatoCalcolo, Scadenza } from '@/domain/types'
import { righeCodelineDaScadenze, type RigaCodeline } from '@/domain/codelineInps'
import { SEDI_INPS } from '@/data/sediInps'
import { caricaAnagrafica, salvaAnagrafica } from '@/data/anagraficaStorage'
import { Card, Field } from '@/components/ui'
import { formatEuro } from '@/domain/labels'
import { theme, tableTheme } from '@/theme'
import type { ModuloF24, RigaInpsF24, RigaErarioF24 } from '@/pdf/f24Pdf'

interface Props {
  anno: number
  calcoli: RisultatoCalcolo
}

// Periodo "01/AAAA - 12/AAAA" dalla competenza letta nella voce della scadenza.
function periodoCompetenza(voce: string | undefined, annoDefault: number): { dal: string; al: string } {
  const m = (voce ?? '').match(/competenza (\d{4})/)
  const a = m ? m[1] : String(annoDefault)
  return { dal: `01/${a}`, al: `12/${a}` }
}

/** Pagina F24: genera i bollettini in facsimile (imposte + contributi INPS). */
export function F24Page({ anno, calcoli }: Props) {
  const [anag, setAnag] = useState(caricaAnagrafica)
  useEffect(() => { salvaAnagrafica(anag) }, [anag])

  const [sedeTesto, setSedeTesto] = useState(() => {
    const s = SEDI_INPS.find((x) => x.sap === anag.sedeInps)
    return s ? `${s.nome} (${s.sap})` : ''
  })

  const matricolaValida = /^\d{8}$/.test(anag.matricolaInps)
  const soggettoValido = /^\d{2}$/.test(anag.codiceSoggettoInps)
  const sedeValida = /^\d{4}$/.test(anag.sedeInps)
  const datiInpsCompleti = matricolaValida && soggettoValido && sedeValida

  // Scadenze contributi (INPS) e relative codeline.
  const scadenzeContributi = useMemo(
    () => [...calcoli.scadenzeAnnoCorrente, ...calcoli.scadenzeAnnoSuccessivo]
      .filter((s) => /Contributi (fissi|eccedenza)/i.test(s.categoria ?? '') && s.importo > 0.005),
    [calcoli],
  )
  const righeInps: RigaCodeline[] = datiInpsCompleti
    ? righeCodelineDaScadenze(scadenzeContributi, anag.matricolaInps, anag.codiceSoggettoInps, anag.sedeInps)
    : []

  // Genera e apre il PDF di un singolo F24 INPS (una riga).
  const apriF24Inps = async (riga: RigaCodeline, scad: Scadenza) => {
    const scheda = window.open('', '_blank')
    const { dal, al } = periodoCompetenza(scad.voce, anno)
    const inps: RigaInpsF24 = {
      codiceSede: anag.sedeInps,
      causale: riga.causale,
      codeline: riga.codeline ?? '',
      periodoDal: dal,
      periodoAl: al,
      importo: riga.importo,
    }
    const modulo: ModuloF24 = {
      etichettaRata: scad.voce?.match(/(\d)ª rata/) ? `${scad.voce.match(/(\d)ª rata/)![1]}ª RATA` : 'SALDO/ACCONTO',
      scadenza: riga.data,
      erario: [],
      inps: [inps],
      anagrafica: anag,
    }
    const { generaPdfF24 } = await import('@/pdf/f24Pdf')
    const url = await generaPdfF24([modulo], `F24 INPS ${riga.descrizione}`)
    if (scheda) scheda.location.replace(url)
    else window.open(url, '_blank', 'noopener')
  }

  // Scadenze imposta sostitutiva (sezione erario).
  const scadenzeImposte = useMemo(
    () => [...calcoli.scadenzeAnnoCorrente, ...calcoli.scadenzeAnnoSuccessivo]
      .filter((s) => /Imposta sostitutiva/i.test(s.categoria ?? '') && s.importo > 0.005),
    [calcoli],
  )

  const apriF24Imposta = async (scad: Scadenza) => {
    const scheda = window.open('', '_blank')
    const isSaldo = /saldo/i.test(scad.voce ?? '')
    const erario: RigaErarioF24 = {
      codiceTributo: isSaldo ? '1792' : '1790', // saldo / acconto forfettario
      annoRiferimento: anno,
      importo: scad.importo,
    }
    const modulo: ModuloF24 = {
      etichettaRata: isSaldo ? 'SALDO' : 'ACCONTO',
      scadenza: scad.data,
      erario: [erario],
      inps: [],
      anagrafica: anag,
    }
    const { generaPdfF24 } = await import('@/pdf/f24Pdf')
    const url = await generaPdfF24([modulo], `F24 imposta ${scad.voce ?? ''}`)
    if (scheda) scheda.location.replace(url)
    else window.open(url, '_blank', 'noopener')
  }

  return (
    <div className="space-y-6">
      {/* Dati INPS per le codeline */}
      <Card title="Modelli F24 da scaricare" icon={FileText} iconIntent="info"
        info="Genera i modelli F24 in facsimile per imposte e contributi INPS, con codeline e codici tributo precompilati.">
        <p className={`${theme.helpText} -mt-2 mb-4`}>
          Per i contributi INPS inserisci sede, matricola e codice soggetto: servono a calcolare la codeline.
          I modelli sono facsimile di supporto, da verificare prima del versamento.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Sede INPS" htmlFor="f24-sede" info="Digita il nome della sede (SAP) e selezionala dall'elenco.">
            <TextInput
              id="f24-sede"
              list="f24-sedi"
              value={sedeTesto}
              placeholder="es. Milano, Roma Eur…"
              color={!sedeTesto || sedeValida ? undefined : 'failure'}
              onChange={(e) => {
                const t = e.target.value
                setSedeTesto(t)
                const sede = SEDI_INPS.find((s) => `${s.nome} (${s.sap})` === t)
                setAnag((a) => ({ ...a, sedeInps: sede ? sede.sap : '' }))
              }}
            />
            <datalist id="f24-sedi">
              {SEDI_INPS.map((s) => <option key={s.sap} value={`${s.nome} (${s.sap})`} />)}
            </datalist>
          </Field>
          <Field label="Matricola INPS azienda" htmlFor="f24-matr" info="8 cifre.">
            <TextInput
              id="f24-matr"
              value={anag.matricolaInps}
              maxLength={8}
              placeholder="10130045"
              color={!anag.matricolaInps || matricolaValida ? undefined : 'failure'}
              onChange={(e) => setAnag((a) => ({ ...a, matricolaInps: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
              className="font-mono"
            />
          </Field>
          <Field label="Codice soggetto" htmlFor="f24-sogg" info="10 = titolare.">
            <TextInput
              id="f24-sogg"
              value={anag.codiceSoggettoInps}
              maxLength={2}
              color={soggettoValido ? undefined : 'failure'}
              onChange={(e) => setAnag((a) => ({ ...a, codiceSoggettoInps: e.target.value.replace(/\D/g, '').slice(0, 2) }))}
              className="font-mono"
            />
          </Field>
        </div>
      </Card>

      {/* Contributi INPS */}
      <Card title="Contributi INPS" icon={FileText} iconIntent="warning">
        {!datiInpsCompleti ? (
          <p className={theme.helpText}>Inserisci sede, matricola e codice soggetto per generare i modelli F24 dei contributi.</p>
        ) : righeInps.length === 0 ? (
          <p className={theme.helpText}>Nessuna scadenza di contributi artigiani/commercianti.</p>
        ) : (
          <Table theme={tableTheme}>
            <TableHead>
              <TableRow>
                <TableHeadCell>Contributo</TableHeadCell>
                <TableHeadCell className="text-right">Importo</TableHeadCell>
                <TableHeadCell className="text-right">F24</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody className="divide-y divide-slate-100">
              {righeInps.map((r, i) => {
                const scad = scadenzeContributi.find((s) => `${s.categoria}${s.voce ? ' · ' + s.voce : ''}` === r.descrizione)
                return (
                  <TableRow key={i} className="bg-white">
                    <TableCell className="py-2.5 pr-4 text-slate-700">
                      {r.descrizione}
                      {r.data && <span className="block text-xs text-slate-400">entro il {r.data}</span>}
                    </TableCell>
                    <TableCell className="py-2.5 text-right tabular-nums whitespace-nowrap">{formatEuro(r.importo)}</TableCell>
                    <TableCell className="py-2.5 text-right">
                      <Button size="xs" color="light" disabled={!r.codeline || !scad} onClick={() => scad && apriF24Inps(r, scad)}>
                        <FileDown size={14} className="mr-1" aria-hidden /> Apri F24
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Imposta sostitutiva */}
      {scadenzeImposte.length > 0 && (
        <Card title="Imposta sostitutiva" icon={FileText} iconIntent="income">
          <Table theme={tableTheme}>
            <TableHead>
              <TableRow>
                <TableHeadCell>Adempimento</TableHeadCell>
                <TableHeadCell className="text-right">Importo</TableHeadCell>
                <TableHeadCell className="text-right">F24</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody className="divide-y divide-slate-100">
              {scadenzeImposte.map((s, i) => (
                <TableRow key={i} className="bg-white">
                  <TableCell className="py-2.5 pr-4 text-slate-700">
                    {s.categoria}{s.voce ? ` · ${s.voce}` : ''}
                    {s.data && <span className="block text-xs text-slate-400">entro il {s.data}</span>}
                  </TableCell>
                  <TableCell className="py-2.5 text-right tabular-nums whitespace-nowrap">{formatEuro(s.importo)}</TableCell>
                  <TableCell className="py-2.5 text-right">
                    <Button size="xs" color="light" onClick={() => apriF24Imposta(s)}>
                      <FileDown size={14} className="mr-1" aria-hidden /> Apri F24
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <p className={theme.helpText}>
        I modelli F24 sono facsimile di supporto, generati con codici tributo e codeline calcolati dall'app.
        Verifica gli importi e le codeline sugli strumenti ufficiali (Agenzia Entrate / Cassetto INPS) prima
        del versamento. Nessuna responsabilità per errori o pagamenti respinti.
      </p>
    </div>
  )
}
