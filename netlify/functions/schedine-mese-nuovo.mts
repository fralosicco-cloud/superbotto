import type { Config } from '@netlify/functions'
import { meseCorrente, schedineDelMese } from './lib/schedine.mts'

// Ogni giorno a mezzanotte (ora italiana) si assicura che esistano le schedine casuali del mese:
// il primo del mese vengono generate quelle nuove e il gruppo riceve una notifica.
export default async () => {
  const mese = meseCorrente()
  const s = await schedineDelMese(mese)
  console.log(`[schedine-mese-nuovo] ${mese}: ${s ? 'schedine pronte' : 'nuove schedine non ancora attive'}`)
}

// 23:05 e 00:05 UTC: copre la mezzanotte italiana sia con l'ora solare sia con l'ora legale.
export const config: Config = {
  schedule: '5 0,23 * * *',
}
