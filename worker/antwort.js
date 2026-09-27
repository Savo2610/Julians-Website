// Antworten der API: immer JSON, Fehler als { fehler } mit deutschem Text,
// den das Spiel so anzeigen kann, wie er kommt.

export const json = (daten, status = 200, extra = {}) => new Response(JSON.stringify(daten), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
})

export const fehler = (text, status = 400) => json({ fehler: text }, status)
