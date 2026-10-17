import type { Config } from '@netlify/functions'
import { fetchEstrazioni } from './lib/scraping.mts'

export default async (req: Request) => {
  const estrazioni = await fetchEstrazioni()

  if (estrazioni.length === 0) {
    return Response.json(
      { error: 'Impossibile scaricare i risultati delle estrazioni.' },
      { status: 502 },
    )
  }

  return Response.json(
    { estrazioni },
    {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=1800',
      },
    },
  )
}

export const config: Config = {
  path: '/api/estrazione',
  method: ['GET'],
}