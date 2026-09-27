// Die Kacheln der Uebersicht, in der Reihenfolge und mit den Worten der
// alten Kachelseite. Im Tal oeffnet eine Kachel ihre Station (station +
// pick) mit allem, was dort dazugehoert – etwa dem Solana-Fenster statt
// eines nackten solana:-Links. `link` ist der Schluessel in LINKS: ihn
// oeffnet die Uebersicht bei Kacheln ohne Station, und die Linkliste ohne
// Tal (linkliste.js) zeigt ihn fuer alle.
//
// Drohne, Loeschzug und die gefrorene Quelle fehlen absichtlich: sie liegen
// abseits, damit man sie findet.
//
// Reines Datenmodul ohne Browser und three.js – vite.config.js liest es
// beim Bauen.

export const KACHELN = [
  { titel: 'Karriere', weg: 'career', kacheln: [
    { icon: '💼', label: 'LinkedIn', sub: 'Meine Erfahrung', link: 'linkedin', station: 'werkstatt', pick: 0 },
    { icon: '⚙️', label: 'GitHub', sub: 'Meine Projekte', link: 'github', station: 'werkstatt', pick: 1 },
  ] },
  { titel: 'Kontakt', weg: 'social', kacheln: [
    { icon: '💬', label: 'Signal', sub: 'Schreib mir', link: 'signal', station: 'kontakt', pick: 0 },
    { icon: '📸', label: 'Instagram', sub: 'Schöne Fotos', link: 'instagram', station: 'kontakt', pick: 1 },
  ] },
  { titel: 'Geld senden', weg: 'social', kacheln: [
    { icon: '💸', label: 'PayPal', sub: 'paypal.me/juliansebv', link: 'paypal', station: 'kasse', pick: 0 },
    { icon: '◎', label: 'Solana', sub: 'Echtes Geld', link: 'solana', station: 'kasse', pick: 1 },
  ] },
  { titel: 'Meine Tools', weg: 'tools', kacheln: [
    { icon: '🔗', label: 'Kurzlink', sub: 'Links kürzen', link: 'shortener', station: 'shortener' },
    { icon: '🎒', label: 'Packliste', sub: 'Nichts vergessen', link: 'packlist', station: 'packlist' },
    { icon: '⏱️', label: 'Arbeitszeit', sub: 'Wie lange arbeitest du?', link: 'worktime', station: 'worktime' },
    { icon: '📤', label: 'File Uploader', sub: 'Sende mir Dateien', link: 'upload', station: 'upload' },
  ] },
  // Spotify und Komoot haben noch keinen Platz im Tal (HANDOVER, Offen).
  { titel: 'Außerdem', kacheln: [
    { icon: '🎵', label: 'Spotify', sub: 'Höre was ich höre', link: 'spotify' },
    { icon: '🏔️', label: 'Komoot', sub: 'Wandern & Radfahren', link: 'komoot' },
  ] },
]
