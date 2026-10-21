"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCheck, LoaderCircle, Send } from "lucide-react";
import LocalDate from "@/app/components/LocalDate";

export type ChatMessage = { id: string; mine: boolean; text: string; createdAt: string };

// Une mensajes nuevos con los que ya hay, sin repetidos y ordenados
const merge = (prev: ChatMessage[], incoming: ChatMessage[]) => {
  const map = new Map(prev.map((m) => [m.id, m] as const));
  for (const m of incoming) map.set(m.id, m);
  return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
};

export default function ChatThread({
  username,
  initial,
  initialReadId,
  canSend: canSendInitial,
}: {
  username: string;
  initial: ChatMessage[];
  initialReadId: string | null; // último mensaje TUYO que la otra persona ya ha leído
  canSend: boolean;
}) {
  const [messages, setMessages] = useState(initial);
  const [readId, setReadId] = useState(initialReadId);
  const [canSend, setCanSend] = useState(canSendInitial);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const lastRef = useRef<string | null>(initial[initial.length - 1]?.createdAt ?? null);

  // "Leído" solo en el último mensaje que has enviado, y solo si ya está leído
  const lastMineId = [...messages].reverse().find((m) => m.mine)?.id ?? null;

  useEffect(() => {
    lastRef.current = messages[messages.length - 1]?.createdAt ?? null;
    const box = boxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [messages]);

  // Pide los mensajes nuevos (y, de paso, marca como leídos los recibidos)
  const poll = useCallback(
    async (announce: boolean) => {
      try {
        const after = lastRef.current ? `?after=${encodeURIComponent(lastRef.current)}` : "";
        const res = await fetch(`/api/messages/${username}${after}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setCanSend(data.canSend);
        setReadId(data.myLastReadId ?? null);
        if (data.messages.length) setMessages((prev) => merge(prev, data.messages));
        // Avisa al Navbar para que actualice el contador (al abrir, o cuando llega algo de la otra persona)
        if (announce || data.messages.some((m: ChatMessage) => !m.mine)) {
          window.dispatchEvent(new Event("notifications:changed"));
        }
      } catch {
        /* sin conexión: se reintenta en el siguiente ciclo */
      }
    },
    [username],
  );

  // Al abrir se marcan como leídos; después se consulta cada 5 segundos mientras la pestaña esté visible
  useEffect(() => {
    void poll(true);
    const id = setInterval(() => {
      if (!document.hidden) void poll(false);
    }, 5000);
    return () => clearInterval(id);
  }, [poll]);

  async function send() {
    const body = text.trim();
    if (!body || sending || !canSend) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/messages/${username}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? `El servidor ha respondido con un error (${res.status}).`);
        return;
      }
      setMessages((prev) => merge(prev, [data.message]));
      setText("");
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[min(34rem,calc(100dvh-16rem))] min-h-80 flex-col overflow-hidden rounded-lg border border-line bg-panel">
      <div ref={boxRef} className="flex flex-1 flex-col gap-2 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && <p className="m-auto text-sm text-muted">Todavía no hay mensajes entre {username} y tu. ¿Por que no le mandas un mensaje?</p>}
        {messages.map((m) => {
          const showRead = m.mine && m.id === lastMineId && m.id === readId;
          return (
            <div
              key={m.id}
              className={`max-w-[85%] whitespace-pre-wrap wrap-break-words rounded-lg px-3.5 py-2 text-sm ${
                m.mine ? "self-end bg-brand text-white" : "self-start border border-line bg-surface"
              }`}
            >
              {m.text}
              <span className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${m.mine ? "text-white/70" : "text-muted"}`}>
                <LocalDate iso={m.createdAt} timeOnly />
                {showRead && (
                  <>
                    <span aria-hidden="true">·</span>
                    <CheckCheck size={12} aria-hidden="true" />
                    Leído
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {error && <p className="px-4 pb-2 text-sm text-brand-soft" role="alert">{error}</p>}

      {canSend ? (
        <div className="flex items-end gap-2 border-t border-line p-3">
          <textarea
            value={text}
            rows={2}
            maxLength={2000}
            aria-label="Escribe un mensaje"
            placeholder={`Enviar mensaje a @${username}`}            
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            className="min-w-0 flex-1 resize-none rounded-md border border-line
                     bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-muted
                      focus:border-brand focus:outline-none"
          />
          <button
            type="button"
            onClick={send}
            disabled={sending || !text.trim()}
            aria-label="Enviar mensaje"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-brand
                     text-white transition-colors enabled:hover:bg-brand-hover disabled:opacity-50"
          >
            {sending ? <LoaderCircle size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </div>
      ) : (
        <p className="border-t border-line p-3 text-center text-sm text-muted">
          No puedes enviar mensajes nuevos a {username} por que ya no sois amigos.
        </p>
      )}
    </div>
  );
}