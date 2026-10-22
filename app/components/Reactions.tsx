"use client";

import { useCallback, useRef, useState } from "react";
import { SmilePlus, ThumbsUp } from "lucide-react";
import useDismiss from "@/app/components/useDismiss";
import { LIKE, REACTIONS, type ReactionState } from "@/lib/forum";

const chip = "flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors disabled:cursor-wait";
const chipState = (mine: boolean) =>
  mine ? "border-brand bg-brand/15 text-white" : "border-line text-muted hover:border-muted hover:text-white";
const OTHERS = REACTIONS.filter((r) => r.emoji !== LIKE);
const EMPTY = { count: 0, mine: false };

export default function Reactions({
  campaignId,
  postId,
  initial,
}: {
  campaignId: string;
  postId: string;
  initial: ReactionState;
}) {
  const [state, setState] = useState<ReactionState>(initial);
  const [pending, setPending] = useState<string[]>([]); // emojis con una petición en curso
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  async function toggle(emoji: string) {
    // Mientras hay una petición de ese emoji, los clics se ignoran (así no se desincroniza el contador)
    if (pending.includes(emoji)) return;
    const prev = state[emoji] ?? EMPTY;
    setState((s) => ({ ...s, [emoji]: { count: Math.max(0, prev.count + (prev.mine ? -1 : 1)), mine: !prev.mine } }));
    setPending((p) => [...p, emoji]);
    setError("");
    setOpen(false);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/forum/${postId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No se pudo reaccionar.");
      setState((s) => ({ ...s, [emoji]: { count: data.count, mine: data.active } }));
    } catch (e) {
      setState((s) => ({ ...s, [emoji]: prev })); // se deshace
      setError(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "No se pudo reaccionar.");
    } finally {
      setPending((p) => p.filter((x) => x !== emoji));
    }
  }

  const like = state[LIKE] ?? EMPTY;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => toggle(LIKE)}
        disabled={pending.includes(LIKE)}
        aria-pressed={like.mine}
        className={`${chip} ${chipState(like.mine)}`}
      >
        <ThumbsUp size={14} aria-hidden="true" className={like.mine ? "fill-current" : ""} /> Me gusta
        {like.count > 0 && <span className="font-semibold tabular-nums">{like.count}</span>}
      </button>

      {OTHERS.filter((r) => (state[r.emoji]?.count ?? 0) > 0).map((r) => {
        const s = state[r.emoji];
        return (
          <button
            key={r.emoji}
            type="button"
            onClick={() => toggle(r.emoji)}
            disabled={pending.includes(r.emoji)}
            aria-pressed={s.mine}
            aria-label={`${r.label}: ${s.count}`}
            title={r.label}
            className={`${chip} ${chipState(s.mine)}`}
          >
            <span aria-hidden="true">{r.emoji}</span>
            <span className="font-semibold tabular-nums">{s.count}</span>
          </button>
        );
      })}

      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="true"
          aria-expanded={open}
          aria-label="Añadir reacción"
          title="Reaccionar"
          className={`${chip} border-line text-muted hover:border-muted hover:text-white`}
        >
          <SmilePlus size={14} aria-hidden="true" />
        </button>
        {open && (
          <div
            role="menu"
            className="absolute bottom-full left-0 z-30 mb-2 flex gap-1 rounded-full border border-line bg-panel p-1.5 shadow-[0_12px_30px_rgba(0,0,0,0.6)]"
          >
            {OTHERS.map((r) => {
              const mine = state[r.emoji]?.mine ?? false;
              return (
                <button
                  key={r.emoji}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={mine}
                  onClick={() => toggle(r.emoji)}
                  aria-label={r.label}
                  title={r.label}
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-lg transition-transform hover:scale-125 hover:bg-line ${
                    mine ? "bg-brand/20" : ""
                  }`}
                >
                  {r.emoji}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {error && <span className="w-full text-xs text-brand-soft" role="alert">{error}</span>}
    </div>
  );
}
