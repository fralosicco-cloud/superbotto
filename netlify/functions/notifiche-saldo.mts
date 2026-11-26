import type { Config } from '@netlify/functions'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { impostazioni, statoGruppo } from '../../db/schema.js'
import { inviaNotifica, primaVolta } from './lib/push.mts'
import { calcolaSaldi, type StatoGruppo } from './lib/saldi.mts'
import { romeNow } from './lib/tempo.mts'

// Dopo ogni estrazione avvisa i partecipanti con saldo negativo che devono fare un nuovo versamento.
export default async () => {
  const imp = (await db.select().from(impostazioni).where(eq(impostazioni.id, 'giocate-automatiche')).limit(1))[0]
  if (imp && !imp.attiva) {
    console.log('[notifiche-saldo] Giocate automatiche fermate: nessun avviso inviato.')
    return
  }

  const riga = (await db.select().from(statoGruppo).where(eq(statoGruppo.id, 'main')).limit(1))[0]
  const stato = (riga?.dati as { stato?: StatoGruppo } | undefined)?.stato
  if (!stato) {
    console.log('[notifiche-saldo] Stato del gruppo non ancora disponibile.')
    return
  }

  const oggi = romeNow().iso
  const saldi = calcolaSaldi(stato, imp?.periodi ?? [{ da: null, al: null }])
  let avvisati = 0

  for (const { user, saldo } of saldi) {
    if (saldo >= 0) continue
    if (!(await primaVolta(`rosso:${user}:${oggi}`))) continue
    const inviate = await inviaNotifica(
      { nomi: [user] },
      {
        titolo: '🔴 Sei in rosso',
        testo: `Il tuo saldo è di ${saldo.toFixed(2).replace('.', ',')} €. Fai un nuovo versamento per continuare a giocare con il gruppo.`,
        pagina: 'versamenti',
        tag: 'saldo-rosso',
      },
    )
    if (inviate > 0) avvisati++
  }

  console.log(`[notifiche-saldo] Partecipanti in rosso avvisati: ${avvisati}`)
}

// Martedì, giovedì, venerdì e sabato alle 20:45 UTC (21:45 o 22:45 ora italiana), dopo l'estrazione.
export const config: Config = {
  schedule: '45 20 * * 2,4,5,6',
}
