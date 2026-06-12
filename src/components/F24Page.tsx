import { useMemo } from 'react'
import { FileDown, FileText, TriangleAlert, ArrowRight } from 'lucide-react'
import { Button, Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from 'flowbite-react'
import type { RisultatoCalcolo, Scadenza } from '@/domain/types'
import { righeCodelineDaScadenze, type RigaCodeline } from '@/domain/codelineInps'
import type { AnagraficaContribuente } from '@/data/anagraficaStorage'
import { Card } from '@/components/ui'
import { formatEuro } from '@/domain/labels'
import { theme, tableTheme } from '@/theme'
import type { ModuloF24, RigaInpsF24, RigaErarioF24 } from '@/pdf/f24Pdf'

interface Props {
  anno: number
  calcoli: RisultatoCalcolo
  anagrafica: AnagraficaContribuente
  /** Porta l'utente alla sezione "Anagrafica e dati" per completare i campi. */
  onVaiAiDati: () => void
}

// Periodo "01/AAAA - 12/AAAA" dalla competenza letta nella voce della scadenza.
function periodoCompetenza(voce: string | undefined, annoDefault: number): { dal: string; al: string } {
  const m = (voce ?? '').match(/competenza (\d{4})/)
  const a = m ? m[1] : String(annoDefault)
  return { dal: `01/${a}`, al: `12/${a}` }
}

/** Pagina F24: genera i modelli F24 (imposte + contributi INPS). */
export function F24Page({ anno, calcoli, anagrafica: anag, onVaiAiDati }: Props) {
  const matricolaValida = /^\d{8}$/.test(anag.matricolaInps)
  const soggettoValido = /^\d{2}$/.test(anag.codiceSoggettoInps)
  const sedeValida = /^\d{4}$/.test(anag.sedeInps)
  const datiInpsCompleti = matricolaValida && soggettoValido && sedeValida

  // Anagrafica persona: serve a compilare la sezione contribuente degli F24.
  // Il minimo utile è il codice fiscale; cognome/nome completano l'intestazione.
  const haDatiPersona = anag.codiceFiscale.trim().length > 0

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

  // Dati utente mancanti per generare ciascun batch di F24.
  const mancano: string[] = []
  if (!haDatiPersona) mancano.push('il codice fiscale (per gli F24 dell’imposta sostitutiva)')
  if (!datiInpsCompleti) mancano.push('sede, matricola e codice soggetto INPS (per gli F24 dei contributi)')

  return (
    <div className="space-y-6">
      {/* Avviso: dati anagrafici mancanti per generare i modelli */}
      {mancano.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-amber-600" aria-hidden />
            <div className="text-sm text-amber-800">
              <p className="font-medium">Mancano alcuni dati per compilare gli F24.</p>
              <p className="mt-0.5">
                Inserisci {mancano.length === 1 ? mancano[0] : (
                  <>{mancano[0]} e {mancano[1]}</>
                )} nella sezione anagrafica.
              </p>
            </div>
          </div>
          <Button size="sm" color="warning" onClick={onVaiAiDati} className="shrink-0 self-start sm:self-auto">
            Vai ai dati
            <ArrowRight size={15} className="ml-2" aria-hidden />
          </Button>
        </div>
      )}

      {/* Contributi INPS */}
      <Card title="Contributi INPS" icon={FileText} iconIntent="warning"
        info="Modelli F24 per i contributi artigiani/commercianti, con codeline e causale precompilate.">
        {!datiInpsCompleti ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className={`${theme.helpText} flex-1 min-w-[16rem]`}>
              Per generare i modelli F24 dei contributi inserisci sede, matricola e codice soggetto INPS nella
              sezione anagrafica: servono a calcolare la codeline.
            </p>
            <Button size="xs" color="light" onClick={onVaiAiDati} className="shrink-0">
              Vai ai dati
              <ArrowRight size={14} className="ml-1.5" aria-hidden />
            </Button>
          </div>
        ) : righeInps.length === 0 ? (
          <p className={theme.helpText}>Nessuna scadenza di contributi artigiani/commercianti.</p>
        ) : (
          <Table theme={tableTheme}>
            <TableHead>
              <TableRow>
                <TableHeadCell>Contributo</TableHeadCell>
                <TableHeadCell className="text-right">Importo</TableHeadCell>
                <TableHeadCell className="text-center">F24</TableHeadCell>
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
                    <TableCell className="py-2.5">
                      <div className="flex w-full justify-center">
                        <Button size="xs" color="light" disabled={!r.codeline || !scad} onClick={() => scad && apriF24Inps(r, scad)}>
                          <FileDown size={14} className="mr-1" aria-hidden /> Apri F24
                        </Button>
                      </div>
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
                <TableHeadCell className="text-center">F24</TableHeadCell>
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
                  <TableCell className="py-2.5">
                    <div className="flex w-full justify-center">
                      <Button size="xs" color="light" onClick={() => apriF24Imposta(s)}>
                        <FileDown size={14} className="mr-1" aria-hidden /> Apri F24
                      </Button>
                    </div>
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
