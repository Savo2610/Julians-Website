// Das Rundflug-Ticket. Es gilt fuer genau einen Flug und liegt im Browser,
// wie Bestzeit und Pistenpass. Geloest wird es an der Skikasse, eingeloest an
// der Drohne – zwei Orte an entgegengesetzten Enden des Tals, damit der Flug
// etwas ist, wofuer man faehrt, und nicht ein Knopf neben dem anderen.
//
// Umsonst, solange es keinen Server gibt, der eine Zahlung pruefen koennte:
// alles hier laeuft im Browser, und was der Browser zaehlt, kann jeder in der
// Konsole umstellen. Ein bezahltes Ticket gehoert deshalb nicht hierher,
// sondern hinter einen Worker, der die Ueberweisung auf der Kette nachsieht.

// Zwei Tickets, beide gratis, beide an der Skikasse: der Rundflug wird an
// der Drohne entwertet, der Kabelsee am Badesteg (src/sommer/). Am See gilt
// es fuer einen Besuch, gleich wie viele Sessions man dort faehrt.
function ticketFuer(key) {
  const lesen = () => {
    try { return localStorage.getItem(key) === '1' } catch { return false }
  }
  const schreiben = (an) => {
    try {
      if (an) localStorage.setItem(key, '1')
      else localStorage.removeItem(key)
    } catch { /* privates Fenster: gilt dann nur bis zum Neuladen */ }
  }
  let vorhanden = lesen()
  return {
    get vorhanden() { return vorhanden },
    loesen() {
      vorhanden = true
      schreiben(true)
    },
    // true, wenn eines da war – dann ist es jetzt entwertet.
    einloesen() {
      if (!vorhanden) return false
      vorhanden = false
      schreiben(false)
      return true
    },
  }
}

export const ticket = ticketFuer('skiportfolio.rundflug')
export const seeTicket = ticketFuer('skiportfolio.kabelsee')
