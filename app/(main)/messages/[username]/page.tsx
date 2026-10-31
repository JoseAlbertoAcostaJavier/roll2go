import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import Avatar from "@/app/components/ui/Avatar";
import ChatThread, { type ChatMessage } from "@/app/components/social/ChatThread";
import { requireUser } from "@/lib/server/auth/currentUser";
import { loadConversationPage } from "@/lib/server/social/messages";

export const metadata: Metadata = { title: "Mensajes" };

export default async function ConversationPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const me = await requireUser(`/messages/${username}`);
  const page = await loadConversationPage(me.id, username);
  if (page.status === "missing") notFound();
  if (page.status === "self") redirect("/messages");
  // Sin amistad y sin historial no hay nada que ver aquí
  if (page.status === "nothing") redirect(`/users/${page.username}`);

  const { other, canSend } = page;
  const initial: ChatMessage[] = page.messages;

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link href="/messages" className="mb-4 flex items-center gap-1 text-sm text-muted hover:text-white">
        <ChevronLeft size={16} aria-hidden="true" /> Mensajes
      </Link>
      <Link href={`/users/${other.username}`} className="group mb-4 flex items-center gap-3">
        <Avatar url={other.avatarUrl} size={44} />
        <span>
          <span className="block font-heading text-lg font-bold group-hover:underline">{other.displayName}</span>
          <span className="block text-xs text-muted">@{other.username}</span>
        </span>
      </Link>
      <ChatThread
        username={other.username}
        initial={initial}
        initialReadId={page.lastReadId}
        canSend={canSend}
      />    
      </div>
  );
}