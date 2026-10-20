import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { sessionOf } from "@/lib/campaignApi";
import { Notification } from "@/lib/Notification";
import { User } from "@/lib/User";
import { Campaign } from "@/lib/Campaign";
import {
  describeNotification,
  type NotificationType,
} from "@/lib/notificationText";

// GET /api/notifications?limit=10  ->  lista y contador. Con limit=0 solo devuelve el contador.
export async function GET(req: NextRequest) {
  const session = await sessionOf(req);
  if (!session)
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const raw = req.nextUrl.searchParams.get("limit");
  const limit = Math.min(
    Math.max(raw === null ? 10 : parseInt(raw, 10) || 0, 0),
    50,
  );

  try {
    await connectDB();
    const unread = await Notification.countDocuments({
      user: session.id,
      read: false,
    });
    if (limit === 0) return NextResponse.json({ unread });

    const items = await Notification.find({ user: session.id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    const actorIds = [
      ...new Set(items.filter((n) => n.actor).map((n) => String(n.actor))),
    ];
    const campaignIds = [
      ...new Set(
        items.filter((n) => n.campaign).map((n) => String(n.campaign)),
      ),
    ];
    const [actors, campaigns] = await Promise.all([
      User.find({ _id: { $in: actorIds } })
        .select("username displayName avatarId")
        .lean(),
      Campaign.find({ _id: { $in: campaignIds } })
        .select("name")
        .lean(),
    ]);
    const actorById = new Map(actors.map((a) => [String(a._id), a] as const));
    const campaignById = new Map(
      campaigns.map((c) => [String(c._id), c] as const),
    );

    return NextResponse.json({
      unread,
      items: items.map((n) => {
        const a = n.actor ? actorById.get(String(n.actor)) : undefined;
        const c = n.campaign ? campaignById.get(String(n.campaign)) : undefined;
        const { text, href } = describeNotification(
          { type: n.type as NotificationType, count: n.count, text: n.text },
          a
            ? { username: a.username, displayName: a.displayName || a.username }
            : null,
          c ? { id: String(c._id), name: c.name } : null,
        );
        return {
          id: String(n._id),
          type: n.type,
          read: n.read,
          createdAt: new Date(n.createdAt).toISOString(),
          text,
          href,
          actor: a
            ? {
                username: a.username,
                displayName: a.displayName || a.username,
                avatarUrl: a.avatarId ? `/api/images/${a.avatarId}` : null,
              }
            : null,
        };
      }),
    });
  } catch (err) {
    console.error("Error al cargar las notificaciones:", err);
    return NextResponse.json(
      { error: "No se pudieron cargar las notificaciones." },
      { status: 500 },
    );
  }
}
