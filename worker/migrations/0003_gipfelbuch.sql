-- Das Gipfelbuch ueber der Nordabfahrt (src/menu/gipfelbuch.js,
-- worker/gipfelbuch.js). Neue Eintraege sind erst sichtbar, wenn Julian sie
-- freigegeben hat (frei = 1) – das Tal ist seine Seite, und eine Sperrliste
-- faengt nicht alles.
CREATE TABLE gipfelbuch (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT    NOT NULL,
  text      TEXT    NOT NULL,
  erstellt  INTEGER NOT NULL,          -- ms seit 1970
  wer       TEXT    NOT NULL,          -- gehashte IP, nur fuer die Tagesgrenze
  frei      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX gipfelbuch_frei ON gipfelbuch (frei, erstellt);
CREATE INDEX gipfelbuch_wer ON gipfelbuch (wer, erstellt);
