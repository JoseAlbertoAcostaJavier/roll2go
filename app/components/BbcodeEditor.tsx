"use client";

import { useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Bold, CircleHelp, Image as ImageIcon, Italic, Link as LinkIcon, List, ListOrdered, Video } from "lucide-react";
import Bbcode from "@/app/components/Bbcode";

type Action = "bold" | "italic" | "list" | "ordered-list" | "link" | "image" | "video";
type Tool = { label: string; shortcut?: string; icon: LucideIcon; action: Action };

const TOOLS: Tool[] = [
  { label: "Negrita", shortcut: "B", icon: Bold, action: "bold" },
  { label: "Cursiva", shortcut: "I", icon: Italic, action: "italic" },
  { label: "Lista", icon: List, action: "list" },
  { label: "Lista numerada", icon: ListOrdered, action: "ordered-list" },
  { label: "Enlace", shortcut: "K", icon: LinkIcon, action: "link" },
  { label: "Imagen", icon: ImageIcon, action: "image" },
  { label: "Vídeo (YouTube, Twitch, Vimeo o DailyMotion)", icon: Video, action: "video" },
];

const GUIDE = [
  ["[b]texto[/b]", "Negrita (Ctrl+B)"],
  ["[i]texto[/i]", "Cursiva (Ctrl+I)"],
  ["[url=https://…]texto[/url]", "Enlace (Ctrl+K)"],
  ["[img]https://…[/img]", "Imagen"],
  ["[video]https://youtube.com/watch?v=…[/video]", "Vídeo de YouTube, Twitch, Vimeo o Dailymotion"],
  ["[list][*] uno [*] dos [/list]", "Lista"],
  ["[list=1][*] uno [*] dos [/list]", "Lista numerada"],
] as const;

/* Editor de texto con botones y atajos de teclado que insertan etiquetas BBCode, y vista previa. */
export default function BbcodeEditor({
  id,
  value,
  onChange,
  maxLength = 100000,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [help, setHelp] = useState(false);

  // Sustituye el texto seleccionado por lo que devuelva "make"
  function replaceSelection(make: (selected: string) => string) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const insert = make(value.slice(s, e));
    el.focus();
    // execCommand mantiene el historial de deshacer (Ctrl+Z). Si el navegador no lo admite, se cambia el valor a mano.
    if (!document.execCommand("insertText", false, insert)) {
      onChange(value.slice(0, s) + insert + value.slice(e));
      requestAnimationFrame(() => el.setSelectionRange(s + insert.length, s + insert.length));
    }
  }
  const wrap = (open: string, close: string, placeholder: string) =>
    replaceSelection((sel) => `${open}${sel || placeholder}${close}`);
  const list = (ordered: boolean) =>
    replaceSelection((sel) => {
      const items = (sel || "elemento").split("\n").map((l) => `[*] ${l}`).join("\n");
      return `${ordered ? "[list=1]" : "[list]"}\n${items}\n[/list]`;
    });

  function runTool(action: Action) {
    switch (action) {
      case "bold": return wrap("[b]", "[/b]", "texto");
      case "italic": return wrap("[i]", "[/i]", "texto");
      case "list": return list(false);
      case "ordered-list": return list(true);
      case "link": return wrap("[url=https://]", "[/url]", "texto del enlace");
      case "image": return wrap("[img]", "[/img]", "https://");
      case "video": return wrap("[video]", "[/video]", "https://www.youtube.com/watch?v=");
    }
  }

  // Atajos: Ctrl (o Cmd en Mac) + B, I o K
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    const tool = TOOLS.find((t) => t.shortcut?.toLowerCase() === e.key.toLowerCase());
    if (!tool) return;
    e.preventDefault();
    runTool(tool.action);
  }

  const tabClass = (active: boolean) =>
    `rounded-t-md px-3 py-1.5 text-sm font-semibold transition-colors ${
      active ? "bg-surface text-white" : "text-muted hover:text-white"
    }`;

  return (
    <div>
      <div className="flex items-end justify-between gap-2 border-b border-line">
        <div className="flex gap-1">
          <button type="button" onClick={() => setTab("edit")} className={tabClass(tab === "edit")}>
            Escribir
          </button>
          <button type="button" onClick={() => setTab("preview")} className={tabClass(tab === "preview")}>
            Vista previa
          </button>
        </div>
        <div className="flex flex-wrap gap-1 pb-1">
          {TOOLS.map(({ label, shortcut, icon: Icon, action }) => {
            const title = shortcut ? `${label} (Ctrl+${shortcut})` : label;
            return (
              <button
                key={action}
                type="button"
                // Evita que el botón le quite el foco (y la selección) al cuadro de texto
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => runTool(action)}
                disabled={tab === "preview"}
                aria-label={title}
                title={title}
                className="flex h-8 w-8 items-center justify-center rounded text-muted transition-colors enabled:hover:bg-line enabled:hover:text-white disabled:opacity-40"
              >
                <Icon size={16} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>

      {tab === "edit" ? (
        <textarea
          id={id}
          ref={ref}
          value={value}
          maxLength={maxLength}
          rows={12}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          className="w-full rounded-b-md border border-t-0 border-line bg-surface px-3 py-2.5 font-mono text-sm text-fg placeholder:text-muted focus:border-brand focus:outline-none"
        />
      ) : (
        <div className="min-h-64 rounded-b-md border border-t-0 border-line bg-surface p-3 text-sm">
          {value.trim() ? <Bbcode source={value} /> : <p className="text-muted">No hay nada que mostrar.</p>}
        </div>
      )}

      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>Los vídeos solo admiten YouTube, Twitch, Vimeo y DailyMotion.</span>
        <button
          type="button"
          onClick={() => setHelp((h) => !h)}
          aria-expanded={help}
          className="flex items-center gap-1 text-brand-soft hover:underline"
        >
          <CircleHelp size={14} aria-hidden="true" /> Guía de Formato
        </button>
      </div>

      {help && (
        <dl className="mt-2 grid gap-x-4 gap-y-2 rounded-md border border-line bg-surface p-4 text-sm sm:grid-cols-[auto_1fr]">
          {GUIDE.map(([code, desc]) => (
            <div key={code} className="contents">
              <dt className="break-all font-mono text-xs text-brand-soft">{code}</dt>
              <dd className="text-muted">{desc}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}