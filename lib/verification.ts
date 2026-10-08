import crypto from "node:crypto";

export const VERIFY_TTL_MS = 30 * 60 * 1000; // el enlace caduca a los 30 minutos

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Crea un token aleatorio. Al usuario se le envía "token"; en la base de datos solo se guarda "hash".
export function createVerificationToken() {
  const token = crypto.randomBytes(32).toString("hex");
  return {
    token,
    hash: hashToken(token),
    expires: new Date(Date.now() + VERIFY_TTL_MS),
  };
}
