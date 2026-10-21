import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { sessionOf } from "@/lib/campaignApi";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { User } from "@/lib/User";
import { relationsWith } from "@/lib/friends";
import { blockedIdsOf } from "@/lib/blocks";
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export async function GET(req: NextRequest) {
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  // Se consulta mientras se escribe: límite de 60 búsquedas por minuto
  const limited = await rateLimit("user_search", session.id, 60, 60);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const q = (req.nextUrl.searchParams.get("q") ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 20);
  if (q.length < 2) return NextResponse.json({ users: [] });

  try {
    await connectDB();
    // Solo por usuario y nombre visible, y solo por el principio (nunca por correo)
    const prefix = new RegExp("^" + escapeRegex(q));
    const hidden = await blockedIdsOf(session.id); // bloqueados en cualquier dirección
    const users = await User.find({
      verified: true,
      _id: { $nin: [session.id, ...hidden] },
      $or: [{ usernameLower: prefix }, { displayNameLower: prefix }],
    })
      .select("username displayName avatarId")
      .sort({ usernameLower: 1 })
      .limit(8)
      .lean();

    const relations = await relationsWith(
      session.id,
      users.map((u) => String(u._id)),
    );
    return NextResponse.json({
      users: users.map((u) => ({
        username: u.username,
        displayName: u.displayName || u.username,
        avatarUrl: u.avatarId ? `/api/images/${u.avatarId}` : null,
        relation: relations.get(String(u._id)) ?? "none",
      })),
    });
  } catch (err) {
    console.error("Error en la búsqueda de usuarios:", err);
    return NextResponse.json(
      { error: "No se pudo buscar. Inténtalo de nuevo." },
      { status: 500 },
    );
  }
}
