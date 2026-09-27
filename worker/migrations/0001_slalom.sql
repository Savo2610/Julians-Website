-- Jede eingetragene Fahrt. Die Bestenliste ist eine Abfrage darauf, keine
-- eigene Tabelle: "die besten der letzten 30 Tage" aendert sich jeden Tag
-- von selbst, ohne dass etwas aufgeraeumt werden muss.
CREATE TABLE fahrten (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  lauf      TEXT    NOT NULL UNIQUE,   -- aus der Startmarke; jeder Lauf zaehlt einmal
  name      TEXT    NOT NULL,
  schluessel TEXT   NOT NULL,          -- Name klein und ohne Leerraum: eine Person, eine Zeile
  zeit      REAL    NOT NULL,          -- mit Strafsekunden
  verfehlt  INTEGER NOT NULL,
  erstellt  INTEGER NOT NULL,          -- ms seit 1970
  wer       TEXT    NOT NULL           -- gehashte IP, nur fuer die Tagesgrenze
);
CREATE INDEX fahrten_zeit ON fahrten (erstellt, zeit);
CREATE INDEX fahrten_wer ON fahrten (wer, erstellt);
