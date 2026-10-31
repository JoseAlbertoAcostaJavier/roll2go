import type { Metadata } from "next";
import Link from "next/link";
import Avatar from "@/app/components/ui/Avatar";
import { requireUser } from "@/lib/server/auth/currentUser";
import { listConversations } from "@/lib/server/social/messages";

export const metadata: Metadata = { title: "Mensajes" };

export default async function MessagesPage() {
  const me = await requireUser("/messages");
  // Última conversación con cada persona y cuántos mensajes tienes sin leer
  const { total, conversations } = await listConversations(me.id);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="mb-6 font-heading text-3xl font-extrabold">Mensajes</h1>

      {total === 0 ? (
        <div className="rounded-lg border border-dashed border-line p-10 text-center text-muted">
          <p className="mb-3">Todavía no tienes conversaciones.</p>
          <Link href="/social" className="font-semibold text-brand-soft hover:underline">
            Ve a tu círculo y escribe a un amigo
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-panel">
          {conversations.map((r) => {
            return (
              <li key={r.pair}>
                <Link href={`/messages/${r.username}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface">
                  <Avatar url={r.avatarUrl} size={48} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{r.displayName}</span>
                    <span className={`block truncate text-sm ${r.unread ? "font-semibold text-white" : "text-muted"}`}>
                      {r.mine ? "Tú: " : ""}{r.preview}
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