import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/server/rateLimit";
import { loadConversation, sendMessage } from "@/lib/server/social/messages";
import { failureResponse } from "@/lib/server/result";
import { cleanText } from "@/lib/utils/utils";

type Ctx = { params: Promise<{ username: string }> };

/* GET: mensajes de la conversación (los últimos 50, o los posteriores a ?after=).
   Al consultarla, los mensajes recibidos pasan a leídos y su notificación desaparece.
   myLastReadId: el último mensaje TUYO que la otra persona ya ha leído (para mostrar "Leído"). */
export async function GET(req: NextRequest, { params }: Ctx) {
  const { username } = await params;
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const result = await loadConversation(session.id, username, req.nextUrl.searchParams.get("after"));
  if (!result.ok) return failureResponse(result);
  const { messages, canSend, myLastReadId } = result;
  return NextResponse.json({ messages, canSend, myLastReadId });
}

// POST: enviar un mensaje (solo a amigos, y sin bloqueos de por medio)
export async function POST(req: NextRequest, { params }: Ctx) {
  const { username } = await params;
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("message_send", session.id, 40, 10 * 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }
  const text = cleanText(typeof body.text === "string" ? body.text : "").trim();
  if (!text)
    return NextResponse.json({ error: "Escribe un mensaje." }, { status: 400 });
  if (text.length > 2000)
    return NextResponse.json(
      { error: "El mensaje es demasiado largo (máximo 2000 caracteres)." },
      { status: 400 },
    );

  const result = await sendMessage(session.id, username, text);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ message: result.message }, { status: 201 });
}
