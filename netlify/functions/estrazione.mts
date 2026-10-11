import type { Config } from '@netlify/functions'

const ARCHIVE_URL = 'https://superenalottooggi.com/archivio'
const HOME_URL = 'https://superenalottooggi.com/'

const MONTHS: Record<string, number> = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
}

interface Estrazione {
  data: string
  numeri: number[]
  superstar: number | null
  jolly: number | null
}

function formatItDate(day: number, month: number, year: number): string {
  return `${day}/${month}/${year}`
}

function parseDateFromUrl(day: string, monthName: string, year: string): { day: number; month: number; year: number } | null {
  const month = MONTHS[monthName.toLowerCase()]
  const d = Number(day)
  const y = Number(year)
  if (!month || !d || !y) return null
  return { day: d, month, year: y }
}

function extractArchiveRows(html: string): Estrazione[] {
  const results: Estrazione[] = []
  const rows = html.split(/<tr[\s>]/i).slice(1)
  for (const row of rows) {
    const linkMatch = row.match(/href="\/archivio\/estrazione-(\d{1,2})-([a-zàèù]+)-(\d{4})"/i)
    if (!linkMatch) continue
    const dateParts = parseDateFromUrl(linkMatch[1], linkMatch[2], linkMatch[3])
    if (!dateParts) continue

    const balls: number[] = []
    const ballRegex = /num-ball(?:-jolly|-superstar)?(?:\s[^>]*)?">(\d{1,2})</gi
    let m: RegExpExecArray | null
    while ((m = ballRegex.exec(row)) !== null) {
      const n = Number(m[1])
      if (n >= 1 && n <= 90) balls.push(n)
    }
    if (balls.length < 6) continue

    const jollyMatch = row.match(/num-ball-jolly[^>]*">(\d{1,2})</i)
    const starMatch = row.match(/num-ball-superstar[^>]*">(\d{1,2})</i)

    results.push({
      data: formatItDate(dateParts.day, dateParts.month, dateParts.year),
      numeri: balls.slice(0, 6),
      jolly: jollyMatch ? Number(jollyMatch[1]) : null,
      superstar: starMatch ? Number(starMatch[1]) : null,
    })
  }
  return results
}

function extractHomePage(html: string): Estrazione | null {
  const jollyMatch = html.match(/class="ball ball--jolly">(\d{1,2})</)
  if (!jollyMatch) return null
  const starMatch = html.match(/class="ball ball--star">(\d{1,2})</)

  const cardWindow = html.slice(Math.max(0, jollyMatch.index - 4000), jollyMatch.index)
  const dateMatch = cardWindow.match(/(\d{1,2})\s+([a-zàèù]+)\s+(\d{4})/i)
  if (!dateMatch) return null
  const dateParts = parseDateFromUrl(dateMatch[1], dateMatch[2], dateMatch[3])
  if (!dateParts) return null

  const balls: number[] = []
  const ballRegex = /class="ball">(\d{1,2})</g
  let m: RegExpExecArray | null
  while ((m = ballRegex.exec(cardWindow)) !== null) {
    const n = Number(m[1])
    if (n >= 1 && n <= 90) balls.push(n)
  }
  if (balls.length < 6) return null

  return {
    data: formatItDate(dateParts.day, dateParts.month, dateParts.year),
    numeri: balls.slice(-6),
    jolly: Number(jollyMatch[1]),
    superstar: starMatch ? Number(starMatch[1]) : null,
  }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

export default async (req: Request) => {
  const html = (await fetchText(ARCHIVE_URL)) ?? (await fetchText(HOME_URL))

  if (!html) {
    return Response.json(
      { error: 'Impossibile scaricare i risultati delle estrazioni.' },
      { status: 502 },
    )
  }

  let estrazioni = extractArchiveRows(html)
  if (estrazioni.length === 0) {
    const latest = extractHomePage(html)
    if (latest) estrazioni = [latest]
  }

  if (estrazioni.length === 0) {
    return Response.json(
      { error: 'Nessuna estrazione trovata nella pagina dei risultati.' },
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
