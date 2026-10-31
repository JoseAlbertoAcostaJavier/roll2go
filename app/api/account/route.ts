import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/server/auth/auth";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { deleteAccount, updateAccount } from "@/lib/server/account/settings";
import { failureResponse } from "@/lib/server/result";
import { rateLimit, tooManyRequests } from "@/lib/utils/rateLimit";

const bad = (error: string, status = 400) =>
  NextResponse.json({ error }, { status });
const str = (v: unknown) => (typeof v === "string" ? v : "");

// Veces permitidas y ventana en segundos, por tipo de cambio
const LIMITS: Record<string, [number, number]> = {
  username: [5, 24 * 3600],
  password: [10, 3600],
  email: [5, 3600],
  notifications: [30, 3600],
};

export async function PATCH(req: NextRequest) {
  const session = await sessionOf(req);
  if (!session) return bad("Inicia sesión.", 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("Petición no válida.");
  }

  const kind = str(body.kind);
  const limit = LIMITS[kind];
  if (!limit) return bad("Acción no válida.");
  const limited = await rateLimit(
    `account_${kind}`,
    session.id,
    limit[0],
    limit[1],
  );
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const result = await updateAccount(session.id, kind, body);
  if (!result.ok) return failureResponse(result);
  if (result.username !== undefined) return NextResponse.json({ username: result.username });
  if (result.pendingEmail !== undefined) return NextResponse.json({ pendingEmail: result.pendingEmail });
  return NextResponse.json({ ok: true });
}

// BORRAR LA CUENTA: exige la contraseña y escribir el nombre de usuario
export async function DELETE(req: NextRequest) {
  const session = await sessionOf(req);
  if (!session) return bad("Inicia sesión.", 401);

  const limited = await rateLimit("account_delete", session.id, 5, 3600);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("Petición no válida.");
  }

  const result = await deleteAccount(session.id, str(body.password), str(body.confirmUsername));
  if (!result.ok) return failureResponse(result);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE_NAME);
  return res;
}
