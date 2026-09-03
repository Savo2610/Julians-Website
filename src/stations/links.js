// Zentrale Stelle fuer alle echten Adressen. Hier eintragen, sonst nirgends –
// die Objekte in der Welt referenzieren nur die Schluessel.
//
// Noch nicht gesetzte Links sind als null markiert; die Station steht dann in
// der Welt, sagt aber ehrlich, dass sie noch nicht verdrahtet ist.

export const LINKS = {
  github: 'https://github.com/',
  linkedin: 'https://www.linkedin.com/',
  instagram: 'https://www.instagram.com/',
  signal: null,      // z.B. https://signal.me/#p/+49...
  paypal: null,      // z.B. https://paypal.me/...
  solana: null,      // Wallet-Adresse oder Solana-Pay-Link
  upload: null,      // deine Uploadseite
  shortener: null,   // dein Link-Shortener
  packlist: null,    // deine Packlisten-App
  worktime: null,    // dein Arbeitszeitrechner
}
