import { useMemo } from 'react'
import { FileText, TriangleAlert, ArrowRight, FileDown } from 'lucide-react'
import { Button, Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from 'flowbite-react'
import type { CalcoloInput, RisultatoCalcolo, Scadenza } from '@/domain/types'
import { righeCodelineDaScadenze, type RigaCodeline } from '@/domain/codelineInps'
import type { AnagraficaContribuente } from '@/data/anagraficaStorage'
import { Card } from '@/components/ui'
import { formatEuro } from '@/domain/labels'
import { theme, tableTheme } from '@/theme'
import type { ModuloF24, RigaInpsF24, RigaErarioF24 } from '@/pdf/f24Pdf'
import { versatoPerScadenza } from '@/domain/scadenze'

const MESI_IT: Record<string, number> = {
  Gennaio: 0, Febbraio: 1, Marzo: 2, Aprile: 3, Maggio: 4, Giugno: 5,
  Luglio: 6, Agosto: 7, Settembre: 8, Ottobre: 9, Novembre: 10, Dicembre: 11,
}

/** True se la data testuale "GG Mese AAAA" è passata da almeno 30 giorni. */
function scadutaDa30Giorni(data: string): boolean {
  const [gg, mese, aaaa] = data.split(' ')
  const d = new Date(Number(aaaa), MESI_IT[mese] ?? 0, Number(gg))
  return (Date.now() - d.getTime()) >= 30 * 86_400_000
}

/** True se risulta almeno un versamento collegato alla scadenza (a prescindere dall'importo). */
function haVersamento(scad: Scadenza, input: CalcoloInput): boolean {
  const v = versatoPerScadenza(scad, input)
  return v != null && v > 0.005
}

interface Props {
  anno: number
  calcoli: RisultatoCalcolo
  input: CalcoloInput
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
export function F24Page({ anno, calcoli, input, anagrafica: anag, onVaiAiDati }: Props) {
  const matricolaValida = /^\d{8}$/.test(anag.matricolaInps)
  const soggettoValido = /^\d{2}$/.test(anag.codiceSoggettoInps)
  const sedeValida = /^\d{4}$/.test(anag.sedeInps)
  const datiInpsCompleti = matricolaValida && soggettoValido && sedeValida

  // Anagrafica persona: serve a compilare la sezione contribuente degli F24.
  // Il minimo utile è il codice fiscale; cognome/nome completano l'intestazione.
  const haDatiPersona = anag.codiceFiscale.trim().length > 0

  // Scadenze contributi artigiani/commercianti (con codeline) e relative codeline.
  const scadenzeContributi = useMemo(
    () => [...calcoli.scadenzeAnnoCorrente, ...calcoli.scadenzeAnnoSuccessivo]
      .filter((s) => /Contributi (fissi|eccedenza)/i.test(s.categoria ?? '') && s.importo > 0.005),
    [calcoli],
  )

  // Scadenze contributi gestione separata (causale PXX, nessuna codeline).
  const scadenzeGS = useMemo(
    () => [...calcoli.scadenzeAnnoCorrente, ...calcoli.scadenzeAnnoSuccessivo]
      .filter((s) => /Gestione separata/i.test(s.categoria ?? '') && s.importo > 0.005),
    [calcoli],
  )
  const righeInps: RigaCodeline[] = datiInpsCompleti
    ? righeCodelineDaScadenze(scadenzeContributi, anag.matricolaInps, anag.codiceSoggettoInps, anag.sedeInps)
    : []

  // Genera e apre il PDF di un singolo F24 INPS. Sulle righe-rata di un piano
  // di rateazione gli interessi vanno esposti a parte con la causale API.
  const apriF24Inps = async (riga: RigaCodeline, scad: Scadenza) => {
    const scheda = window.open('', '_blank')
    const { dal, al } = periodoCompetenza(scad.voce, anno)
    const compQuota = scad.componenti.find((c) => /^Quota/.test(c.tipo))
    const compInteressi = scad.componenti.find((c) => /^Interessi/.test(c.tipo))
    const inps: RigaInpsF24[] = [
      {
        codiceSede: anag.sedeInps,
        causale: riga.causale,
        codeline: riga.codeline ?? '',
        periodoDal: dal,
        periodoAl: al,
        importo: compQuota?.importo ?? riga.importo,
      },
      ...(compInteressi
        ? [{
            codiceSede: anag.sedeInps,
            causale: 'API',
            codeline: '',
            periodoDal: dal,
            periodoAl: al,
            importo: compInteressi.importo,
          }]
        : []),
    ]
    const mRata = scad.voce?.match(/(\d)ª rata/)
    const mAcconto = scad.voce?.match(/(\d°) acconto/)
    const mRataPiano = scad.voce?.match(/rata (\d+) di (\d+)/)
    const etichettaBase = mRata
      ? `${mRata[1]}ª RATA`
      : mAcconto
        ? `${mAcconto[1].toUpperCase()} ACCONTO`
        : 'SALDO'
    const etichettaInps = mRataPiano
      ? `${etichettaBase} · RATA ${mRataPiano[1]} DI ${mRataPiano[2]}`
      : etichettaBase
    const modulo: ModuloF24 = {
      etichettaRata: etichettaInps,
      scadenza: riga.data,
      erario: [],
      inps,
      anagrafica: anag,
    }
    const { generaPdfF24 } = await import('@/pdf/f24Pdf')
    const url = await generaPdfF24([modulo], `F24 INPS ${riga.descrizione}`)
    if (scheda) scheda.location.replace(url)
    else window.open(url, '_blank', 'noopener')
  }

  // Genera e apre il PDF F24 di una scadenza gestione separata: sezione INPS
  // con causale PXX (professionisti senza altra copertura previdenziale, aliquota
  // piena — quella usata dai calcoli dell'app), campo matricola/codice INPS vuoto
  // (il versamento è riferito al codice fiscale del contribuente).
  const apriF24Gs = async (scad: Scadenza) => {
    const scheda = window.open('', '_blank')
    const { dal, al } = periodoCompetenza(scad.voce, anno)
    // Righe-rata di un piano di rateazione: causale PXXR e interessi a parte
    // con causale DPPI.
    const mRataGs = scad.voce?.match(/rata (\d+) di (\d+)/)
    const compQuota = scad.componenti.find((c) => /^Quota/.test(c.tipo))
    const compInteressi = scad.componenti.find((c) => /^Interessi/.test(c.tipo))
    const inps: RigaInpsF24[] = [
      {
        codiceSede: anag.sedeInps,
        causale: mRataGs ? 'PXXR' : 'PXX',
        codeline: '',
        periodoDal: dal,
        periodoAl: al,
        importo: compQuota?.importo ?? scad.importo,
      },
      ...(compInteressi
        ? [{
            codiceSede: anag.sedeInps,
            causale: 'DPPI',
            codeline: '',
            periodoDal: dal,
            periodoAl: al,
            importo: compInteressi.importo,
          }]
        : []),
    ]
    const mAccontoGs = scad.voce?.match(/(\d°) acconto/)
    const etichettaGsBase = mAccontoGs ? `${mAccontoGs[1].toUpperCase()} ACCONTO` : 'SALDO'
    const modulo: ModuloF24 = {
      etichettaRata: mRataGs ? `${etichettaGsBase} · RATA ${mRataGs[1]} DI ${mRataGs[2]}` : etichettaGsBase,
      scadenza: scad.data,
      erario: [],
      inps,
      anagrafica: anag,
    }
    const { generaPdfF24 } = await import('@/pdf/f24Pdf')
    const url = await generaPdfF24([modulo], `F24 INPS ${scad.descrizione}`)
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
    const mAccontoImp = scad.voce?.match(/(\d)° acconto/)
    // Anno di riferimento = anno d'imposta PER CUI si versa (la competenza nella
    // voce), non l'anno in cui si paga: saldo 2025 versato nel 2026 → 2025,
    // 1° acconto 2026 versato a giugno 2026 → 2026.
    const mComp = scad.voce?.match(/competenza (\d{4})/)
    const annoRiferimento = mComp ? Number(mComp[1]) : anno
    // Codici tributo: 1792 saldo, 1790 acconto prima rata, 1791 acconto seconda
    // rata. Campo rateazione NNRR per le rate di un piano, 0101 altrimenti.
    const codiceTributo = isSaldo ? '1792' : mAccontoImp?.[1] === '2' ? '1791' : '1790'
    const mRataImp = scad.voce?.match(/rata (\d) di (\d)/)
    const rateazione = mRataImp ? `0${mRataImp[1]}0${mRataImp[2]}` : '0101'
    // Sulle righe-rata di un piano gli interessi vanno esposti a parte con il
    // codice 1668 (come nel PDF del piano di rateazione), non sommati al tributo.
    const compQuota = scad.componenti.find((c) => /^Quota/.test(c.tipo))
    const compInteressi = scad.componenti.find((c) => /^Interessi/.test(c.tipo))
    const erario: RigaErarioF24[] = [
      { codiceTributo, rateazione, annoRiferimento, importo: compQuota?.importo ?? scad.importo },
      ...(compInteressi
        ? [{ codiceTributo: '1668', annoRiferimento, importo: compInteressi.importo }]
        : []),
    ]
    const etichettaBase = isSaldo
      ? 'SALDO'
      : mAccontoImp
        ? `${mAccontoImp[1]}° ACCONTO`
        : 'ACCONTO'
    const etichettaImp = mRataImp
      ? `${etichettaBase} · RATA ${mRataImp[1]} DI ${mRataImp[2]}`
      : etichettaBase
    const modulo: ModuloF24 = {
      etichettaRata: etichettaImp,
      scadenza: scad.data,
      erario,
      inps: [],
      anagrafica: anag,
    }
    const { generaPdfF24 } = await import('@/pdf/f24Pdf')
    const url = await generaPdfF24([modulo], `F24 imposta ${scad.voce ?? ''}`)
    if (scheda) scheda.location.replace(url)
    else window.open(url, '_blank', 'noopener')
  }

  // Dati utente mancanti per generare ciascun batch di F24. Gli avvisi INPS
  // compaiono solo se esistono scadenze della gestione corrispondente.
  const mancano: string[] = []
  if (!haDatiPersona) mancano.push('il codice fiscale (per gli F24 dell’imposta sostitutiva)')
  if (scadenzeContributi.length > 0 && !datiInpsCompleti) {
    mancano.push('sede, matricola e codice soggetto INPS (per gli F24 dei contributi artigiani/commercianti)')
  }
  if (scadenzeGS.length > 0 && !sedeValida) {
    mancano.push('il codice sede INPS (per gli F24 dei contributi gestione separata)')
  }
  const elencoMancanti = mancano.length <= 1
    ? mancano[0]
    : `${mancano.slice(0, -1).join(', ')} e ${mancano[mancano.length - 1]}`

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
                Inserisci {elencoMancanti} nella sezione anagrafica.
              </p>
            </div>
          </div>
          <Button size="sm" color="warning" onClick={onVaiAiDati} className="shrink-0 self-start sm:self-auto">
            Vai ai dati
            <ArrowRight size={15} className="ml-2" aria-hidden />
          </Button>
        </div>
      )}

      {/* Contributi artigiani/commercianti (nascosta se ci sono solo scadenze G.S.) */}
      {(scadenzeContributi.length > 0 || scadenzeGS.length === 0) && (
      <Card title="Contributi artigiani/commercianti" icon={FileText} iconIntent="warning"
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
                const sbiadita = !!(scad && haVersamento(scad, input)) || (r.data ? scadutaDa30Giorni(r.data) : false)
                return (
                  <TableRow key={i} className="bg-white">
                    <TableCell className={`py-2.5 pr-4 ${sbiadita ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                      {r.descrizione}
                      {r.data && <span className="block text-xs text-slate-300">entro il {r.data}</span>}
                    </TableCell>
                    <TableCell className={`py-2.5 text-right tabular-nums whitespace-nowrap ${sbiadita ? 'text-slate-400 line-through' : ''}`}>{formatEuro(r.importo)}</TableCell>
                    <TableCell className="py-2.5">
                      <div className="flex w-full justify-center">
                        <button
                          disabled={!r.codeline || !scad}
                          onClick={() => scad && apriF24Inps(r, scad)}
                          title="Scarica modello F24"
                          className="inline-flex items-center justify-center rounded-md border border-blue-200 bg-blue-50 p-1.5 text-blue-600 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <FileDown size={15} aria-hidden />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>
      )}

      {/* Contributi gestione separata */}
      {scadenzeGS.length > 0 && (
        <Card title="Contributi gestione separata" icon={FileText} iconIntent="warning"
          info="Modelli F24 con causale PXX (professionisti senza altra copertura previdenziale, aliquota piena — quella usata dai calcoli). Se sei iscritto anche ad altra forma previdenziale o pensionato la causale è P10: correggila sul modello. Il campo matricola resta vuoto, il versamento è riferito al codice fiscale.">
          <Table theme={tableTheme}>
            <TableHead>
              <TableRow>
                <TableHeadCell>Contributo</TableHeadCell>
                <TableHeadCell className="text-right">Importo</TableHeadCell>
                <TableHeadCell className="text-center">F24</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody className="divide-y divide-slate-100">
              {scadenzeGS.map((s, i) => {
                const sbiadita = haVersamento(s, input) || scadutaDa30Giorni(s.data)
                return (
                  <TableRow key={i} className="bg-white">
                    <TableCell className={`py-2.5 pr-4 ${sbiadita ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                      {s.categoria}{s.voce ? ` · ${s.voce}` : ''}
                      {s.data && <span className="block text-xs text-slate-300">entro il {s.data}</span>}
                    </TableCell>
                    <TableCell className={`py-2.5 text-right tabular-nums whitespace-nowrap ${sbiadita ? 'text-slate-400 line-through' : ''}`}>{formatEuro(s.importo)}</TableCell>
                    <TableCell className="py-2.5">
                      <div className="flex w-full justify-center">
                        <button
                          onClick={() => apriF24Gs(s)}
                          title="Scarica modello F24"
                          className="inline-flex items-center justify-center rounded-md border border-blue-200 bg-blue-50 p-1.5 text-blue-600 transition-colors hover:bg-blue-100"
                        >
                          <FileDown size={15} aria-hidden />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}

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
              {scadenzeImposte.map((s, i) => {
                const sbiadita = haVersamento(s, input) || scadutaDa30Giorni(s.data)
                return (
                  <TableRow key={i} className="bg-white">
                    <TableCell className={`py-2.5 pr-4 ${sbiadita ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                      {s.categoria}{s.voce ? ` · ${s.voce}` : ''}
                      {s.data && <span className="block text-xs text-slate-300">entro il {s.data}</span>}
                    </TableCell>
                    <TableCell className={`py-2.5 text-right tabular-nums whitespace-nowrap ${sbiadita ? 'text-slate-400 line-through' : ''}`}>{formatEuro(s.importo)}</TableCell>
                    <TableCell className="py-2.5">
                      <div className="flex w-full justify-center">
                        <button
                          onClick={() => apriF24Imposta(s)}
                          title="Scarica modello F24"
                          className="inline-flex items-center justify-center rounded-md border border-blue-200 bg-blue-50 p-1.5 text-blue-600 transition-colors hover:bg-blue-100"
                        >
                          <FileDown size={15} aria-hidden />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
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
