"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownRight, LoaderCircle, Pencil, Pin, PinOff, Reply } from "lucide-react";
import Bbcode from "@/app/components/Bbcode";
import ConfirmAction from "@/app/components/ConfirmAction";
import ForumPostForm from "@/app/components/ForumPostForm";
import LocalDate from "@/app/components/LocalDate";
import Reactions from "@/app/components/Reactions";
import UserLink from "@/app/components/UserLink";
import type { ReactionState } from "@/lib/forum";
import type { UserCard } from "@/lib/userCards";

export type ForumMessageData = {
  id: string;
  rootId: string;
  isRoot: boolean;
  number: number | null; // posición de la respuesta en el hilo (null en el mensaje principal)
  title?: string;
  content: string;
  createdAt: string;
  editedAt: string | null;
  pinned: boolean;
  author: UserCard | null;
  authorIsDm: boolean;
  // A quién responde (solo en respuestas dirigidas a otra respuesta). href: enlace si está en la misma página
  replyTo: { name: string; href: string | null } | null;
  reactions: ReactionState;
  canEdit: boolean;
  canDelete: boolean;
  canPin: boolean;
};

const action =
  "flex items-center gap-1 rounded-md px-1.5 py-1 text-sm text-muted transition-colors hover:bg-panel hover:text-white disabled:opacity-50";

export default function ForumMessage({ campaignId, data }: { campaignId: string; data: ForumMessageData }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [pinError, setPinError] = useState("");

  async function togglePin() {
    setPinError("");
    setPinning(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/forum/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !data.pinned }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return setPinError(body?.error ?? `El servidor ha respondido con un error (${res.status}).`);
      }
      router.refresh();
    } catch {
      setPinError("No se pudo conectar con el servidor.");
    } finally {
      setPinning(false);
    }
  }

  return (
    <article
      id={`msg-${data.id}`}
      className={`scroll-mt-24 animate-fade-up rounded-lg border bg-surface p-5 transition-colors target:border-brand target:shadow-[0_0_0_3px_rgba(220,55,65,0.2)] ${
        data.isRoot && data.pinned ? "border-brand/60" : "border-line"
      }`}
    >
      <header className="mb-3">
        {data.isRoot && (
          <h2 className="mb-2 flex items-start gap-2 break-words font-heading text-xl font-bold">
            {data.pinned && <Pin size={16} className="mt-1.5 shrink-0 text-brand-soft" aria-label="Mensaje fijado" />}
            {data.title}
          </h2>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            {data.author ? (
              <UserLink user={data.author} size={data.isRoot ? 32 : 26} crown={data.authorIsDm} className="text-sm text-fg" />
            ) : (
              <span>Participante eliminado</span>
            )}
            {data.authorIsDm && (
              <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-soft">
                DM
              </span>
            )}
            <span aria-hidden="true">·</span>
            <LocalDate iso={data.createdAt} />
            {data.editedAt && (
              <span className="italic">(editado)</span>
            )}
          </div>
          {data.number !== null && (
            <a href={`#msg-${data.id}`} className="text-xs text-muted hover:text-white" aria-label={`Enlace a la respuesta ${data.number}`}>
              #{data.number}
            </a>
          )}
        </div>
      </header>

      {data.replyTo && (
        <p className="mb-2 flex items-center gap-1.5 text-xs text-muted">
          <CornerDownRight size={12} aria-hidden="true" /> En respuesta a{" "}
          {data.replyTo.href ? (
            <a href={data.replyTo.href} className="font-semibold text-fg hover:underline">{data.replyTo.name}</a>
          ) : (
            <strong className="font-semibold text-fg">{data.replyTo.name}</strong>
          )}
        </p>
      )}

      {editing ? (
        <ForumPostForm
          campaignId={campaignId}
          kind={data.isRoot ? "post" : "reply"}
          editId={data.id}
          initial={{ title: data.title ?? "", content: data.content }}
          onDone={() => setEditing(false)}
        />
      ) : (
        <Bbcode source={data.content} className="break-words text-sm" />
      )}

      {!editing && (
        <footer className="mt-4 space-y-3 border-t border-line pt-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Reactions campaignId={campaignId} postId={data.id} initial={data.reactions} />

            <div className="flex flex-wrap items-center gap-2">
              {data.isRoot ? (
                <a href="#responder" className={action}>
                  <Reply size={14} aria-hidden="true" /> Responder
                </a>
              ) : (
                <button type="button" onClick={() => setReplying((r) => !r)} aria-expanded={replying} className={action}>
                  <Reply size={14} aria-hidden="true" /> Responder
                </button>
              )}
              {data.canEdit && (
                <button type="button" onClick={() => setEditing(true)} className={action}>
                  <Pencil size={14} aria-hidden="true" /> Editar
                </button>
              )}
              {data.canPin && (
                <button type="button" onClick={togglePin} disabled={pinning} className={action}>
                  {pinning ? (
                    <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
                  ) : data.pinned ? (
                    <PinOff size={14} aria-hidden="true" />
                  ) : (
                    <Pin size={14} aria-hidden="true" />
                  )}
                  {data.pinned ? "Desfijar" : "Fijar"}
                </button>
              )}
              {data.canDelete && (
                <ConfirmAction
                  url={`/api/campaigns/${campaignId}/forum/${data.id}`}
                  label="Borrar"
                  question={data.isRoot ? "¿Borrar el mensaje y todas sus respuestas?" : "¿Borrar esta respuesta?"}
                  confirmLabel="Sí, borrar"
                  redirectTo={data.isRoot ? `/campaigns/${campaignId}/forum` : undefined}
                />
              )}
            </div>
          </div>
          {pinError && <p className="text-xs text-brand-soft" role="alert">{pinError}</p>}

          {replying && (
            <div className="rounded-md border border-line bg-panel p-4">
              <ForumPostForm
                campaignId={campaignId}
                kind="reply"
                parent={data.rootId}
                replyTo={data.id}
                onDone={() => setReplying(false)}
              />
            </div>
          )}
        </footer>
      )}
    </article>
  );
}
