import { createContext, useContext, useState, useEffect } from 'react';

const T = {
  de: {
    welcome: 'Willkommen bei der abat AG',
    pleaseChoose: 'Bitte wählen Sie eine Option',
    checkin: 'Einchecken',
    checkinSub: 'QR-Code scannen oder Voranmeldung',
    checkout: 'Auschecken',
    checkoutSub: 'Badge-QR scannen oder Name suchen',
    firstReg: 'Erstanmeldung',
    firstRegSub: 'Ohne Voranmeldung anmelden',
    questions: 'Bei Fragen wenden Sie sich bitte an den Empfang',
    back: 'Zurück',
    // Checkin page
    scanTitle: 'Voranmeldung scannen',
    scanHint: 'Halten Sie den QR-Code aus Ihrer Einladungs-E-Mail vor die Kamera',
    checkinWithout: 'Ohne Voranmeldung einchecken',
    welcomeMsg: 'Willkommen!',
    hostNotified: 'Ihr Gastgeber wurde benachrichtigt.',
    backIn: 'Zurück in',
    seconds: 'Sekunden...',
    hostLabel: 'Gastgeber',
    errorTitle: 'Fehler',
    retry: 'Erneut versuchen',
    // Checkout page
    scanBadge: 'Badge-QR-Code scannen zum Auschecken',
    searchName: 'Name suchen',
    scanQR: 'QR-Code scannen',
    searchPlaceholder: 'Name oder Firma eingeben...',
    noVisitorsFound: 'Keine anwesenden Besucher gefunden',
    checkoutAction: 'Auschecken',
    goodbye: 'Auf Wiedersehen!',
    checkedOut: 'Erfolgreich ausgecheckt.',
    notFound: 'Nicht gefunden',
    // Manual page
    manualTitle: 'Erstanmeldung',
    fillForm: 'Bitte füllen Sie das Formular aus',
    firstName: 'Vorname',
    lastName: 'Nachname',
    company: 'Unternehmen',
    host: 'Gastgeber',
    hostPlaceholder: '– Bitte wählen –',
    hostManualOption: 'Nicht in der Liste – manuell eingeben',
    hostManualLabel: 'Name des Gastgebers',
    hostManualPlaceholder: 'z.B. Max Mustermann',
    hostNotifiedManual: 'Manuell eingetragener Gastgeber – keine E-Mail-Benachrichtigung.',
    purpose: 'Besuchszweck',
    notes: 'Hinweise',
    checkinBtn: 'Einchecken',
    checkinLoading: 'Wird eingecheckt...',
    required: 'Pflichtfeld',
  },
  en: {
    welcome: 'Welcome to abat AG',
    pleaseChoose: 'Please select an option',
    checkin: 'Check In',
    checkinSub: 'Scan QR code or pre-registration',
    checkout: 'Check Out',
    checkoutSub: 'Scan badge QR or search by name',
    firstReg: 'First Registration',
    firstRegSub: 'Register without pre-registration',
    questions: 'For questions please contact reception',
    back: 'Back',
    // Checkin page
    scanTitle: 'Scan pre-registration',
    scanHint: 'Hold the QR code from your invitation email in front of the camera',
    checkinWithout: 'Check in without pre-registration',
    welcomeMsg: 'Welcome!',
    hostNotified: 'Your host has been notified.',
    backIn: 'Back in',
    seconds: 'seconds...',
    hostLabel: 'Host',
    errorTitle: 'Error',
    retry: 'Try again',
    // Checkout page
    scanBadge: 'Scan badge QR code to check out',
    searchName: 'Search by name',
    scanQR: 'Scan QR code',
    searchPlaceholder: 'Enter name or company...',
    noVisitorsFound: 'No active visitors found',
    checkoutAction: 'Check Out',
    goodbye: 'Goodbye!',
    checkedOut: 'Successfully checked out.',
    notFound: 'Not found',
    // Manual page
    manualTitle: 'First Registration',
    fillForm: 'Please fill in the form',
    firstName: 'First name',
    lastName: 'Last name',
    company: 'Company',
    host: 'Host',
    hostPlaceholder: '– Please select –',
    hostManualOption: 'Not in list – enter manually',
    hostManualLabel: 'Host name',
    hostManualPlaceholder: 'e.g. John Doe',
    hostNotifiedManual: 'Manually entered host – no email notification.',
    purpose: 'Purpose of visit',
    notes: 'Notes',
    checkinBtn: 'Check in',
    checkinLoading: 'Checking in...',
    required: 'Required',
  },
};

const KioskLangContext = createContext({ lang: 'de', t: (k) => k, setLang: () => {} });

export function KioskLangProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('kiosk_lang') || 'de');

  const setLang = (l) => {
    localStorage.setItem('kiosk_lang', l);
    setLangState(l);
  };

  const t = (key) => T[lang]?.[key] ?? T.de[key] ?? key;

  return (
    <KioskLangContext.Provider value={{ lang, t, setLang, languages: Object.keys(T) }}>
      {children}
    </KioskLangContext.Provider>
  );
}

export const useKioskLang = () => useContext(KioskLangContext);
