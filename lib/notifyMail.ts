import nodemailer from "nodemailer";
import { getTransporter } from "@/lib/mail";

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const MAX_QUOTE = 600;

/* Correo de aviso con el mismo estilo que el de verificación: cabecera roja, cuerpo claro y pie oscuro.
   quote: texto que se cita en el correo (por ejemplo, el mensaje recibido). */
export async function sendNotificationEmail(
  to: string,
  text: string,
  path: string,
  quote?: string,
) {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  const link = `${base}${path}`;
  const settings = `${base}/settings/notifications`;
  const safe = escapeHtml(text);
  const q = quote?.trim() ?? "";
  const cut = q.length > MAX_QUOTE ? `${q.slice(0, MAX_QUOTE)}…` : q;
  const quoteHtml = cut
    ? `<div style="margin:0 0 24px;padding:14px 18px;border-left:4px solid #dc3741;background:#f6f6f7;color:#242426;white-space:pre-wrap;word-break:break-word;">${escapeHtml(cut)}</div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f2f2f3;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f3;"><tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;">
      <tr><td align="center" bgcolor="#bc1e28" style="background:#bc1e28;padding:32px 24px;">
        <span style="font-family:'Arial Black',Impact,Arial,sans-serif;font-size:36px;font-weight:900;color:#ffffff;letter-spacing:1px;">ROLL2GO</span>
      </td></tr>
      <tr><td style="padding:36px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#242426;">
        <p style="margin:0 0 24px;font-size:18px;color:#19191a;">${safe}</p>
        ${quoteHtml}
        <table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:8px auto 24px;"><tr>
          <td align="center" bgcolor="#dc3741" style="border-radius:6px;background:#dc3741;">
            <a href="${link}" style="display:inline-block;padding:14px 34px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:6px;">Verlo en Roll2Go</a>
          </td>
        </tr></table>
      </td></tr>
      <tr><td align="center" bgcolor="#19191a" style="background:#19191a;padding:22px 16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#ffffff;">
        Recibes este correo porque tienes activadas estas notificaciones.<br>
        <a href="${settings}" style="color:#f27474;text-decoration:none;">Cambiar mis preferencias</a>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  const info = await getTransporter().sendMail({
    from: process.env.MAIL_FROM ?? process.env.SMTP_USER,
    to,
    subject: text,
    text: `${text}\n\nÁbrelo aquí: ${link}\n\nCambiar mis preferencias: ${settings}`,
    html,
  });
  // Con Ethereal (solo pruebas) se imprime un enlace para ver el correo
  const preview = nodemailer.getTestMessageUrl(info);
  if (preview) console.log("Vista previa del correo:", preview);
}
