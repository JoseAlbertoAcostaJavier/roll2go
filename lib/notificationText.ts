export const NOTIFICATION_TYPES = [
  "friend_request",
  "friend_accepted",
  "message",
  "system",
  // Los siguientes se usarán en las entregas de campañas y libros
  "campaign_joined",
  "campaign_removed",
  "campaign_invite",
  "campaign_note",
  "campaign_post",
  "character_created",
  "character_import_request",
  "book_like",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type EmailPref = "campaigns" | "messages" | "social";

// A qué opción de correo (Ajustes → Notificaciones) pertenece cada tipo. null = nunca se envía correo.
export function emailPrefFor(type: NotificationType): EmailPref | null {
  switch (type) {
    case "friend_request":
    case "friend_accepted":
      return "social";
    case "message":
      return "messages";
    case "system":
    case "book_like":
      return null;
    default:
      return "campaigns";
  }
}

type Actor = { username: string; displayName: string } | null;
type CampaignRef = { id: string; name: string } | null;

// Texto y enlace de una notificación (se usan en la campana y en el correo)
export function describeNotification(
  n: { type: NotificationType; count?: number; text?: string },
  actor: Actor,
  campaign: CampaignRef,
): { text: string; href: string } {
  const who = actor?.displayName ?? "Alguien";
  const where = campaign?.name ?? "una campaña";
  const campaignHref = campaign ? `/campaigns/${campaign.id}` : "/campaigns";

  switch (n.type) {
    case "friend_request":
      return { text: `Solicitud de amistad de ${who}`, href: "/social" };
    case "friend_accepted":
      return {
        text: `${who} ha aceptado tu solicitud de amistad`,
        href: actor ? `/users/${actor.username}` : "/social",
      };
    case "message":
      return {
        text:
          (n.count ?? 1) > 1
            ? `Has recibido ${n.count} mensajes de ${who}`
            : `Has recibido un mensaje de ${who}`,
        href: actor ? `/messages/${actor.username}` : "/messages",
      };
    case "system":
      return { text: n.text ?? "Aviso de Roll2Go", href: "/notifications" };
    case "campaign_joined":
      return {
        text: `${who} se ha unido a ${where}`,
        href: `${campaignHref}/members`,
      };
    case "campaign_removed":
      return { text: `Has sido expulsado de ${where}`, href: "/campaigns" };
    case "campaign_invite":
      return { text: `${who} te ha invitado a ${where}`, href: "/campaigns" };
    case "campaign_note":
      return {
        text: `${who} ha publicado una nueva nota en ${where}`,
        href: `${campaignHref}/log`,
      };
    case "campaign_post":
      return {
        text: `${who} ha publicado un nuevo mensaje en ${where}`,
        href: `${campaignHref}/forum`,
      };
    case "character_created":
      return {
        text: `${who} ha creado un personaje en ${where}`,
        href: `${campaignHref}/characters`,
      };
    case "character_import_request":
      return {
        text: `${who} solicita importar un personaje a ${where}`,
        href: `${campaignHref}/characters`,
      };
    case "book_like":
      return {
        text: `${who} ha dado like a uno de tus libros de reglas`,
        href: "/notifications",
      };
  }
}
