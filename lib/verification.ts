import crypto from "node:crypto";

export const VERIFY_TTL_MS = 30 * 60 * 1000; // el enlace caduca a los 30 minutos
export const RESET_TTL_MS = 60 * 60 * 1000; // En caso de necesitar hacer un reset de contraseña. Caduca en 1 hora

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Crea un token aleatorio. Al usuario se le envía "token"; en la base de datos solo se guarda "hash".
export function createVerificationToken() {
  const token = crypto.randomBytes(32).toString("hex"); // Da 32 bytes en hexadecimal (64 caracteres)
  return { /*A la base de datos devuelvo el hash, y la fecha de expiración.
            De manera de que aun que me hackearan la base de datos, no podrán usar el token, puesto que este
            solo esta en el correo.
    */
    token,
    hash: hashToken(token),
    expires: new Date(Date.now() + VERIFY_TTL_MS),
  };
}


export function createResetToken() {
  const token = crypto.randomBytes(32).toString("hex");
  return {
    token,
    hash: hashToken(token),
    expires: new Date(Date.now() + RESET_TTL_MS),
  };
}