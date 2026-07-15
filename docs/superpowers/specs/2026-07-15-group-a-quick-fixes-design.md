# Gruppe A — Quick UI/Privacy-Fixes (Design)

> Teil 1 von 5 einer größeren Änderungsliste. Gruppen B (Rollen & Rechte), C (Standort-Skalierung), D (Gastgeber AD-Sync) und E (2FA-Neuaufbau) werden als eigene Specs behandelt.

## A1 — Gastgeberauswahl-Bug

**Status: offen, kein Repro.**

Geprüft (Code gegen Live-DB-Schema, plus Live-Test via curl):
- `POST /api/visitors` (Admin Schnell-Check-in, `CheckIn.jsx`) — INSERT-Spalten stimmen mit `visits`-Schema überein, Live-Test erfolgreich.
- `POST /api/preregistrations` (einzeln + `/batch`) — INSERT-Spalten stimmen mit `preregistrations`-Schema überein.
- `POST /api/host-portal/...` (Host-Portal Vorregistrierung) — INSERT-Spalten stimmen überein.
- `POST/PUT /api/hosts` (Gastgeber-CRUD in Settings) — INSERT/UPDATE-Spalten stimmen überein.
- Migration `ALTER TABLE visits ADD COLUMN host_name_free` (`database.js:179`) ist bereits gelaufen, Spalte existiert live.

**Nächster Schritt:** Exakter Fehlertext/Screenshot beim nächsten Auftreten nötig, um die betroffene Query zu finden. Kandidat: zweite pm2-App `visitor-mgmt-abatplus` läuft evtl. gegen eine ältere DB-Datei ohne diese Migration — falls der Bug dort auftritt, reicht ein Neustart des Prozesses (Migration läuft bei jedem Start).

**Blockiert die restlichen A-Punkte nicht.**

## A2 — Dashboard-Einchecken-Button entfernen

`frontend/src/pages/Dashboard.jsx`: Button "Jetzt einchecken" (Zeile ~166) und das zugehörige Schnell-Check-in-Formular (inkl. `VisitorCheckinForm`-Einbindung, State, Submit-Handler) entfernen. Der reguläre Check-in bleibt über `CheckIn.jsx` und Kiosk erreichbar.

## A3 — Badge-Nummer entfernen (Anzeige + Generierung), Druck bleibt

Entfernen:
- `backend/src/routes/visitors.js`: `badgeNumber`-Generierung (`B-${Date.now()...}`) und der Wert im INSERT für `visits.badge_number` — Spalte wird beim Insert nicht mehr befüllt (bleibt `NULL`).
- Frontend-Anzeigen von `badge_number` in: `Visitors.jsx`, `Evacuation.jsx`, `EvacuationPrint.jsx`, `CheckIn.jsx`, `KioskCheckin.jsx`, `KioskManual.jsx`, `KioskCheckout.jsx`, `VisitorBadge.jsx`, sowie `badgeNumber`-Keys in `KioskLangContext.jsx`.

Bleibt unverändert:
- `backend/src/services/badge.js` (PDF-Generierung) und `label-printer.js` (Etikettendrucker) — Badge wird weiter mit Name/Firma/Foto/QR gedruckt, nur ohne Nummernzeile. Beide Services müssen daraufhin geprüft werden, ob sie `badge_number` referenzieren und ggf. die Zeile im Layout weglassen statt eine leere Zeile zu drucken.
- DB-Spalte `visits.badge_number` bleibt im Schema (ungenutzt, `NULL`) — kein `DROP COLUMN`, kein Migrationsrisiko.

## A4 — Status-Spalte nur im Tab "Alle"

`frontend/src/pages/Visitors.jsx`: Die `StatusBadge`-Spalte (Tabellen-Header + Zelle, aktuell in allen Tabs sichtbar) wird bedingt gerendert — nur wenn `activeTab === 'all'`. In den Tabs `announced`, `active`, `completed` verschwindet Header-Spalte und Zelle (Status ist dort durch den Tab bereits redundant). Dashboard-Tabelle (eigene `StatusBadge`-Komponente, andere Datei) bleibt unverändert.

## A5 — Demo-Login-Fenster entfernen

`frontend/src/pages/Login.jsx`: Block "Demo-Zugangsdaten" (Zeile ~117-120ff, gesteuert über `showDemoCredentials`/`show_demo_credentials`-Setting) komplett entfernen, inkl. des `GET`-Aufrufs, der das Flag lädt.

Backend: `show_demo_credentials`-Setting in `settings.js` kann als toter Wert im Schema bleiben (kein Frontend-Zugriff mehr) oder mit entfernt werden — wird in der Implementierungsplanung entschieden je nachdem wie stark er verdrahtet ist.

## A6 — Settings-Toggle-Fenster entfernen

`frontend/src/pages/Settings.jsx`: Die Demo-Toggle-Sektion (`handleDemoToggle`, Zeile ~848, plus zugehöriger UI-Block ~910-925) entfernen — direkte Folge von A5, da der Toggle sonst ins Leere zeigt.

## A7 — Mehrsprachigkeit DE/EN (Aufräumen)

Ist-Zustand bereits korrekt: `frontend/src/i18n/index.js` lädt nur `de`/`en`, `Sidebar.jsx` `LANGUAGES` hat nur DE/EN, `KioskLangContext.jsx` hat nur `de`/`en`-Keys. Die Dateien `frontend/src/i18n/lt.js` und `frontend/src/i18n/ru.js` sind toter Code (nirgends importiert) — werden gelöscht.

## A8 — NDA/Geheimhaltung in Datenschutzerklärung

Wartet auf Wortlaut vom User. Wird eingesetzt, sobald geliefert — vermutlich in `docs/`-Datenschutztext oder Kiosk-Signatur-Screen (`DocumentSigning.jsx`/`SignaturePad.jsx`-Flow), genaue Stelle wird bei Umsetzung anhand des Texts lokalisiert.

## A9 — Telefonnummer des Besuchers entfernen

Betrifft **nur** `visitors.phone`, nicht `hosts.phone` (Gastgeber-Kontakttelefon bleibt).

Entfernen:
- `frontend/src/components/VisitorCheckinForm.jsx`: Telefon-Eingabefeld.
- Anzeige von `phone` in Besucherlisten/-detail (`Visitors.jsx` u.a., je nach Fundstelle bei Umsetzung).
- `backend/src/routes/visitors.js`: `phone` aus `req.body`-Destructuring und den INSERT/UPDATE-Statements für `visitors` entfernen.

DB-Spalte `visitors.phone` bleibt im Schema (ungenutzt) — kein `DROP COLUMN`.

## Testing

Für jeden Punkt: manueller Durchlauf im Browser (Dev-Server) nach Umsetzung — Dashboard, Visitors-Tabs, Login, Settings, Kiosk-Checkin, Badge-PDF-Ausgabe. Kein bestehendes Test-Suite im Projekt gefunden (kein `__tests__`/`*.test.js` in `backend`/`frontend`) — keine automatisierten Tests zu pflegen, rein manuelle Verifikation.
