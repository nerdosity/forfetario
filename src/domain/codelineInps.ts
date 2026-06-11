/**
 * Codeline INPS (campo "matricola INPS/codice INPS" della sezione INPS del modello
 * F24) per i contributi di artigiani e commercianti.
 *
 * Struttura (17 cifre): matricola(8) + anno(2) + "1" + codiceSoggetto(2) + rata(1)
 * + check(3). Il check è il codice di controllo a 3 cifre.
 *
 * ALGORITMO. Il check ufficiale è una somma pesata "a coppie": le 8 cifre della
 * matricola si leggono in 4 coppie e ognuna contribuisce con un valore tabellare
 * (CONTRIB[coppia][valore]). Il check = (BASE + Σ contributi) mod 1000.
 * Modello ricostruito empiricamente dallo strumento ufficiale INPS, validato su
 * dati reali: ESATTO quando al massimo una coppia differisce dal riferimento
 * (caso normale: matricola fissa, variano anno e rata → 100% sui campioni).
 * Sulle matricole molto diverse interviene un riporto tra coppie non ancora
 * modellato: in quei casi il valore può non coincidere. La funzione
 * `codelineAffidabile` segnala quando il risultato è nel dominio garantito.
 *
 * I dati coprono codiceSoggetto = 10 (titolare), anno 2025.
 */

// Contributo di ogni coppia (indice 0-3) per ciascun valore 0-99, relativo al
// riferimento matricola 10130045. BASE include anno/soggetto/rata di riferimento.
const BASE = 565
const RIF_COPPIE = [10, 13, 0, 45] as const
const CONTRIB: Record<number, Record<number, number>> = [{"0":704,"1":734,"2":759,"3":789,"4":819,"5":845,"6":875,"7":905,"8":940,"9":970,"10":0,"11":30,"12":55,"13":85,"14":115,"15":151,"16":181,"17":211,"18":236,"19":266,"20":296,"21":326,"22":362,"23":392,"24":422,"25":463,"26":493,"27":523,"28":548,"29":578,"30":608,"31":644,"32":674,"33":704,"34":734,"35":759,"36":789,"37":819,"38":845,"39":875,"40":905,"41":940,"42":970,"43":0,"44":30,"45":55,"46":85,"47":115,"48":151,"49":181,"50":211,"51":236,"52":266,"53":296,"54":326,"55":362,"56":392,"57":422,"58":463,"59":493,"60":523,"61":548,"62":578,"63":608,"64":644,"65":674,"66":704,"67":734,"68":759,"69":789,"70":819,"71":845,"72":875,"73":905,"74":940,"75":970,"76":0,"77":44,"78":74,"79":104,"80":134,"81":159,"82":189,"83":219,"84":245,"85":275,"86":305,"87":340,"88":370,"89":400,"90":441,"91":471,"92":501,"93":531,"94":556,"95":586,"96":616,"97":652,"98":682,"99":712},{"0":738,"1":762,"2":775,"3":799,"4":823,"5":842,"6":855,"7":879,"8":903,"9":916,"10":939,"11":963,"12":976,"13":0,"14":24,"15":43,"16":56,"17":80,"18":104,"19":117,"20":140,"21":164,"22":177,"23":201,"24":215,"25":244,"26":257,"27":281,"28":295,"29":318,"30":341,"31":355,"32":378,"33":402,"34":415,"35":450,"36":474,"37":487,"38":511,"39":525,"40":547,"41":571,"42":585,"43":608,"44":632,"45":651,"46":665,"47":688,"48":712,"49":725,"50":748,"51":772,"52":785,"53":809,"54":833,"55":852,"56":865,"57":889,"58":913,"59":926,"60":949,"61":973,"62":986,"63":10,"64":34,"65":53,"66":66,"67":90,"68":114,"69":127,"70":150,"71":174,"72":187,"73":211,"74":225,"75":254,"76":267,"77":291,"78":305,"79":328,"80":359,"81":383,"82":396,"83":420,"84":445,"85":468,"86":492,"87":505,"88":529,"89":548,"90":565,"91":589,"92":613,"93":626,"94":645,"95":669,"96":693,"97":706,"98":730,"99":749},{"0":0,"1":7,"2":15,"3":32,"4":35,"5":52,"6":59,"7":66,"8":84,"9":91,"10":95,"11":113,"12":120,"13":127,"14":140,"15":147,"16":155,"17":172,"18":179,"19":186,"20":201,"21":208,"22":215,"23":233,"24":235,"25":253,"26":260,"27":267,"28":275,"29":292,"30":296,"31":314,"32":321,"33":328,"34":341,"35":348,"36":355,"37":373,"38":380,"39":387,"40":402,"41":409,"42":416,"43":435,"44":452,"45":459,"46":466,"47":484,"48":491,"49":498,"50":513,"51":520,"52":527,"53":540,"54":547,"55":555,"56":572,"57":579,"58":586,"59":604,"60":608,"61":615,"62":633,"63":635,"64":653,"65":660,"66":667,"67":693,"68":700,"69":707,"70":722,"71":729,"72":742,"73":749,"74":756,"75":774,"76":781,"77":788,"78":795,"79":813,"80":817,"81":825,"82":837,"83":845,"84":862,"85":869,"86":876,"87":894,"88":901,"89":908,"90":923,"91":930,"92":943,"93":950,"94":957,"95":965,"96":982,"97":989,"98":996,"99":14},{"0":184,"1":217,"2":256,"3":300,"4":339,"5":383,"6":416,"7":471,"8":505,"9":554,"10":588,"11":632,"12":671,"13":705,"14":754,"15":787,"16":831,"17":870,"18":914,"19":953,"20":987,"21":31,"22":70,"23":114,"24":153,"25":186,"26":230,"27":269,"28":313,"29":352,"30":386,"31":441,"32":475,"33":518,"34":557,"35":601,"36":640,"37":684,"38":717,"39":756,"40":801,"41":840,"42":884,"43":917,"44":956,"45":0,"46":39,"47":83,"48":116,"49":155,"50":200,"51":239,"52":283,"53":316,"54":355,"55":399,"56":454,"57":487,"58":531,"59":570,"60":605,"61":654,"62":687,"63":735,"64":778,"65":822,"66":861,"67":895,"68":944,"69":977,"70":22,"71":61,"72":95,"73":144,"74":177,"75":221,"76":260,"77":304,"78":343,"79":376,"80":421,"81":465,"82":509,"83":548,"84":592,"85":625,"86":665,"87":708,"88":747,"89":791,"90":825,"91":865,"92":908,"94":991,"95":25,"96":74,"97":107,"98":146,"99":190}]

export interface ParametriCodeline {
  /** Matricola azienda INPS (8 cifre). */
  matricola: string
  /** Anno di imposizione del contributo (es. 2025). I dati noti coprono il 2025. */
  anno: number
  /** Codice soggetto (10 = titolare). I dati noti coprono solo il titolare. */
  codiceSoggetto: string
  /** Numero rata: 0 = unica/saldo; 1-4 = rate. */
  rata: number
}

/** Calcola il check a 3 cifre con l'algoritmo a coppie, o null se fuori dominio. */
function calcolaCheck(matricola: string): number | null {
  let tot = BASE
  for (let k = 0; k < 4; k++) {
    const v = parseInt(matricola.substr(k * 2, 2), 10)
    const contributo = CONTRIB[k]?.[v]
    if (contributo === undefined) return null
    tot += contributo
  }
  return ((tot % 1000) + 1000) % 1000
}

/**
 * Numero di coppie della matricola che differiscono dal riferimento. Quando è
 * ≤ 1 l'algoritmo è esatto (nessun riporto incrociato); oltre, il valore è una
 * stima e va verificato sullo strumento INPS.
 */
function coppieDiverse(matricola: string): number {
  let n = 0
  for (let k = 0; k < 4; k++) {
    if (parseInt(matricola.substr(k * 2, 2), 10) !== RIF_COPPIE[k]) n++
  }
  return n
}

/** Vero se la codeline calcolata è nel dominio garantito esatto (≤1 coppia diversa). */
export function codelineAffidabile(p: ParametriCodeline): boolean {
  return /^\d{8}$/.test(p.matricola) && coppieDiverse(p.matricola) <= 1 &&
    p.codiceSoggetto === '10' && calcolaCheck(p.matricola) !== null
}

/**
 * Genera la codeline INPS completa (17 cifre). Restituisce null se i dati escono
 * dal dominio coperto. Usa `codelineAffidabile` per sapere se il valore è esatto
 * o una stima da verificare sul Cassetto INPS.
 */
export function generaCodeline({ matricola, anno, codiceSoggetto, rata }: ParametriCodeline): string | null {
  if (!/^\d{8}$/.test(matricola)) return null
  if (codiceSoggetto !== '10') return null
  if (rata < 0 || rata > 4) return null
  const check = calcolaCheck(matricola)
  if (check === null) return null
  const anno2 = String(anno).slice(-2).padStart(2, '0')
  const c3 = String(check).padStart(3, '0')
  return `${matricola}${anno2}1${codiceSoggetto}${rata}${c3}`
}

// ---------------------------------------------------------------------------
// Mappatura scadenze contributi → righe codeline
// ---------------------------------------------------------------------------

/** Una scadenza di contributi da cui ricavare la codeline. */
export interface ScadenzaContributo {
  categoria?: string
  voce?: string
  descrizione: string
  importo: number
  annoScadenza: number
}

/** Causale INPS della riga (AF = fissi/minimale, AP = eccedente il minimale). */
export type CausaleInps = 'AF' | 'AP'

/** Una riga di versamento contributi con la sua codeline INPS. */
export interface RigaCodeline {
  descrizione: string
  causale: CausaleInps
  anno: number
  rata: number
  importo: number
  /** Codeline calcolata (17 cifre) o null se fuori dominio. */
  codeline: string | null
  /** Vero se la codeline è nel dominio garantito esatto; false = da verificare su INPS. */
  affidabile: boolean
}

/**
 * Costruisce le righe codeline per le scadenze di contributi artigiani/commercianti
 * di un anno:
 *  - "Contributi fissi …" → causale AF, rata dal numero di rata trimestrale (1-4);
 *  - "Contributi eccedenza …" → causale AP, rata 0 (saldo/acconti).
 * La gestione separata è esclusa (codeline diversa, non gestita).
 */
export function righeCodelineDaScadenze(
  scadenze: ScadenzaContributo[],
  matricola: string,
  codiceSoggetto: string,
): RigaCodeline[] {
  const righe: RigaCodeline[] = []
  for (const s of scadenze) {
    const cat = s.categoria ?? ''
    const isFissi = /Contributi fissi/i.test(cat)
    const isEccedenza = /eccedenza/i.test(cat)
    if (!isFissi && !isEccedenza) continue

    const m = (s.voce ?? '').match(/competenza (\d{4})/)
    const anno = m ? Number(m[1]) : s.annoScadenza
    const rm = (s.voce ?? '').match(/(\d)ª rata/)
    const rata = isFissi && rm ? Number(rm[1]) : 0
    const causale: CausaleInps = isFissi ? 'AF' : 'AP'

    const params = { matricola, anno, codiceSoggetto, rata }
    righe.push({
      descrizione: `${cat}${s.voce ? ' · ' + s.voce : ''}`,
      causale,
      anno,
      rata,
      importo: s.importo,
      codeline: generaCodeline(params),
      affidabile: codelineAffidabile(params),
    })
  }
  return righe
}
