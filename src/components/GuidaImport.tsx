import { useState } from 'react'
import { ChevronDown, ChevronUp, Copy, FileJson } from 'lucide-react'
import { Button } from 'flowbite-react'
import { Card } from '@/components/ui'
import { ESEMPIO_IMPORT, PROMPT_IMPORT, SPEC_IMPORT } from '@/domain/specImport'
import { theme } from '@/theme'

/**
 * Guida ripiegabile per importare i dati da un file JSON preparato con un
 * assistente AI a partire da dichiarazione, F24 o movimenti bancari.
 */
export function GuidaImport() {
  const [aperta, setAperta] = useState(false)
  const [esito, setEsito] = useState<string | null>(null)

  const copia = async (testo: string, nome: string) => {
    try {
      await navigator.clipboard.writeText(testo)
      setEsito(`${nome} copiato negli appunti.`)
    } catch {
      setEsito('Copia non riuscita: seleziona il testo e copialo manualmente.')
    }
  }

  return (
    <Card
      title="Importare i dati da un file JSON"
      icon={FileJson}
      iconIntent="info"
      info="Se non vuoi inserire tutto a mano, puoi dare a un assistente AI (ChatGPT, Gemini, Claude) la vecchia dichiarazione, i PDF degli F24 o i movimenti bancari, insieme al prompt. Salva la risposta come file .json e caricala con il pulsante Importa. Controlla sempre i dati importati."
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button color="light" size="sm" onClick={() => copia(PROMPT_IMPORT, 'Prompt')}>
          <Copy size={15} className="mr-2" aria-hidden />
          Copia prompt
        </Button>
        <Button color="light" size="sm" onClick={() => copia(SPEC_IMPORT, 'Specifica')}>
          <Copy size={15} className="mr-2" aria-hidden />
          Copia specifica
        </Button>
        <button type="button" className={theme.btnSuggerimento} onClick={() => setAperta((a) => !a)} aria-expanded={aperta}>
          <span className="inline-flex items-center gap-1">
            {aperta ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
            {aperta ? 'Nascondi la specifica' : 'Mostra la specifica'}
          </span>
        </button>
        {esito && (
          <span className={theme.helpText} role="status">
            {esito}
          </span>
        )}
      </div>

      {aperta && (
        <div className="mt-4 space-y-3">
          <pre className={theme.codeBlock}>{SPEC_IMPORT}</pre>
          <h3 className={theme.h3}>Esempio</h3>
          <pre className={theme.codeBlock}>{JSON.stringify(ESEMPIO_IMPORT, null, 2)}</pre>
        </div>
      )}
    </Card>
  )
}
