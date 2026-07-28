import { useEffect, useState } from 'react'
import { ArrowLeft, ExternalLink, FileText } from 'lucide-react'
import { Badge, Button, Label, Radio, Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow, TextInput } from 'flowbite-react'
import type { InizioRateazione, OpzioniRateazione, Scadenza } from '@/domain/types'
import { calcolaPianoRateazione, numeroRateMax, piu30Giorni, rateazioneNeutra } from '@/domain/rateazione'
import { formattaScadenza, mmggDaLeggibile } from '@/domain/dates'
import type { GestioneRateazione } from '@/pdf/rateazionePdf'
import { formatEuro } from '@/domain/labels'
import { caricaAnagrafica, salvaAnagrafica, type AnagraficaContribuente } from '@/data/anagraficaStorage'
import { Field, Modal, Select, Tooltip } from '@/components/ui'
import { theme, tableTheme } from '@/theme'

interface Props {
  /** Scadenza da rateizzare (anche una riga-rata: si risale all'importo originario). */
  scadenza: Scadenza
  /** Scelta attuale per questa scadenza, se già configurata. */
  opzioniAttuali?: OpzioniRateazione
  onClose: () => void
  /** Salva la scelta (null = torna al versamento unico ordinario). */
  onSave: (opzioni: OpzioniRateazione | null) => void
}

const aliquotaTesto = (aliquota: number) =>
  `${(aliquota * 100).toFixed(2).replace('.', ',')}%`

/** Voce della scadenza senza l'eventuale suffisso di rata (per titoli e PDF). */
const voceBase = (s: Scadenza): string =>
  (s.voce ?? '').replace(/ · rata \d+ di \d+$/, '').replace(/ · differito (al 30 luglio|di 30 giorni)$/, '')

/**
 * Ricava gestione, tipo di versamento e anno di competenza dalla chiave di
 * rateazione (es. "saldo-2025", "acconto1-2026", "gs-saldo-2025",
 * "ecc-acconto1-2026"). Null se la chiave non è riconosciuta.
 */
function parseChiave(
  chiave?: string,
): { gestione: GestioneRateazione; tipo: 'saldo' | 'acconto1'; annoCompetenza: number } | null {
  const m = chiave?.match(/^(?:(gs|ecc)-)?(saldo|acconto1)-(\d{4})$/)
  if (!m) return null
  return {
    gestione: (m[1] as 'gs' | 'ecc' | undefined) ?? 'imposta',
    tipo: m[2] as 'saldo' | 'acconto1',
    annoCompetenza: Number(m[3]),
  }
}

/**
 * Popup di rateazione di un versamento (imposta sostitutiva o contributi da
 * quadro RR) in due passi: scelta della prima scadenza (ordinaria o differita
 * di 30 giorni con maggiorazione 0,4%) e del numero di rate con anteprima del
 * piano; poi, per scaricare il PDF con le deleghe F24 in facsimile, i dati
 * anagrafici del contribuente (facoltativi, ricordati per le volte successive).
 */
export function RateazioneModal({ scadenza, opzioniAttuali, onClose, onSave }: Props) {
  const [inizio, setInizio] = useState<InizioRateazione>(opzioniAttuali?.inizio ?? 'giugno')
  const [numeroRate, setNumeroRate] = useState(opzioniAttuali?.numeroRate ?? 1)
  const [passo, setPasso] = useState<'opzioni' | 'anagrafica'>('opzioni')
  const [anagrafica, setAnagrafica] = useState<AnagraficaContribuente>(caricaAnagrafica)

  // Passando a luglio il massimo scende a 6: riallinea la scelta se eccede.
  useEffect(() => {
    setNumeroRate((n) => Math.min(n, numeroRateMax(inizio)))
  }, [inizio])

  // Persiste l'anagrafica a ogni modifica: non va reinserita la prossima volta.
  useEffect(() => {
    salvaAnagrafica(anagrafica)
  }, [anagrafica])

  const anno = scadenza.annoScadenza
  const importoBase = scadenza.importoRateazioneBase ?? scadenza.importo
  // Data della scadenza originaria: sulle righe-rata è quella salvata dalla
  // espansione, altrimenti la data della scadenza stessa. Il piano parte da lì
  // (per i contributi la prima scadenza può non essere il 30/06).
  const dataBase = scadenza.dataRateazioneBase ?? scadenza.data
  const mmggBase = mmggDaLeggibile(dataBase) ?? '06-30'
  const opzioni: OpzioniRateazione = { inizio, numeroRate }
  const datiChiave = parseChiave(scadenza.chiaveRateazione)
  // I contributi INPS seguono regole proprie: nessuna soglia sugli interessi e
  // maggiorazione 0,4% esposta a parte.
  const modalita = datiChiave && datiChiave.gestione !== 'imposta' ? 'inps' : 'erario'
  const piano = calcolaPianoRateazione(importoBase, opzioni, { mmgg: mmggBase, anno }, modalita)
  const neutra = rateazioneNeutra(opzioni)

  const aggiorna = (campo: keyof AnagraficaContribuente) => (valore: string) =>
    setAnagrafica((a) => ({ ...a, [campo]: valore }))

  // CF facoltativo, ma se inserito deve avere 16 caratteri alfanumerici.
  const cfNonValido =
    anagrafica.codiceFiscale !== '' && !/^[A-Z0-9]{16}$/.test(anagrafica.codiceFiscale)

  // Il PDF si apre in una nuova scheda: da lì si può salvare o stampare.
  // La scheda va aperta SUBITO (dentro il gesto utente), prima degli await,
  // altrimenti il blocco popup del browser la sopprime.
  const generaPdf = async () => {
    if (!datiChiave) return
    const scheda = window.open('', '_blank')
    const { generaPdfRateazione } = await import('@/pdf/rateazionePdf')
    const url = await generaPdfRateazione({
      intestazione: `${scadenza.categoria ?? scadenza.descrizione} · ${voceBase(scadenza)} · ${formatEuro(importoBase)}`,
      gestione: datiChiave.gestione,
      tipoVersamento: datiChiave.tipo,
      annoCompetenza: datiChiave.annoCompetenza,
      annoScadenza: anno,
      piano,
      anagrafica,
    })
    if (scheda) scheda.location.replace(url)
    else window.open(url, '_blank', 'noopener')
    setPasso('opzioni')
  }

  const footerOpzioni = (
    <>
      <span className="mr-auto flex items-center gap-2">
        {datiChiave && (
          <Button color="light" onClick={() => setPasso('anagrafica')}>
            <FileText size={16} className="mr-2" aria-hidden />
            Genera PDF
          </Button>
        )}
        {opzioniAttuali && (
          <Button color="light" onClick={() => onSave(null)}>
            Rimuovi rateazione
          </Button>
        )}
      </span>
      <Button color="light" onClick={onClose}>
        Annulla
      </Button>
      <Button onClick={() => onSave(neutra ? null : { inizio, numeroRate })}>
        Applica
      </Button>
    </>
  )

  const footerAnagrafica = (
    <>
      <Button color="light" onClick={() => setPasso('opzioni')} className="mr-auto">
        <ArrowLeft size={16} className="mr-2" aria-hidden />
        Indietro
      </Button>
      <Button onClick={generaPdf} disabled={cfNonValido}>
        <ExternalLink size={16} className="mr-2" aria-hidden />
        Apri PDF
      </Button>
    </>
  )

  return (
    <Modal
      open
      onClose={onClose}
      size="4xl"
      title={passo === 'opzioni' ? 'Rateazione del versamento' : 'Dati del contribuente'}
      subtitle={`${scadenza.categoria ?? scadenza.descrizione} · ${voceBase(scadenza)} · ${formatEuro(importoBase)}`}
      footer={passo === 'opzioni' ? footerOpzioni : footerAnagrafica}
    >
      {passo === 'opzioni' ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset className="space-y-2">
              <legend className={`${theme.labelSmall} mb-2 flex items-center gap-1.5`}>
                Prima scadenza
                <Tooltip
                  content="Il versamento può essere differito di 30 giorni rispetto alla scadenza ordinaria applicando la maggiorazione dello 0,4% sull'intero importo."
                  label="Informazioni sulla prima scadenza"
                  posizione="sotto"
                  allinea="sinistra"
                />
              </legend>
              <div className="flex items-center gap-2">
                <Radio
                  id="rateazione-giugno"
                  name="rateazione-inizio"
                  checked={inizio === 'giugno'}
                  onChange={() => setInizio('giugno')}
                />
                <Label htmlFor="rateazione-giugno" className="font-normal">
                  {formattaScadenza(mmggBase, anno)} — ordinaria, fino a 7 rate
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Radio
                  id="rateazione-luglio"
                  name="rateazione-inizio"
                  checked={inizio === 'luglio'}
                  onChange={() => setInizio('luglio')}
                />
                <Label htmlFor="rateazione-luglio" className="font-normal">
                  {formattaScadenza(piu30Giorni(mmggBase, anno), anno)} — maggiorazione 0,4%, fino a 6 rate
                </Label>
              </div>
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor="rateazione-numero" className={`${theme.labelSmall} flex items-center gap-1.5`}>
                Numero di rate
                <Tooltip
                  content="Le rate successive alla prima scadono il giorno 16 di ciascun mese (il 20 ad agosto) e maturano interessi di rateazione del 4% annuo (0,33% al mese), come nel software ufficiale dell'Agenzia delle Entrate. Per l'imposta sostitutiva gli interessi di una rata non superiori a 1,03 € non sono dovuti: con importi piccoli le prime rate possono quindi risultare senza interessi. Per i contributi INPS la soglia non si applica e gli interessi sono dovuti da ogni rata successiva alla prima. L'ultima rata cade entro il 16 dicembre."
                  label="Informazioni sul numero di rate"
                  posizione="sotto"
                  allinea="sinistra"
                />
              </Label>
              <Select
                id="rateazione-numero"
                value={numeroRate}
                options={Array.from({ length: numeroRateMax(inizio) }, (_, i) => ({
                  value: i + 1,
                  label: i === 0 ? 'Versamento unico' : `${i + 1} rate`,
                }))}
                onChange={setNumeroRate}
              />
            </div>
          </div>

          <div>
            <p className={`${theme.groupLabel} mb-2`}>Piano dei versamenti</p>
            <div>
              <Table theme={tableTheme}>
                <TableHead>
                  <TableRow>
                    <TableHeadCell>Rata</TableHeadCell>
                    <TableHeadCell>Scadenza</TableHeadCell>
                    <TableHeadCell className="text-right">Quota</TableHeadCell>
                    <TableHeadCell className="text-right">Interessi</TableHeadCell>
                    <TableHeadCell className="text-right">Importo</TableHeadCell>
                  </TableRow>
                </TableHead>
                <TableBody className="divide-y">
                  {piano.rate.map((rata) => (
                    <TableRow key={rata.numero} className="bg-white">
                      <TableCell>{numeroRate === 1 ? 'Unica' : `${rata.numero} di ${numeroRate}`}</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {formattaScadenza(rata.dataMMGG, anno)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatEuro(rata.quota)}</TableCell>
                      <TableCell className="text-right tabular-nums text-slate-500">
                        {rata.maggiorazione
                          ? `${formatEuro(rata.interessi + rata.maggiorazione)} (interessi e maggiorazione)`
                          : rata.interessi > 0
                            ? `${formatEuro(rata.interessi)} (${aliquotaTesto(rata.aliquotaInteressi)})`
                            : '—'}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{formatEuro(rata.importo)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-sm">
              {piano.maggiorazione > 0 && (
                <span className="text-slate-500">
                  Maggiorazione 0,4%: <span className="font-medium tabular-nums">{formatEuro(piano.maggiorazione)}</span>
                </span>
              )}
              {piano.totaleInteressi > 0 && (
                <span className="text-slate-500">
                  Interessi: <span className="font-medium tabular-nums">{formatEuro(piano.totaleInteressi)}</span>
                </span>
              )}
              <Badge color="info" className="w-fit text-sm">
                Totale {formatEuro(piano.totale)}
              </Badge>
            </div>
            <p className={`${theme.helpText} mt-2`}>
              Date nominali: se festive slittano al primo giorno lavorativo utile. Con più di una rata
              la voce non viene più confrontata con i versamenti inseriti.
            </p>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            Il PDF si apre in una nuova scheda — da lì puoi salvarlo o stamparlo — e contiene il piano
            di rateazione più una delega F24 in facsimile sul modello ufficiale per ogni rata
            ({piano.opzioni.numeroRate === 1 ? 'versamento unico' : `${piano.opzioni.numeroRate} rate`}, prima scadenza{' '}
            {formattaScadenza(piano.rate[0].dataMMGG, anno)}). I dati restano sul tuo dispositivo e
            vengono ricordati per i prossimi PDF; i campi lasciati vuoti resteranno da compilare a mano.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Codice fiscale" htmlFor="anag-cf">
              <TextInput
                id="anag-cf"
                value={anagrafica.codiceFiscale}
                maxLength={16}
                placeholder="RSSMRA80A01H501U"
                color={cfNonValido ? 'failure' : undefined}
                onChange={(e) => aggiorna('codiceFiscale')(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                className="font-mono"
              />
              {cfNonValido && (
                <p className="mt-1 text-xs text-red-600">
                  Il codice fiscale deve avere 16 caratteri alfanumerici.
                </p>
              )}
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Cognome" htmlFor="anag-cognome">
                <TextInput
                  id="anag-cognome"
                  value={anagrafica.cognome}
                  onChange={(e) => aggiorna('cognome')(e.target.value)}
                />
              </Field>
              <Field label="Nome" htmlFor="anag-nome">
                <TextInput
                  id="anag-nome"
                  value={anagrafica.nome}
                  onChange={(e) => aggiorna('nome')(e.target.value)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Data di nascita" htmlFor="anag-nascita">
                <TextInput
                  id="anag-nascita"
                  value={anagrafica.dataNascita}
                  placeholder="GG/MM/AAAA"
                  onChange={(e) => aggiorna('dataNascita')(e.target.value)}
                />
              </Field>
              <Field label="Sesso" htmlFor="anag-sesso">
                <Select
                  id="anag-sesso"
                  value={anagrafica.sesso}
                  options={[
                    { value: '', label: '—' },
                    { value: 'M', label: 'M' },
                    { value: 'F', label: 'F' },
                  ]}
                  onChange={(v) => setAnagrafica((a) => ({ ...a, sesso: v as AnagraficaContribuente['sesso'] }))}
                />
              </Field>
            </div>
            <div className="grid grid-cols-[1fr_5rem] gap-4">
              <Field label="Comune (o Stato estero) di nascita" htmlFor="anag-comune">
                <TextInput
                  id="anag-comune"
                  value={anagrafica.comuneNascita}
                  onChange={(e) => aggiorna('comuneNascita')(e.target.value)}
                />
              </Field>
              <Field label="Prov." htmlFor="anag-prov">
                <TextInput
                  id="anag-prov"
                  value={anagrafica.provinciaNascita}
                  maxLength={2}
                  onChange={(e) => aggiorna('provinciaNascita')(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                />
              </Field>
            </div>
          </div>
        </>
      )}
    </Modal>
  )
}
