import crypto from "node:crypto";

export const MAX_MEMBERS = 30; // incluido el DM

// 16 bytes aleatorios = 128 bits, escritos en 22 caracteres seguros para una dirección
export const newInviteCode = () => crypto.randomBytes(16).toString("base64url");
export const INVITE_REGEX = /^[A-Za-z0-9_-]{22}$/;

export const INVITE_EXPIRY_DAYS: Record<string, number> = {
  "1d": 1,
  "7d": 7,
  "30d": 30,
};
