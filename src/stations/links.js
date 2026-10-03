// Zentrale Stelle fuer alle echten Adressen. Hier eintragen, sonst nirgends –
// die Objekte in der Welt referenzieren nur die Schluessel.
//
// Die Liste stammt von der frueheren Kachelseite auf veerka.mp, die dieses
// Tal abgeloest hat; seitdem gibt es sie nur noch hier.

export const LINKS = {
  // Beruflich – beide in der Werkstatt
  github: 'https://github.com/Savo2610',
  linkedin: 'https://linkedin.com/in/jsveerkamp',

  // Sozial
  instagram: 'https://instagram.com/juliansebv',
  signal: 'https://signal.me/#eu/JnL6PouqINGbQCUuNhXo69gpY5xPND4QNTH02ntumokkWus1NVRGC490c4jjJo2r',

  // Bezahlen. Solana ist keine Adresse zum Oeffnen, sondern ein Dialog –
  // siehe dialogs/wallet.js. Der Schluessel bleibt trotzdem hier stehen,
  // damit die Skikasse weiss, dass es diesen Weg gibt.
  paypal: 'https://paypal.me/juliansebv',
  solana: 'solana:BvCkY1zzww8gv6Akn7XNPw9dzj4XJxyyT4GHF9Jev5Da',

  // Spotify hat noch keinen Platz im Tal (siehe HANDOVER, Offen) und steht
  // bis dahin nur in der Uebersicht. Komoot liegt im Gipfelbuch ueber der
  // Nordabfahrt.
  spotify: 'https://stats.fm/savo',
  komoot: 'https://www.komoot.de/user/464140060326',

  // Eigene Dienste
  upload: 'https://upload.veerka.mp',
  shortener: 'https://s.veerka.mp',
  packlist: 'https://packliste.veerka.mp',
  worktime: 'https://zeit.veerka.mp',
  // Haengt an der gefrorenen Quelle am See, die zeigt, was dort laeuft.
  broadcast: 'https://broadcast.veerka.mp',

  // Projekte. Sie haengen an den beiden Fundstuecken abseits der Wege – das
  // Loeschfahrzeug an der Lernwerkstatt der Jugendfeuerwehr, die abgestuerzte
  // Drohne am Drohnenprojekt der Uni. Beide Gegenstaende standen schon in der
  // Welt, bevor es die Links gab; dass sie zueinander passen, ist der Grund,
  // warum sie sie bekommen haben und nicht irgendein Schild.
  jugendfeuerwehr: 'https://jf.veerka.mp/',
  kidrohne: 'https://ai-drone-fra-uas.github.io/ai-drone/',
}
