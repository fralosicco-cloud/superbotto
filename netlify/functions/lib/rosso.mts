import { eq } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { impostazioni, notificheInviate } from '../../../db/schema.js'
import { inviaNotifica, primaVolta } from './push.mts'
import { calcolaSaldi, type StatoGruppo } from './saldi.mts'
import { romeNow } from './tempo.mts'

function euro(n: number): string {
  return n.toFixed(2).replace('.', ',')
}

// Controlla i saldi e avvisa chi è in rosso.
// - Appena il saldo di un partecipante passa sotto zero riceve subito un avviso (una volta per ogni "discesa" in rosso).
// - Con promemoria=true (dopo ogni estrazione) chi è ancora in rosso riceve un promemoria, al massimo uno al giorno.
// Quando il saldo torna positivo o a zero lo stato "in rosso" si azzera.
export async function controllaSaldiNegativi(stato: StatoGruppo, opzioni: { promemoria: boolean }): Promise<number> {
  const imp = (await db.select().from(impostazioni).where(eq(impostazioni.id, 'giocate-automatiche')).limit(1))[0]
  const saldi = calcolaSaldi(stato, imp?.periodi ?? [{ da: null, al: null }])
  const oggi = romeNow().iso
  const giocatePausa = !!imp && !imp.attiva
  let avvisati = 0

  for (const { user, saldo } of saldi) {
    const chiaveStato = `rosso-stato:${user}`
    if (saldo >= 0) {
      await db.delete(notificheInviate).where(eq(notificheInviate.chiave, chiaveStato))
      continue
    }

    const appenaAndatoInRosso = await primaVolta(chiaveStato)
    if (appenaAndatoInRosso) {
      // Conta anche come promemoria di oggi, così non arrivano due avvisi nella stessa sera
      await primaVolta(`rosso:${user}:${oggi}`)
      const inviate = await inviaNotifica(
        { nomi: [user] },
        {
          titolo: '🔴 La tua cassa è andata in negativo',
          testo: `Il tuo saldo è sceso a ${euro(saldo)} €. Fai un nuovo versamento al cassiere per continuare a giocare con il gruppo.`,
          pagina: 'versamenti',
          tag: 'saldo-rosso',
        },
      )
      if (inviate > 0) avvisati++
      continue
    }

    if (!opzioni.promemoria || giocatePausa) continue
    if (!(await primaVolta(`rosso:${user}:${oggi}`))) continue
    const inviate = await inviaNotifica(
      { nomi: [user] },
      {
        titolo: '🔴 Sei ancora in rosso',
        testo: `Il tuo saldo è di ${euro(saldo)} €. Ricordati di fare un nuovo versamento per continuare a giocare con il gruppo.`,
        pagina: 'versamenti',
        tag: 'saldo-rosso',
      },
    )
    if (inviate > 0) avvisati++
  }

  return avvisati
}
