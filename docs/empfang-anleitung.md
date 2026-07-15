# Anleitung für den Empfangsaccount

Diese Anleitung richtet sich an Mitarbeiter am Empfang, die das Besucherverwaltungssystem täglich nutzen.

---

## Inhaltsverzeichnis

1. [Anmelden](#1-anmelden)
2. [Dashboard](#2-dashboard)
3. [Besucher einchecken](#3-besucher-einchecken)
4. [Besucher auschecken](#4-besucher-auschecken)
5. [Besucherliste](#5-besucherliste)
6. [Voranmeldungen](#6-voranmeldungen)
7. [Gastgeber](#7-gastgeber)
8. [Evakuierungsliste](#8-evakuierungsliste)
9. [Berichte](#9-berichte)

---

## 1. Anmelden

Die Anwendung ist im Browser unter der Adresse des Systems erreichbar.

Benutzername (E-Mail) und Passwort eingeben und auf **Anmelden** klicken. Bei aktivierter Zwei-Faktor-Authentifizierung erscheint danach ein zweiter Schritt mit einem 6-stelligen Code aus der Authenticator-App.

---

## 2. Dashboard

Das Dashboard zeigt nach dem Login eine Übersicht des aktuellen Tages:

- **Aktuell anwesend** — Anzahl der Besucher, die gerade im Gebäude sind
- **Heute eingecheckt** — Gesamtzahl der Besuche heute
- **Vorangemeldete Besucher** — noch nicht erschienene Voranmeldungen für heute
- **Letzte Aktivitäten** — die letzten Check-ins und Check-outs in Echtzeit

---

## 3. Besucher einchecken

### Manueller Check-in (ohne Voranmeldung)

1. Im linken Menü auf **Besucher** klicken
2. Oben rechts auf **+ Besucher hinzufügen** klicken
3. Formular ausfüllen:

| Feld | Pflicht | Hinweis |
|------|---------|---------|
| Vorname | ✅ | |
| Nachname | ✅ | |
| E-Mail | — | |
| Telefon | — | |
| Unternehmen | — | |
| Gastgeber | ✅ | Aus Liste wählen oder „Manuell eingeben" für externe Gastgeber |
| Besuchsgrund | — | Aus vordefinierten Gründen wählen |
| Notizen | — | Interne Anmerkungen |
| Datenschutzerklärung unterschrieben | — | Häkchen setzen, sobald die Datenschutzerklärung unterschrieben wurde |

4. Auf **Einchecken** klicken

> Nach dem Check-in kann ein Besucherausweis über das Drucker-Symbol in der Besucherliste gedruckt werden.

### Check-in über Voranmeldung

Wenn ein Besucher vorangemeldet ist und am Empfang erscheint:

1. Im Menü auf **Voranmeldungen** klicken
2. Den Besucher in der Liste suchen (Suchfeld oder Tab „Ausstehend")
3. Auf das **Check-in-Symbol** (Pfeil nach rechts) klicken
4. Daten ggf. bestätigen oder korrigieren → **Einchecken**

Der Besucher wechselt damit in die aktive Besucherliste.

### Check-in über den Kiosk

Besucher mit einer Voranmeldungs-E-Mail können sich am Kiosk selbstständig einchecken:
- Per QR-Code aus der Einladungs-E-Mail
- Per abat-ID (8-stellige Nummer aus der E-Mail)

Der Empfang wird bei jedem Kiosk-Check-in automatisch in der Besucherliste aktualisiert.

---

## 4. Besucher auschecken

### Einzelner Besucher

1. Im Menü auf **Besucher** klicken
2. Tab **Aktiv** wählen — zeigt alle aktuell anwesenden Besucher
3. Beim gewünschten Besucher auf das **Check-out-Symbol** (Tür-Icon) klicken
4. Bestätigung abwarten — der Besucher erscheint nun im Tab **Ausgecheckt**

### Über den Kiosk

Besucher können sich am Kiosk über QR-Code, abat-ID oder Namenssuche selbst auschecken.

---

## 5. Besucherliste

Erreichbar über **Besucher** im linken Menü.

Die Liste hat vier Tabs:

| Tab | Inhalt |
|-----|--------|
| **Alle** | Vollständige Liste aller Besucher (alle Tage) |
| **Vorangemeldet** | Voranmeldungen, die noch nicht erschienen sind |
| **Aktiv** | Besucher, die aktuell im Gebäude sind |
| **Ausgecheckt** | Besucher, die heute oder früher ausgecheckt haben |

**Suche:** Über das Suchfeld können Besucher nach Name, Unternehmen oder Gastgeber gefiltert werden.

**Aktionen pro Besucher:**
- **Ausweis drucken** — Druckersymbol → öffnet den Ausweis als PDF
- **Check-out** — Tür-Symbol bei aktiven Besuchern
- **Löschen** — nur für Administratoren verfügbar

---

## 6. Voranmeldungen

Erreichbar über **Voranmeldungen** im linken Menü.

Voranmeldungen sind Besuchstermine, die im Voraus angelegt werden. Der Besucher erhält automatisch eine E-Mail mit QR-Code und Einladungsdetails.

### Neue Voranmeldung erstellen

1. Auf **+ Voranmeldung** klicken
2. Besucherdaten eingeben (Name, Unternehmen, E-Mail des Besuchers)
3. Gastgeber auswählen
4. Datum und Uhrzeit des geplanten Besuchs eintragen
5. Besuchsgrund und optionale Notizen ergänzen
6. Auf **Speichern** klicken — die Einladungs-E-Mail wird automatisch verschickt

### Voranmeldung bearbeiten oder stornieren

In der Liste auf die jeweilige Voranmeldung klicken → Bearbeiten oder Stornieren auswählen.

Stornierte Voranmeldungen erscheinen weiterhin in der Liste, können aber nicht mehr zum Check-in verwendet werden.

---

## 7. Gastgeber

Erreichbar über **Gastgeber** im linken Menü.

Zeigt alle Gastgeber (Mitarbeiter, die Besucher empfangen können). Die Liste dient zur Übersicht und zum Nachschlagen.

**Als Empfangsaccount** können Gastgeber eingesehen, aber nicht angelegt oder gelöscht werden — das ist Aufgabe der Administration.

---

## 8. Evakuierungsliste

Erreichbar über **Evakuierung** im linken Menü.

Die Evakuierungsliste zeigt in Echtzeit alle aktuell im Gebäude anwesenden Personen, gruppiert nach Standort. Die Seite aktualisiert sich automatisch alle 30 Sekunden.

### Druckliste erstellen

Auf **Liste drucken** klicken — es öffnet sich ein neues Fenster mit einer sauberen Druckansicht:

- Alle anwesenden Besucher mit Name, Unternehmen, Gastgeber und Check-in-Uhrzeit
- Abhaküfeld pro Person zur manuellen Kontrolle
- Gegliedert nach Standort
- Zeitstempel der Erstellung

> Im Evakuierungsfall diese Liste sofort ausdrucken und zu den Sammelstellen mitnehmen.

---

## 9. Berichte

Erreichbar über **Berichte** im linken Menü.

Ermöglicht den Export von Besuchsdaten als CSV für einen wählbaren Zeitraum (in Excel öffenbar). Der CSV-Export ist ausschließlich Admin-Konten vorbehalten — mit einem Empfangs-Konto ist nur die Tabellenansicht in der App sichtbar.

Verwendung (nur Admin):
1. Zeitraum (Von – Bis) auswählen, optional Standort filtern
2. Auf **CSV-Export** klicken — Datei wird automatisch heruntergeladen

---

## Häufige Situationen

### Besucher hat keine Einladungs-E-Mail

→ Manuellen Check-in durchführen (siehe [Abschnitt 3](#3-besucher-einchecken))

### Besucher erscheint nicht in der Voranmeldungsliste

→ Suche im Tab **Vorangemeldet** nutzen, ggf. Datum prüfen. Falls nicht gefunden: manuell einchecken.

### Besucher hat Badge verloren

→ In der Besucherliste (Tab **Aktiv**) den Besucher suchen und den Ausweis über das Drucker-Symbol erneut als PDF drucken.

### Besucher vergisst auszuchecken

→ In der Besucherliste (Tab **Aktiv**) den Besucher suchen → manuell auschecken.

### Passwort vergessen

→ Einen Administrator kontaktieren. Administratoren können Passwörter unter **Einstellungen → Benutzerverwaltung** zurücksetzen.
