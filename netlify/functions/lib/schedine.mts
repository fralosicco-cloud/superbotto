import { randomInt } from 'node:crypto'
import { asc, eq } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { schedineMensili } from '../../../db/schema.js'
import { inviaNotifica } from './push.mts'
import { romeNow } from './tempo.mts'

import { INIZIO_MENSILI } from './regole.mts'

export { INIZIO_MENSILI }

export type SchedineMese = typeof schedineMensili.$inferSelect

function estrai(quanti: number, max: number): number[] {
  const scelti = new Set<number>()
  while (scelti.size < quanti) scelti.add(randomInt(1, max + 1))
  return [...scelti].sort((a, b) => a - b)
}

export function meseCorrente(): string {
  return romeNow().iso.slice(0, 7)
}

function elenco(n: number[]): string {
  return n.join(' · ')
}

// Restituisce le schedine del mese indicato, generandole (e notificando il gruppo) se non esistono ancora.
export async function schedineDelMese(mese: string): Promise<SchedineMese | null> {
  if (mese < INIZIO_MENSILI.slice(0, 7)) return null
  const esistenti = await db.select().from(schedineMensili).where(eq(schedineMensili.mese, mese)).limit(1)
  if (esistenti[0]) return esistenti[0]

  const superenalotto = { numeri: estrai(6, 90), superstar: randomInt(1, 91) }
  const eurojackpot = { numeri: estrai(5, 50), euronumeri: estrai(2, 12) }
  const inserite = await db
    .insert(schedineMensili)
    .values({ mese, superenalotto, eurojackpot })
    .onConflictDoNothing()
    .returning()

  if (inserite[0]) {
    // Solo chi ha creato davvero la riga invia la notifica (niente doppioni)
    const [anno, m] = mese.split('-')
    const nomeMese = new Date(Date.UTC(Number(anno), Number(m) - 1, 15)).toLocaleDateString('it-IT', { month: 'long', timeZone: 'UTC' })
    try {
      await inviaNotifica(
        { tutti: true },
        {
          titolo: `🎲 Nuove schedine di ${nomeMese}`,
          testo: `SuperEnalotto: ${elenco(superenalotto.numeri)} ⭐ ${superenalotto.superstar} — EuroJackpot: ${elenco(eurojackpot.numeri)} + ${elenco(eurojackpot.euronumeri)}`,
          pagina: 'schedina',
          tag: `schedine-${mese}`,
        },
      )
    } catch (err) {
      console.error('[schedine] Notifica non inviata:', err)
    }
    return inserite[0]
  }

  const ora = await db.select().from(schedineMensili).where(eq(schedineMensili.mese, mese)).limit(1)
  return ora[0] ?? null
}

export async function tutteLeSchedine(): Promise<SchedineMese[]> {
  return db.select().from(schedineMensili).orderBy(asc(schedineMensili.mese))
}
