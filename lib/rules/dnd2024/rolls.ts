// Tiradas firmadas (características y dados de golpe): el servidor las genera y luego comprueba que el personaje usa
// esas.
import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_MS = 24 * 3600 * 1000;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("Falta AUTH_SECRET en .env.local");
  return s;
}

const hmac = (payload: string) => createHmac("sha256", secret()).update(payload).digest("hex");

const mac = (userId: string, values: number[], expires: number) =>
  hmac(`${userId}|${[...values].sort((a, b) => a - b).join(",")}|${expires}`);
// Prefijo propio: un token de dado de golpe no sirve como tirada de características ni al revés
const hitDieMac = (userId: string, r: HitDieRoll, expires: number) =>
  hmac(`hit-die|${userId}|${r.characterId}|${r.n}|${r.die}|${r.value}|${expires}`);

// Token `expira.firma`: comprueba la forma, la caducidad y la firma esperada
function checkToken(token: unknown, now: number, expected: (expires: number) => string): boolean {
  if (typeof token !== "string") return false;
  const [exp, sig, ...rest] = token.split(".");
  if (!exp || !sig || rest.length || !/^\d{1,15}$/.test(exp)) return false;
  const expires = Number(exp);
  if (now > expires) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(expected(expires));
  return a.length === b.length && timingSafeEqual(a, b);
}

// Token `expira.firma`; los valores se firman ordenados, así que el orden de reparto da igual
export function signRolls(userId: string, values: number[], now = Date.now()): string {
  const expires = now + TTL_MS;
  return `${expires}.${mac(userId, values, expires)}`;
}

export function verifyRolls(userId: string, values: number[], token: string, now = Date.now()): boolean {
  return checkToken(token, now, (expires) => mac(userId, values, expires));
}

/** Dados de golpe de las clases. */
export const HIT_DICE = [6, 8, 10, 12] as const;
const isHitDie = (die: unknown): die is number => HIT_DICE.includes(die as (typeof HIT_DICE)[number]);

/** Tirada de un dado de golpe (1..die). */
export const rollHitDie = (die: number, rng: () => number = Math.random) => Math.floor(rng() * die) + 1;

/** Tirada de dado de golpe para el nivel total `n` del personaje `characterId`. */
export type HitDieRoll = { characterId: string; n: number; die: number; value: number };

/** Token de una tirada de dado de golpe, ligado al usuario, al personaje, al nivel, al dado y al valor (24 h). */
export function signHitDie(userId: string, roll: HitDieRoll, now = Date.now()): string {
  const expires = now + TTL_MS;
  return `${expires}.${hitDieMac(userId, roll, expires)}`;
}

/** Comprueba el token y que el valor esté dentro del dado. */
export function verifyHitDie(userId: string, roll: HitDieRoll, token: string, now = Date.now()): boolean {
  const { die, value } = roll;
  if (!isHitDie(die) || !Number.isInteger(value) || value < 1 || value > die) return false;
  return checkToken(token, now, (expires) => hitDieMac(userId, roll, expires));
}

/** 4d6 sin el menor, seis veces; `dice[i]` son los 4 dados de `values[i]` en el orden en que salieron. */
export function rollAbilityScoresDetailed(rng: () => number = Math.random): { values: number[]; dice: number[][] } {
  const dice = Array.from({ length: 6 }, () => Array.from({ length: 4 }, () => Math.floor(rng() * 6) + 1));
  return { values: dice.map(abilityRollValue), dice };
}

/** Suma de los 3 dados más altos de una tirada de 4d6. */
export const abilityRollValue = (d: number[]) => d.reduce((s, n) => s + n, 0) - Math.min(...d);
