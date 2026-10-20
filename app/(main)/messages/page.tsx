import type { Metadata } from "next";
import Link from "next/link";
import mongoose from "mongoose";
import Avatar from "@/app/components/Avatar";
import { requireUser } from "@/lib/currentUser";
import { connectDB } from "@/lib/mongodb";
import { Message } from "@/lib/Message";
import { User } from "@/lib/User";

export const metadata: Metadata = { title: "Mensajes" };

export default async function MessagesPage() {
  const me = await requireUser("/messages");
  await connectDB();
  const meId = new mongoose.Types.ObjectId(me.id);

  // Última conversación con cada persona y cuántos mensajes tienes sin leer
  const rows = await Message.aggregate([
    { $match: { $or: [{ from: meId }, { to: meId }] } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$pair",
        last: { $first: "$$ROOT" },
        unread: { $sum: { $cond: [{ $and: [{ $eq: ["$to", meId] }, { $eq: ["$readAt", null] }] }, 1, 0] } },
      },
    },
    { $sort: { "last.createdAt": -1 } },
    { $limit: 50 },
  ]);

  const otherIds = rows.map((r) => String(r.last.from) === me.id ? String(r.last.to) : String(r.last.from));
  const users = await User.find({ _id: { $in: otherIds } }).select("username displayName avatarId").lean();
  const byId = new Map(users.map((u) => [String(u._id), u] as const));

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="mb-6 font-heading text-3xl font-extrabold">Mensajes</h1>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line p-10 text-center text-muted">
          <p className="mb-3">Todavía no tienes conversaciones.</p>
          <Link href="/social" className="font-semibold text-brand-soft hover:underline">
            Ve a tu círculo y escribe a un amigo
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-panel">
          {rows.map((r, i) => {
            const u = byId.get(otherIds[i]);
            if (!u) return null; // cuenta borrada
            const mine = String(r.last.from) === me.id;
            const preview = String(r.last.text).slice(0, 90);
            return (
              <li key={String(r._id)}>
                <Link href={`/messages/${u.username}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface">
                  <Avatar url={u.avatarId ? `/api/images/${u.avatarId}` : null} size={48} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{u.displayName || u.username}</span>
                    <span className={`block truncate text-sm ${r.unread ? "font-semibold text-white" : "text-muted"}`}>
                      {mine ? "Tú: " : ""}{preview}
                    </span>
                  </span>
                  {r.unread > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-bold text-white">
                      {r.unread}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}