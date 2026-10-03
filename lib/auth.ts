import { SignJWT, jwtVerify } from "jose";

export const COOKIE_NAME = "roll2go_session";

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("Falta AUTH_SECRET en .env.local");
  return new TextEncoder().encode(s);
}

// Crea el token firmado. Con "Recuérdame" dura 30 días; sin él, 1 día
export async function signSession(user: { id: string; username: string }, remember: boolean) {
  return new SignJWT({ username: user.username })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(remember ? "30d" : "1d")
    .sign(secret());
}

// Devuelve el usuario si el token es válido y no ha caducado; si no, null
export async function verifySession(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret());
    return { id: payload.sub as string, username: payload.username as string };
  } catch {
    return null;
  }
}

// httpOnly: el JavaScript del navegador no puede leer la cookie.
// Sin maxAge es una cookie de sesión: se borra al cerrar el navegador.
export function sessionCookieOptions(remember: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(remember ? { maxAge: 60 * 60 * 24 * 30 } : {}),
  };
}