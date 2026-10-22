import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { sessionOf, type Session } from "@/lib/campaignApi";
import { User } from "@/lib/User";

// Cabe en la notificación (500 caracteres) junto con el texto que la acompaña
export const REASON_MAX = 400;

const notFound = () => NextResponse.json({ error: "No encontrado." }, { status: 404 });

/* Exige sesión de administrador. El rol se comprueba en la base de datos, no en el token,
   y a quien no es admin le da 404. Uso: const ctx = await requireAdminApi(req); if (ctx.error) return ctx.error; */
export async function requireAdminApi(
  req: NextRequest,
): Promise<{ error: NextResponse; session?: undefined } | { error?: undefined; session: Session }> {
  const session = await sessionOf(req);
  if (!session) return { error: notFound() };
  await connectDB();
  const me = await User.findById(session.id).select("role").lean();
  if (me?.role !== "admin") return { error: notFound() };
  return { session };
}

// Lee el motivo del cuerpo de la petición. Devuelve el texto limpio o la respuesta de error.
export async function readReason(req: NextRequest): Promise<{ reason: string } | { error: NextResponse }> {
  let body: { reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return { error: NextResponse.json({ error: "Petición no válida." }, { status: 400 }) };
  }
  const reason = (typeof body.reason === "string" ? body.reason : "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim();
  if (reason.length < 3 || reason.length > REASON_MAX) {
    return {
      error: NextResponse.json(
        { error: `El motivo debe tener entre 3 y ${REASON_MAX} caracteres.` },
        { status: 400 },
      ),
    };
  }
  return { reason };
}
