// Tiradas de característica firmadas: el servidor las genera y luego comprueba que el personaje usa esas.
import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_MS = 24 * 3600 * 1000;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("Falta AUTH_SECRET en .env.local");
  return s;
}

const mac = (userId: string, values: number[], expires: number) =>
  createHmac("sha256", secret())
    .update(`${userId}|${[...values].sort((a, b) => a - b).join(",")}|${expires}`)
    .digest("hex");

// Token `expira.firma`; los valores se firman ordenados, así que el orden de reparto da igual
export function signRolls(userId: string, values: number[], now = Date.now()): string {
  const expires = now + TTL_MS;
  return `${expires}.${mac(userId, values, expires)}`;
}

export function verifyRolls(userId: string, values: number[], token: string, now = Date.now()): boolean {
  if (typeof token !== "string") return false;
  const [exp, sig, ...rest] = token.split(".");
  if (!exp || !sig || rest.length || !/^\d{1,15}$/.test(exp)) return false;
  const expires = Number(exp);
  if (now > expires) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(mac(userId, values, expires));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** 4d6 sin el menor, seis veces; `dice[i]` son los 4 dados de `values[i]` en el orden en que salieron. */
export function rollAbilityScoresDetailed(rng: () => number = Math.random): { values: number[]; dice: number[][] } {
  const dice = Array.from({ length: 6 }, () => Array.from({ length: 4 }, () => Math.floor(rng() * 6) + 1));
  return { values: dice.map(abilityRollValue), dice };
}

/** Suma de los 3 dados más altos de una tirada de 4d6. */
export const abilityRollValue = (d: number[]) => d.reduce((s, n) => s + n, 0) - Math.min(...d);
