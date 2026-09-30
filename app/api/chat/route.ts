import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { SYSTEM_PROMPT } from "@/lib/rolAssistant";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Se prueban en orden: si el primero está saturado, pasa al siguiente
const MODELS = [
  process.env.GEMINI_MODEL ?? "gemini-flash-latest",
  ...(process.env.GEMINI_FALLBACK_MODELS ?? "gemini-2.5-flash,gemini-2.5-flash-lite")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
];

type Msg = { role: "user" | "model"; text: string };
type Content = { role: "user" | "model"; parts: { text: string }[] };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const statusOf = (err: unknown) => (err as { status?: number })?.status;
const isBusy = (err: unknown) => [429, 500, 503].includes(statusOf(err) ?? 0);

async function generate(contents: Content[]): Promise<string> {
  let lastErr: unknown;
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await ai.models.generateContent({
          model,
          contents,
          config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.6 },
        });
        return r.text ?? "No he podido generar una respuesta.";
      } catch (err) {
        lastErr = err;
        if (statusOf(err) === 404) break; // el modelo no existe: pasa al siguiente
        if (!isBusy(err)) throw err;      // otro error (clave, petición...): no reintentar
        console.warn(`Gemini saturado con ${model} (intento ${attempt + 1})`);
        await sleep(700 * (attempt + 1));
      }
    }
  }
  throw lastErr;
}

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "Falta GEMINI_API_KEY en el servidor." }, { status: 500 });
  }

  let body: { messages?: Msg[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  const contents: Content[] = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m.role === "user" || m.role === "model") && typeof m.text === "string" && m.text.trim())
    .slice(-10)
    .map((m) => ({ role: m.role, parts: [{ text: m.text.slice(0, 1000) }] }));

  while (contents.length && contents[0].role === "model") contents.shift();
  if (!contents.length || contents[contents.length - 1].role !== "user") {
    return NextResponse.json({ error: "Escribe una pregunta." }, { status: 400 });
  }

  try {
    return NextResponse.json({ reply: await generate(contents) });
  } catch (err) {
    console.error("Error de Gemini:", err);
    if (isBusy(err)) {
      return NextResponse.json(
        { error: "El asistente está saturado ahora mismo. Inténtalo de nuevo en unos segundos." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "El asistente no está disponible ahora mismo." }, { status: 502 });
  }
}