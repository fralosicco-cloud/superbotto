import type { Config } from '@netlify/functions'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { statoGruppo } from '../../db/schema.js'
import { controllaSaldiNegativi } from './lib/rosso.mts'
import type { StatoGruppo } from './lib/saldi.mts'

// Dopo ogni estrazione avvisa i partecipanti con saldo negativo che devono fare un nuovo versamento.
export default async () => {
  const riga = (await db.select().from(statoGruppo).where(eq(statoGruppo.id, 'main')).limit(1))[0]
  const stato = (riga?.dati as { stato?: StatoGruppo } | undefined)?.stato
  if (!stato) {
    console.log('[notifiche-saldo] Stato del gruppo non ancora disponibile.')
    return
  }

  const avvisati = await controllaSaldiNegativi(stato, { promemoria: true })
  console.log(`[notifiche-saldo] Partecipanti in rosso avvisati: ${avvisati}`)
}

// Martedì, giovedì, venerdì e sabato alle 20:45 UTC (21:45 o 22:45 ora italiana), dopo l'estrazione.
export const config: Config = {
  schedule: '45 20 * * 2,4,5,6',
}
