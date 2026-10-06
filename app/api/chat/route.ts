import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { systemPromptFor } from "@/lib/rolAssistant";
import { system as rpgSystems } from "@/lib/systems";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/rateLimit";

export const maxDuration = 30;

// 3 modelos x 9 s = 27 s en el peor caso, dentro de los 30 s de maxDuration
const TIMEOUT_MS = 9000;

// Si el modelo tarda más de 9 s, se considera saturado y se pasa al siguiente
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(Object.assign(new Error("Timeout"), { status: 503 })),
      ms,
    );
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Se prueban en orden: si el primero está saturado, pasa al siguiente
const MODELS = [
  process.env.GEMINI_MODEL ?? "gemini-flash-latest",
  ...(
    process.env.GEMINI_FALLBACK_MODELS ??
    "gemini-2.5-flash,gemini-3.5-flash-lite"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
];

type Msg = { role: "user" | "model"; text: string };
type Content = { role: "user" | "model"; parts: { text: string }[] };

const statusOf = (err: unknown) => (err as { status?: number })?.status;
const isBusy = (err: unknown) => [429, 500, 503].includes(statusOf(err) ?? 0);
/*Todos los mensajes que aparezcan en la consola de Gemini son de nivel "warn" 
y no se muestran al usuario. Solo se muestra un mensaje genérico de saturación si el error es 429 o 503.*/
async function generate(
  contents: Content[],
  instruction: string,
): Promise<string> {
  let lastErr: unknown;
  let sawBusy = false;
  for (const model of MODELS) {
    try {
      const r = await withTimeout(
        ai.models.generateContent({
          model,
          contents,
          config: { systemInstruction: instruction, temperature: 0.6 },
        }),
        TIMEOUT_MS,
      );
      return r.text ?? "No he podido generar una respuesta.";
    } catch (err) {
      lastErr = err;
      if (statusOf(err) === 404) {
        console.warn(
          `Modelo no disponible: ${model}. Revisa GEMINI_MODEL / GEMINI_FALLBACK_MODELS.`,
        );
        continue;
      }
      if (!isBusy(err)) throw err;
      sawBusy = true;
      console.warn(`Gemini lento o saturado con ${model}`);
    }
  }
  if (sawBusy)
    throw Object.assign(new Error("Modelos saturados"), { status: 503 });
  throw lastErr;
}

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "Falta GEMINI_API_KEY en el servidor." },
      { status: 500 },
    );
  }

  // Máximo 20 preguntas cada 10 minutos por IP (protege tu cuota de Gemini)
  const limited = await rateLimit("chat", getClientIp(req), 20, 10 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: { messages?: Msg[]; systemId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  // El sistema de rol es obligatorio y tiene que ser uno de los de la lista (no se puede inventar)
  const selected = rpgSystems.find((s) => s.id === body.systemId);
  if (!selected) {
    return NextResponse.json(
      { error: "Elige primero un sistema de rol." },
      { status: 400 },
    );
  }

  const contents: Content[] = (
    Array.isArray(body.messages) ? body.messages : []
  )
    .filter(
      (m) =>
        (m.role === "user" || m.role === "model") &&
        typeof m.text === "string" &&
        m.text.trim(),
    )
    .slice(-10)
    .map((m) => ({ role: m.role, parts: [{ text: m.text.slice(0, 1000) }] }));

  while (contents.length && contents[0].role === "model") contents.shift();
  if (!contents.length || contents[contents.length - 1].role !== "user") {
    return NextResponse.json(
      { error: "Escribe una pregunta." },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({
      reply: await generate(contents, systemPromptFor(selected.name)),
    });
  } catch (err) {
    console.error("Error de Gemini:", err);
    if (isBusy(err)) {
      return NextResponse.json(
        {
          error:
            "El asistente está saturado ahora mismo. Inténtalo de nuevo en unos segundos.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "El asistente no está disponible ahora mismo." },
      { status: 502 },
    );
  }
}
