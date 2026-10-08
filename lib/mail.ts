import fs from "node:fs";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error("Faltan SMTP_HOST, SMTP_USER o SMTP_PASS en .env.local");
  }
  const port = Number(process.env.SMTP_PORT ?? 465);
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465, // 465 = TLS directo; 587 = STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

// Por seguridad: aunque el nombre de usuario ya solo admite letras, números y guion bajo
const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const LOGO_CID = "roll2go-logo";

export async function sendVerificationEmail(
  to: string,
  username: string,
  token: string,
) {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  const link = `${base}/verify/confirm?token=${token}`;
  const name = escapeHtml(username);
  const year = new Date().getFullYear();
  const contactEmail = process.env.CONTACT_EMAIL;

  /* El logo del correo, por orden de preferencia:
     1. EMAIL_LOGO_URL: una dirección pública (https) de la imagen. Es lo recomendable en producción.
     2. assets/logo.png incrustado en el propio correo (funciona también en local).
     3. Si no hay imagen, se muestra el nombre en texto. */
  const logoUrl = process.env.EMAIL_LOGO_URL;
  const logoPath = path.join(process.cwd(), "assets", "logo.png");
  const embedLogo = !logoUrl && fs.existsSync(logoPath);
  const logoHtml =
    logoUrl || embedLogo
      ? `<img src="${logoUrl ?? `cid:${LOGO_CID}`}" alt="Roll2Go" width="260" style="display:block;width:260px;max-width:100%;height:auto;border:0;margin:0 auto;">`
      : `<span style="font-family:'Arial Black',Impact,Arial,sans-serif;font-size:44px;font-weight:900;color:#ffffff;letter-spacing:1px;">ROLL2GO</span>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Verifica tu cuenta de Roll2Go</title>
</head>
<body style="margin:0;padding:0;background:#f2f2f3;">
  <!-- Texto de vista previa (se ve en la lista de correos, no dentro del mensaje) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Confirma tu correo para activar tu cuenta de Roll2Go.</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f3;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;">

          <!-- Cabecera: logo y lema sobre fondo rojo -->
          <tr>
            <td align="center" bgcolor="#bc1e28" style="background:#bc1e28;padding:44px 24px 40px;">
              ${logoHtml}
              <p style="margin:18px 0 0;font-family:'Arial Black',Impact,Arial,sans-serif;font-size:20px;line-height:1.2;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:#ffffff;">Menos papeles y más rol</p>
            </td>
          </tr>

          <!-- Cuerpo -->
          <tr>
            <td style="padding:40px 32px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#242426;">
              <p style="margin:0 0 16px;font-size:18px;color:#19191a;">Hola ${name},</p>
              <p style="margin:0;">Confirma la dirección de correo electrónico de tu cuenta a través del siguiente enlace:</p>

              <!-- Botón -->
              <table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:30px auto;">
                <tr>
                  <td align="center" bgcolor="#dc3741" style="border-radius:6px;background:#dc3741;">
                    <a href="${link}" style="display:inline-block;padding:14px 34px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:6px;">Confirmar mi email</a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 16px;">El enlace caduca en 30 minutos. Hasta que confirmes tu correo no podrás iniciar sesión en Roll2Go.</p>
              <p style="margin:0 0 16px;font-size:13px;color:#6b6b70;">Si el botón no funciona, copia esta dirección en tu navegador:<br><a href="${link}" style="color:#bc1e28;word-break:break-all;">${link}</a></p>
              <p style="margin:0;font-size:13px;color:#6b6b70;">Si no has creado una cuenta en Roll2Go, ignora este mensaje.</p>
            </td>
          </tr>

          <!-- Pie -->
          <tr>
            <td align="center" bgcolor="#19191a" style="background:#19191a;padding:26px 16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#ffffff;">
              <p style="margin:0;font-weight:bold;">Adentrate al mundo del rol en Roll2Go.</p>
              ${
                contactEmail
                  ? `<p style="margin:10px 0 0;font-weight:bold;">Contactar | <a href="mailto:${escapeHtml(contactEmail)}" style="color:#f27474;text-decoration:none;">${escapeHtml(contactEmail)}</a></p>`
                  : ""
              }
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const info = await getTransporter().sendMail({
    from: process.env.MAIL_FROM ?? process.env.SMTP_USER,
    to,
    // Opcional: a dónde van las respuestas del usuario (MAIL_REPLY_TO en .env.local)
    replyTo: process.env.MAIL_REPLY_TO || undefined,
    subject: "Verifica tu cuenta de Roll2Go",
    text:
      `Hola ${username},\n\n` +
      `Confirma la dirección de correo electrónico de tu cuenta a través del siguiente enlace (caduca en 30 minutos):\n${link}\n\n` +
      `Hasta que confirmes tu correo no podrás iniciar sesión en Roll2Go.\n` +
      `Si no has creado una cuenta en Roll2Go, ignora este mensaje.`,
    html,
    attachments: embedLogo
      ? [{ filename: "logo.png", path: logoPath, cid: LOGO_CID }]
      : [],
  });

  // Con Ethereal (solo pruebas) se imprime un enlace para ver el correo; con un SMTP real no hace nada
  const preview = nodemailer.getTestMessageUrl(info);
  if (preview) console.log("Vista previa del correo:", preview);
}
