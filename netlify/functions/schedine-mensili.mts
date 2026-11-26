import type { Config } from '@netlify/functions'
import { meseCorrente, schedineDelMese, tutteLeSchedine, INIZIO_MENSILI } from './lib/schedine.mts'

// Restituisce le schedine mensili (SuperEnalotto + EuroJackpot), creando quelle del mese in corso se mancano.
export default async () => {
  await schedineDelMese(meseCorrente())
  const mesi = await tutteLeSchedine()
  return Response.json(
    {
      inizio: INIZIO_MENSILI,
      mesi: mesi.map((m) => ({ mese: m.mese, superenalotto: m.superenalotto, eurojackpot: m.eurojackpot })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export const config: Config = {
  path: '/api/schedine-mensili',
  method: ['GET'],
}
