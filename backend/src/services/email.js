const nodemailer = require('nodemailer');
const db = require('../db/database');

function getSecurityOptions(security) {
  switch (security) {
    case 'ssl':   return { secure: true };
    case 'none':  return { secure: false, ignoreTLS: true };
    case 'starttls':
    default:      return { secure: false };
  }
}

function getDbVal(key) {
  return db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key)?.value || '';
}

function getSmtpConfig() {
  return {
    host:      getDbVal('smtp_host')     || process.env.SMTP_HOST     || '',
    port:      parseInt(getDbVal('smtp_port') || process.env.SMTP_PORT || '587'),
    user:      getDbVal('smtp_user')     || process.env.SMTP_USER     || '',
    pass:      getDbVal('smtp_pass')     || process.env.SMTP_PASS     || '',
    security:  getDbVal('smtp_security') || process.env.SMTP_SECURITY || 'starttls',
    fromEmail: getDbVal('from_email')    || process.env.FROM_EMAIL    || '',
    fromName:  getDbVal('from_name')     || process.env.COMPANY_NAME  || '',
    company:   getDbVal('company_name')  || process.env.COMPANY_NAME  || 'abat AG',
  };
}

function createTransport() {
  const cfg = getSmtpConfig();
  if (!cfg.user || cfg.user === 'your@email.com') return null;
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    ...getSecurityOptions(cfg.security),
    auth: { user: cfg.user, pass: cfg.pass },
  });
}

module.exports.getSmtpConfig = getSmtpConfig;

function emailShell(content, company) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>
    @media only screen and (max-width:600px){
      .outer-pad   { padding:0 !important; }
      .card        { border-radius:0 !important; }
      .body-pad    { padding:28px 20px !important; }
      .footer-pad  { padding:16px 20px !important; }
      .qr-img      { width:180px !important; height:180px !important; }
      .detail-label{ display:block !important; padding-bottom:2px !important; }
      .detail-val  { display:block !important; padding-bottom:12px !important; padding-left:0 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#EDEEF0;-webkit-text-size-adjust:100%;mso-line-height-rule:exactly;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#EDEEF0;">
    <tr><td align="center" style="padding:32px 16px;" class="outer-pad">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
        style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);" class="card">

        <!-- HEADER -->
        <tr>
          <td style="background:#004B87;padding:32px 40px 28px;">
            <p style="margin:0;font-size:24px;font-weight:900;color:#ffffff;letter-spacing:-0.02em;line-height:1;">abat AG</p>
            <p style="margin:8px 0 0;font-size:12px;color:#9ADBE8;letter-spacing:0.12em;text-transform:uppercase;font-weight:600;">${company} · Besuchsverwaltung</p>
          </td>
        </tr>

        <!-- CONTENT -->
        <tr><td style="padding:36px 40px 32px;" class="body-pad">${content}</td></tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#F8F9FA;border-top:1px solid #E9ECEF;padding:18px 40px;text-align:center;" class="footer-pad">
            <p style="margin:0;font-size:11px;color:#ADB5BD;line-height:1.6;">
              Diese E-Mail wurde automatisch von der <strong style="color:#868E96;">${company} Besucherverwaltung</strong> generiert.<br>
              Bitte antworten Sie nicht auf diese E-Mail.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function detailRow(label, value) {
  return `
  <tr>
    <td class="detail-label" style="padding:10px 20px 10px 0;color:#6C757D;font-size:13px;vertical-align:top;white-space:nowrap;border-bottom:1px solid #F1F3F5;">${label}</td>
    <td class="detail-val"  style="padding:10px 0;font-size:14px;font-weight:600;color:#343A40;vertical-align:top;border-bottom:1px solid #F1F3F5;">${value}</td>
  </tr>`;
}

async function sendPreRegistrationQR(email, name, qrBuffer, date, host, abatId, location) {
  const transport = createTransport();
  const cfg = getSmtpConfig();
  const company = cfg.company;
  const subject = `Ihre Besuchseinladung bei ${company} – ${date}`;

  // Location row
  let locationValue = '';
  let mapsUrl = '';
  if (location) {
    const addr = [location.address, location.city].filter(Boolean).join(', ');
    if (addr) {
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
      locationValue = `${location.name ? `<span style="display:block;margin-bottom:3px;">${location.name}</span>` : ''}
        <span style="font-weight:400;color:#495057;">${addr}</span>
        ${mapsUrl ? `<br><a href="${mapsUrl}" style="color:#004B87;font-size:12px;text-decoration:none;font-weight:600;">📍 Google Maps öffnen →</a>` : ''}`;
    }
  }

  const detailRows = [
    detailRow('Datum', `<span style="color:#004B87;">${date}</span>`),
    host ? detailRow('Gastgeber', host) : '',
    locationValue ? detailRow('Standort', locationValue) : '',
  ].join('');

  const abatSection = abatId ? `
    <div style="margin:28px 0;padding:18px 20px;background:#EEF4FA;border-left:4px solid #004B87;border-radius:0 10px 10px 0;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6C9DC6;text-transform:uppercase;letter-spacing:0.1em;">Ihre abat-ID (Alternativ zum QR-Code)</p>
      <p style="margin:0 0 6px;font-size:26px;font-weight:800;font-family:'Courier New',Courier,monospace;color:#004B87;letter-spacing:0.08em;">${abatId}</p>
      <p style="margin:0;font-size:12px;color:#6C757D;line-height:1.5;">Falls der QR-Code nicht gescannt werden kann, geben Sie diese ID am Empfangs-Terminal ein.</p>
    </div>` : '';

  const content = `
    <p style="margin:0 0 6px;font-size:20px;font-weight:700;color:#212529;">Guten Tag, ${name}!</p>
    <p style="margin:0 0 28px;font-size:14px;color:#6C757D;line-height:1.7;">
      Wir freuen uns, Sie bald bei <strong style="color:#343A40;">${company}</strong> begrüßen zu dürfen.<br>
      Hier sind alle Informationen zu Ihrem bevorstehenden Besuch.
    </p>

    <!-- Details -->
    <div style="background:#F8F9FA;border:1px solid #E9ECEF;border-radius:10px;padding:6px 20px;margin:0 0 28px;">
      <p style="margin:0;padding:14px 0 10px;font-size:11px;font-weight:700;color:#ADB5BD;text-transform:uppercase;letter-spacing:0.1em;">Besuchsdetails</p>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        ${detailRows}
      </table>
    </div>

    <!-- QR Code -->
    <div style="text-align:center;margin:0 0 8px;">
      <p style="margin:0 0 16px;font-size:15px;font-weight:700;color:#212529;">Ihr Einlass-QR-Code</p>
      <div style="display:inline-block;padding:20px;background:#ffffff;border:2px solid #E9ECEF;border-radius:14px;">
        <img src="cid:qrcode@abat" width="210" height="210" alt="QR-Code" class="qr-img"
          style="display:block;width:210px;height:210px;border:0;" />
      </div>
      <p style="margin:12px 0 0;font-size:12px;color:#ADB5BD;line-height:1.5;">
        Bitte halten Sie diesen QR-Code am Kiosk-Terminal vor.<br>
        Der Code ist einmalig und personalisiert.
      </p>
    </div>

    ${abatSection}

    <!-- Closing -->
    <div style="margin-top:32px;padding-top:24px;border-top:1px solid #F1F3F5;">
      <p style="margin:0 0 4px;font-size:14px;color:#495057;line-height:1.7;">Wir wünschen Ihnen eine angenehme Anreise und freuen uns auf Ihren Besuch.</p>
      <p style="margin:14px 0 0;font-size:14px;color:#495057;">Mit freundlichen Grüßen,<br><strong style="color:#212529;">${company}</strong></p>
    </div>
  `;

  const html = emailShell(content, company);

  if (!transport) {
    console.log(`[EMAIL] Vorregistrierungs-QR an ${email}: Besuch am ${date} bei ${host}`);
    return;
  }
  try {
    await transport.sendMail({
      from: `"${cfg.fromName || company + ' Besucherverwaltung'}" <${cfg.fromEmail}>`,
      to: email,
      subject,
      html,
      attachments: [{ filename: 'einlass-qrcode.png', content: qrBuffer, cid: 'qrcode@abat' }],
    });
  } catch (err) {
    console.error('E-Mail-Fehler (Vorregistrierung):', err.message);
  }
}

async function sendHostNotification(host, visitor, visit) {
  const transport = createTransport();
  const cfg = getSmtpConfig();
  const company = cfg.company;
  const subject = `Besucher eingetroffen: ${visitor.first_name} ${visitor.last_name}`;
  const checkinTime = new Date(visit.checked_in_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  const rows = [
    detailRow('Name', `${visitor.first_name} ${visitor.last_name}`),
    visitor.company ? detailRow('Unternehmen', visitor.company) : '',
    visit.purpose ? detailRow('Besuchszweck', visit.purpose) : '',
    detailRow('Eingecheckt um', `${checkinTime} Uhr`),
    detailRow('Badge-Nr.', `<span style="font-family:'Courier New',monospace;background:#F1F3F5;padding:2px 8px;border-radius:4px;">${visit.badge_number}</span>`),
    visitor.abat_id ? detailRow('abat-ID', `<span style="font-family:'Courier New',monospace;color:#004B87;">${visitor.abat_id}</span>`) : '',
  ].join('');

  const content = `
    <div style="display:inline-block;background:#FFF3CD;border:1px solid #FFE69C;border-radius:8px;padding:10px 16px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;font-weight:700;color:#664D03;">🔔 &nbsp;Ein Besucher wartet auf Sie</p>
    </div>
    <p style="margin:0 0 6px;font-size:20px;font-weight:700;color:#212529;">Hallo ${host.name},</p>
    <p style="margin:0 0 28px;font-size:14px;color:#6C757D;line-height:1.7;">
      Ihr Besucher ist eingetroffen und wartet am Empfang. Bitte begeben Sie sich dorthin.
    </p>
    <div style="background:#F8F9FA;border:1px solid #E9ECEF;border-radius:10px;padding:6px 20px;margin:0 0 28px;">
      <p style="margin:0;padding:14px 0 10px;font-size:11px;font-weight:700;color:#ADB5BD;text-transform:uppercase;letter-spacing:0.1em;">Besucherdetails</p>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        ${rows}
      </table>
    </div>
    <p style="margin:0;font-size:14px;color:#495057;">Freundliche Grüße,<br><strong style="color:#212529;">${company} Besucherverwaltung</strong></p>
  `;

  const html = emailShell(content, company);

  if (!transport) {
    console.log(`[EMAIL] Host-Benachrichtigung an ${host.email}: ${visitor.first_name} ${visitor.last_name} eingetroffen.`);
    return;
  }
  try {
    await transport.sendMail({
      from: `"${cfg.fromName || company + ' Besucherverwaltung'}" <${cfg.fromEmail}>`,
      to: host.email,
      subject,
      html,
    });
  } catch (err) {
    console.error('E-Mail-Fehler (Host-Benachrichtigung):', err.message);
  }
}

async function sendVisitorConfirmation(visitor, visit, host) {
  if (!visitor.email) return;
  const transport = createTransport();
  const cfg = getSmtpConfig();
  const company = cfg.company;
  const checkinTime = new Date(visit.checked_in_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const checkinDate = new Date(visit.checked_in_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
  const subject = `Willkommen bei ${company} – Check-in bestätigt`;

  const rows = [
    detailRow('Datum', checkinDate),
    detailRow('Uhrzeit', `${checkinTime} Uhr`),
    host ? detailRow('Gastgeber', host.name) : '',
    visit.purpose ? detailRow('Besuchszweck', visit.purpose) : '',
    detailRow('Badge-Nr.', `<span style="font-family:'Courier New',monospace;background:#F1F3F5;padding:2px 8px;border-radius:4px;">${visit.badge_number}</span>`),
  ].join('');

  const content = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background:#D1FAE5;border-radius:50%;width:56px;height:56px;line-height:56px;font-size:28px;">✅</div>
    </div>
    <p style="margin:0 0 6px;font-size:20px;font-weight:700;color:#212529;text-align:center;">Willkommen, ${visitor.first_name}!</p>
    <p style="margin:0 0 28px;font-size:14px;color:#6C757D;line-height:1.7;text-align:center;">
      Ihr Check-in bei <strong style="color:#343A40;">${company}</strong> war erfolgreich. Hier ist Ihre Zusammenfassung.
    </p>
    <div style="background:#F8F9FA;border:1px solid #E9ECEF;border-radius:10px;padding:6px 20px;margin:0 0 28px;">
      <p style="margin:0;padding:14px 0 10px;font-size:11px;font-weight:700;color:#ADB5BD;text-transform:uppercase;letter-spacing:0.1em;">Ihre Besuchsdaten</p>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        ${rows}
      </table>
    </div>
    <p style="margin:0;font-size:14px;color:#495057;line-height:1.7;">Wir wünschen Ihnen einen angenehmen Aufenthalt.<br><br>
    Freundliche Grüße,<br><strong style="color:#212529;">${company}</strong></p>
  `;

  const html = emailShell(content, company);

  if (!transport) {
    console.log(`[EMAIL] Besucher-Bestätigung an ${visitor.email}: Check-in um ${checkinTime}`);
    return;
  }
  try {
    await transport.sendMail({
      from: `"${cfg.fromName || company + ' Besucherverwaltung'}" <${cfg.fromEmail}>`,
      to: visitor.email,
      subject,
      html,
    });
  } catch (err) {
    console.error('E-Mail-Fehler (Besucher-Bestätigung):', err.message);
  }
}

async function sendVisitorCheckout(visitor, visit, locationName) {
  if (!visitor.email) return;
  const transport = createTransport();
  const cfg = getSmtpConfig();
  const company = cfg.company;
  const location = locationName || company;
  const subject = `Vielen Dank für Ihren Besuch bei ${location}`;

  const checkinDate  = new Date(visit.checked_in_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
  const checkinTime  = new Date(visit.checked_in_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const checkoutTime = new Date(visit.checked_out_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  // Duration in minutes
  const durationMs  = new Date(visit.checked_out_at) - new Date(visit.checked_in_at);
  const durationMin = Math.round(durationMs / 60000);
  const durationStr = durationMin >= 60
    ? `${Math.floor(durationMin / 60)} Std. ${durationMin % 60} Min.`
    : `${durationMin} Min.`;

  const rows = [
    detailRow('Datum', checkinDate),
    detailRow('Ankunft', `${checkinTime} Uhr`),
    detailRow('Abfahrt', `${checkoutTime} Uhr`),
    detailRow('Aufenthaltsdauer', durationStr),
    detailRow('Standort', location),
  ].join('');

  const content = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background:#DBEAFE;border-radius:50%;width:56px;height:56px;line-height:56px;font-size:28px;">👋</div>
    </div>
    <p style="margin:0 0 6px;font-size:20px;font-weight:700;color:#212529;text-align:center;">Auf Wiedersehen, ${visitor.first_name}!</p>
    <p style="margin:0 0 28px;font-size:14px;color:#6C757D;line-height:1.7;text-align:center;">
      Vielen Dank für Ihren Besuch bei <strong style="color:#343A40;">${location}</strong>.<br>
      Wir hoffen, Ihr Besuch war angenehm und erfolgreich.
    </p>
    <div style="background:#F8F9FA;border:1px solid #E9ECEF;border-radius:10px;padding:6px 20px;margin:0 0 28px;">
      <p style="margin:0;padding:14px 0 10px;font-size:11px;font-weight:700;color:#ADB5BD;text-transform:uppercase;letter-spacing:0.1em;">Besuchsübersicht</p>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        ${rows}
      </table>
    </div>
    <p style="margin:0;font-size:14px;color:#495057;line-height:1.7;">
      Wir freuen uns, Sie bald wieder bei uns begrüßen zu dürfen.<br><br>
      Freundliche Grüße,<br><strong style="color:#212529;">${company}</strong>
    </p>
  `;

  const html = emailShell(content, company);

  if (!transport) {
    console.log(`[EMAIL] Checkout-Danke an ${visitor.email}: ${visitor.first_name} ${visitor.last_name} ausgecheckt um ${checkoutTime}`);
    return;
  }
  try {
    await transport.sendMail({
      from: `"${cfg.fromName || company + ' Besucherverwaltung'}" <${cfg.fromEmail}>`,
      to: visitor.email,
      subject,
      html,
    });
  } catch (err) {
    console.error('E-Mail-Fehler (Checkout):', err.message);
  }
}

module.exports = { sendHostNotification, sendPreRegistrationQR, sendVisitorConfirmation, sendVisitorCheckout };
