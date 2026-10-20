import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import Avatar from "@/app/components/Avatar";
import ChatThread, { type ChatMessage } from "@/app/components/ChatThread";
import { requireUser } from "@/lib/currentUser";
import { connectDB } from "@/lib/mongodb";
import { Message } from "@/lib/Message";
import { pairKey } from "@/lib/Friendship";
import { findUserByUsername, relationBetween } from "@/lib/friends";

export const metadata: Metadata = { title: "Mensajes" };

export default async function ConversationPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const me = await requireUser(`/messages/${username}`);
  await connectDB();

  const other = await findUserByUsername(username);
  if (!other) notFound();
  const otherId = String(other._id);
  if (otherId === me.id) redirect("/messages");

  const canSend = (await relationBetween(me.id, otherId)) === "friend";
  const recent = await Message.find({ pair: pairKey(me.id, otherId) }).sort({ createdAt: -1 }).limit(50).lean();

  // Sin amistad y sin historial no hay nada que ver aquí
  if (!canSend && recent.length === 0) redirect(`/users/${other.username}`);

  const initial: ChatMessage[] = recent.reverse().map((m) => ({
    id: String(m._id),
    mine: String(m.from) === me.id,
    text: m.text,
    createdAt: new Date(m.createdAt).toISOString(),
  }));

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link href="/messages" className="mb-4 flex items-center gap-1 text-sm text-muted hover:text-white">
        <ChevronLeft size={16} aria-hidden="true" /> Mensajes
      </Link>
      <Link href={`/users/${other.username}`} className="mb-4 flex items-center gap-3 hover:underline">
        <Avatar url={other.avatarId ? `/api/images/${other.avatarId}` : null} size={44} />
        <span>
          <span className="block font-heading text-lg font-bold">{other.displayName || other.username}</span>
          <span className="block text-xs text-muted">@{other.username}</span>
        </span>
      </Link>
      <ChatThread username={other.username} initial={initial} canSend={canSend} />
    </div>
  );
}