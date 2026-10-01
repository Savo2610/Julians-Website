-- Sessions vom Kabelsee (src/sommer/, worker/kabelsee.js). Wie fahrten:
-- die Bestenliste ist eine Abfrage, die besten Punkte je Name der letzten
-- 30 Tage.
CREATE TABLE kabelsee (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  lauf      TEXT    NOT NULL UNIQUE,   -- aus der Startmarke; jede Session zaehlt einmal
  name      TEXT    NOT NULL,
  schluessel TEXT   NOT NULL,          -- Name klein und ohne Leerraum: eine Person, eine Zeile
  punkte    INTEGER NOT NULL,
  erstellt  INTEGER NOT NULL,          -- ms seit 1970
  wer       TEXT    NOT NULL           -- gehashte IP, nur fuer die Tagesgrenze
);
CREATE INDEX kabelsee_punkte ON kabelsee (erstellt, punkte);
CREATE INDEX kabelsee_wer ON kabelsee (wer, erstellt);
