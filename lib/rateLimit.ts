import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";

type RateLimitDoc = { key: string; count: number; expiresAt: Date };

const RateLimitSchema = new mongoose.Schema<RateLimitDoc>({
  key: { type: String, required: true, unique: true },
  count: { type: Number, required: true, default: 0 },
  expiresAt: { type: Date, required: true },
});
// Índice TTL: MongoDB borra cada documento solo cuando pasa su fecha de caducidad
RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RateLimit: mongoose.Model<RateLimitDoc> =
  (mongoose.models.RateLimit as mongoose.Model<RateLimitDoc>) ||
  mongoose.model<RateLimitDoc>("RateLimit", RateLimitSchema);

// IP del cliente. Detrás de un hosting como Vercel, la cabecera la pone la plataforma.
export function getClientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

/* Permite como máximo "limit" peticiones por IP cada "windowSec" segundos.
   Los contadores viven en MongoDB, así que valen aunque haya varias instancias del servidor. */
export async function rateLimit(name: string, ip: string, limit: number, windowSec: number) {
  try {
    await connectDB();
    const windowMs = windowSec * 1000;
    const slot = Math.floor(Date.now() / windowMs);
    const key = `${name}:${ip}:${slot}`;
    const retryAfter = Math.max(1, Math.ceil(((slot + 1) * windowMs - Date.now()) / 1000));
    const update = {
      $inc: { count: 1 },
      $setOnInsert: { expiresAt: new Date((slot + 1) * windowMs) },
    };

    let doc;
    try {
      doc = await RateLimit.findOneAndUpdate({ key }, update, { upsert: true, new: true });
    } catch (err) {
      // 11000: dos peticiones crearon el contador a la vez; se repite sin "upsert"
      if ((err as { code?: number }).code !== 11000) throw err;
      doc = await RateLimit.findOneAndUpdate({ key }, update, { new: true });
    }
    return { ok: (doc?.count ?? 1) <= limit, retryAfter };
  } catch (err) {
    // Si el contador falla, no se bloquea a nadie
    console.error("Error en el límite de peticiones:", err);
    return { ok: true, retryAfter: 0 };
  }
}

export function tooManyRequests(retryAfter: number) {
  const wait = retryAfter < 90 ? "un minuto" : `${Math.ceil(retryAfter / 60)} minutos`;
  return NextResponse.json(
    { error: `Demasiados intentos. Inténtalo de nuevo en ${wait}.` },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}