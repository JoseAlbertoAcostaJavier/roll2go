export const NOTIFICATION_TYPES = [
  "friend_request",
  "friend_accepted",
  "message",
  "system",
  "forum_reply",
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
// Tipos de aviso de campaña que se pueden activar o desactivar por separado para el correo
export const CAMPAIGN_EMAIL_PREFS = [
  { key: "notes", title: "Nuevas notas", desc: "Notas nuevas en el diario de campaña." },
  { key: "forum", title: "Mensajes del foro", desc: "Hilos nuevos y respuestas a tus mensajes." },
  { key: "invites", title: "Invitaciones", desc: "Cuando alguien te invita a una campaña." },
  { key: "removals", title: "Expulsiones", desc: "Cuando el DM te expulsa de una campaña." },
  { key: "dm", title: "Avisos del DM", desc: "En tus campañas: nuevos jugadores, personajes y solicitudes de importación." },
] as const;
export type CampaignEmailPref = (typeof CAMPAIGN_EMAIL_PREFS)[number]["key"];
export type EmailPref = "messages" | "social" | CampaignEmailPref;

export type EmailPrefs = {
  campaigns?: boolean; // interruptor antiguo: se usa para los tipos de campaña que no se han tocado
  messages?: boolean;
  social?: boolean;
  campaignTypes?: Partial<Record<CampaignEmailPref, boolean>>;
};

// Valores por defecto para cuentas que todavía no han tocado sus preferencias
const DEFAULTS = { campaigns: true, messages: false, social: true };

// ¿Quiere el usuario este correo?
export function wantsEmail(prefs: EmailPrefs | undefined, pref: EmailPref): boolean {
  if (pref === "messages" || pref === "social") return prefs?.[pref] ?? DEFAULTS[pref];
  return prefs?.campaignTypes?.[pref] ?? prefs?.campaigns ?? DEFAULTS.campaigns;
}

// A qué opción de correo (Ajustes → Notificaciones) pertenece cada tipo. null = nunca se envía correo.
export function emailPrefFor(type: NotificationType): EmailPref | null {
  switch (type) {
    case "friend_request":
    case "friend_accepted":
      return "social";
    case "message":
      return "messages";
    case "campaign_note":
      return "notes";
    case "campaign_post":
    case "forum_reply":
      return "forum";
    case "campaign_invite":
      return "invites";
    case "campaign_removed":
      return "removals";
    case "campaign_joined":
    case "character_created":
    case "character_import_request":
      return "dm";
    case "system":
    case "book_like":
      return null;
  }
}

type Actor = { username: string; displayName: string } | null;
type CampaignRef = { id: string; name: string } | null;

// Texto y enlace de una notificación (se usan en la campana y en el correo)
export function describeNotification(
  n: { type: NotificationType; count?: number; text?: string; post?: string },
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
        text:
          (n.count ?? 1) > 1
            ? `Hay ${n.count} notas nuevas en ${where}`
            : `${who} ha publicado una nueva nota en ${where}`,
        href: `${campaignHref}/log`,
      };
    case "campaign_post": {
      const many = (n.count ?? 1) > 1;
      return {
        text: many ? `Hay ${n.count} mensajes nuevos en ${where}` : `${who} ha publicado un nuevo mensaje en ${where}`,
        // Un solo mensaje enlaza directo a su hilo; varios, a la lista del foro
        href: !many && n.post ? `${campaignHref}/forum/${n.post}` : `${campaignHref}/forum`,
      };
    }
    case "forum_reply":
      return {
        text:
          (n.count ?? 1) > 1
            ? `Hay ${n.count} respuestas nuevas a tu mensaje en ${where}`
            : `${who} ha respondido a tu mensaje en ${where}`,
        href: n.post ? `${campaignHref}/forum/${n.post}` : `${campaignHref}/forum`,
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
