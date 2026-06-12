import { useState } from 'react'
import { IdCard } from 'lucide-react'
import { TextInput } from 'flowbite-react'
import type { AnagraficaContribuente } from '@/data/anagraficaStorage'
import { SEDI_INPS } from '@/data/sediInps'
import { Card, Field, Select } from '@/components/ui'
import { theme } from '@/theme'

interface Props {
  anagrafica: AnagraficaContribuente
  onChange: (a: AnagraficaContribuente) => void
}

/**
 * Pannello dati anagrafici del contribuente: dati persona (sezione "contribuente"
 * del modello F24) e dati INPS (sede, matricola, codice soggetto, per la codeline
 * dei contributi artigiani/commercianti). Sormonta le sezioni per anno nel tab
 * dati: questi dati sono unici, non variano di anno in anno.
 */
export function AnagraficaPanel({ anagrafica, onChange }: Props) {
  const set = (patch: Partial<AnagraficaContribuente>) => onChange({ ...anagrafica, ...patch })

  // Testo della sede mostrato nella combo (nome + SAP); deriva dal codice salvato.
  const [sedeTesto, setSedeTesto] = useState(() => {
    const s = SEDI_INPS.find((x) => x.sap === anagrafica.sedeInps)
    return s ? `${s.nome} (${s.sap})` : ''
  })

  const matricolaValida = /^\d{8}$/.test(anagrafica.matricolaInps)
  const soggettoValido = /^\d{2}$/.test(anagrafica.codiceSoggettoInps)
  const sedeValida = /^\d{4}$/.test(anagrafica.sedeInps)

  return (
    <Card
      title="Anagrafica contribuente"
      icon={IdCard}
      iconIntent="info"
      info="Dati della persona e dati INPS, comuni a tutti gli anni: servono per compilare i modelli F24 (sezione contribuente) e per calcolare la codeline dei contributi artigiani/commercianti."
    >
      <p className={`${theme.helpText} -mt-2 mb-4`}>
        Questi dati valgono per tutti gli anni. I campi lasciati vuoti restano caselle bianche nei
        modelli F24, da completare a mano.
      </p>

      {/* ── Dati persona ── */}
      <p className={`${theme.groupLabel} mb-2`}>Dati anagrafici</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Codice fiscale" htmlFor="anag-cf">
          <TextInput
            id="anag-cf"
            value={anagrafica.codiceFiscale}
            maxLength={16}
            placeholder="RSSMRA80A01H501U"
            onChange={(e) => set({ codiceFiscale: e.target.value.toUpperCase().slice(0, 16) })}
            className="font-mono uppercase"
          />
        </Field>
        <Field label="Cognome" htmlFor="anag-cognome">
          <TextInput
            id="anag-cognome"
            value={anagrafica.cognome}
            placeholder="Rossi"
            onChange={(e) => set({ cognome: e.target.value })}
          />
        </Field>
        <Field label="Nome" htmlFor="anag-nome">
          <TextInput
            id="anag-nome"
            value={anagrafica.nome}
            placeholder="Mario"
            onChange={(e) => set({ nome: e.target.value })}
          />
        </Field>
        <Field label="Data di nascita" htmlFor="anag-nascita" info="Formato GG/MM/AAAA.">
          <TextInput
            id="anag-nascita"
            value={anagrafica.dataNascita}
            placeholder="01/01/1980"
            onChange={(e) => set({ dataNascita: e.target.value })}
          />
        </Field>
        <Field label="Sesso" htmlFor="anag-sesso">
          <Select<'' | 'M' | 'F'>
            value={anagrafica.sesso}
            onChange={(v) => set({ sesso: v })}
            options={[
              { value: '', label: '—' },
              { value: 'M', label: 'M' },
              { value: 'F', label: 'F' },
            ]}
          />
        </Field>
        <Field label="Comune di nascita" htmlFor="anag-comune">
          <TextInput
            id="anag-comune"
            value={anagrafica.comuneNascita}
            placeholder="Roma"
            onChange={(e) => set({ comuneNascita: e.target.value })}
          />
        </Field>
        <Field label="Provincia di nascita" htmlFor="anag-prov" info="Sigla a 2 lettere (es. RM).">
          <TextInput
            id="anag-prov"
            value={anagrafica.provinciaNascita}
            maxLength={2}
            placeholder="RM"
            onChange={(e) => set({ provinciaNascita: e.target.value.toUpperCase().slice(0, 2) })}
            className="uppercase"
          />
        </Field>
      </div>

      {/* ── Dati INPS (codeline) ── */}
      <p className={`${theme.groupLabel} mt-6 mb-2`}>Dati INPS</p>
      <p className={`${theme.helpText} mb-3`}>
        Servono per la codeline dei contributi artigiani/commercianti nei modelli F24.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Sede INPS" htmlFor="anag-sede" info="Digita il nome della sede (SAP) e selezionala dall'elenco.">
          <TextInput
            id="anag-sede"
            list="anag-sedi"
            value={sedeTesto}
            placeholder="es. Milano, Roma Eur…"
            color={!sedeTesto || sedeValida ? undefined : 'failure'}
            onChange={(e) => {
              const t = e.target.value
              setSedeTesto(t)
              const sede = SEDI_INPS.find((s) => `${s.nome} (${s.sap})` === t)
              set({ sedeInps: sede ? sede.sap : '' })
            }}
          />
          <datalist id="anag-sedi">
            {SEDI_INPS.map((s) => <option key={s.sap} value={`${s.nome} (${s.sap})`} />)}
          </datalist>
        </Field>
        <Field label="Matricola INPS azienda" htmlFor="anag-matr" info="8 cifre.">
          <TextInput
            id="anag-matr"
            value={anagrafica.matricolaInps}
            maxLength={8}
            placeholder="12345678"
            color={!anagrafica.matricolaInps || matricolaValida ? undefined : 'failure'}
            onChange={(e) => set({ matricolaInps: e.target.value.replace(/\D/g, '').slice(0, 8) })}
            className="font-mono"
          />
        </Field>
        <Field label="Codice soggetto" htmlFor="anag-sogg" info="10 = titolare; 11, 12… collaboratori.">
          <TextInput
            id="anag-sogg"
            value={anagrafica.codiceSoggettoInps}
            maxLength={2}
            color={soggettoValido ? undefined : 'failure'}
            onChange={(e) => set({ codiceSoggettoInps: e.target.value.replace(/\D/g, '').slice(0, 2) })}
            className="font-mono"
          />
        </Field>
      </div>
    </Card>
  )
}
