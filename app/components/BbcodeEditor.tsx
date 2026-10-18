"use client";

import { useRef, useState } from "react";
import { Bold, Image as ImageIcon, Italic, Link as LinkIcon, List, ListOrdered, Video } from "lucide-react";
import Bbcode from "@/app/components/Bbcode";

/* Editor de texto con botones que insertan etiquetas BBCode y una vista previa. */
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

  // Sustituye el texto seleccionado por lo que devuelva "make" y deja el cursor al final
  function replaceSelection(make: (selected: string) => string) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const insert = make(value.slice(s, e));
    onChange(value.slice(0, s) + insert + value.slice(e));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + insert.length, s + insert.length);
    });
  }
  const wrap = (open: string, close: string, placeholder: string) =>
    replaceSelection((sel) => `${open}${sel || placeholder}${close}`);
  const list = (ordered: boolean) =>
    replaceSelection((sel) => {
      const items = (sel || "elemento").split("\n").map((l) => `[*] ${l}`).join("\n");
      return `${ordered ? "[list=1]" : "[list]"}\n${items}\n[/list]`;
    });

function handleToolClick(action: (typeof tools)[number]["action"]) {
  switch (action) {
    case "bold":
      wrap("[b]", "[/b]", "texto");
      break;

    case "italic":
      wrap("[i]", "[/i]", "texto");
      break;

    case "list":
      list(false);
      break;

    case "ordered-list":
      list(true);
      break;

    case "link":
      wrap("[url=https://]", "[/url]", "texto del enlace");
      break;

    case "image":
      wrap("[img]", "[/img]", "https://");
      break;

    case "video":
      wrap(
        "[video]",
        "[/video]",
        "https://www.youtube.com/watch?v="
      );
      break;
  }
}
const tools = [
  { label: "Negrita", icon: Bold, action: "bold" },
  { label: "Cursiva", icon: Italic, action: "italic" },
  { label: "Lista", icon: List, action: "list" },
  { label: "Lista numerada", icon: ListOrdered, action: "ordered-list" },
  { label: "Enlace", icon: LinkIcon, action: "link" },
  { label: "Imagen", icon: ImageIcon, action: "image" },
  { label: "Vídeo (YouTube o Vimeo)", icon: Video, action: "video" },
] as const;

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
        {tools.map(({ label, icon: Icon, action }) => (
        <button
            key={label}
            type="button"
            onClick={() => handleToolClick(action)}
            disabled={tab === "preview"}
            aria-label={label}
            title={label}
            className="flex h-8 w-8 items-center justify-center rounded text-muted transition-colors
             enabled:hover:bg-line enabled:hover:text-white disabled:opacity-40"
        >
            <Icon size={16} aria-hidden="true" />
        </button>
        ))}
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
          className="w-full rounded-b-md border border-t-0 border-line bg-surface px-3 py-2.5 font-mono text-sm text-fg placeholder:text-muted focus:border-brand focus:outline-none"
        />
      ) : (
        <div className="min-h-64 rounded-b-md border border-t-0 border-line bg-surface p-3 text-sm">
          {value.trim() ? <Bbcode source={value} /> : <p className="text-muted">No hay nada que mostrar.</p>}
        </div>
      )}
      <p className="mt-1 text-xs text-muted">
        Etiquetas: [b] [i] [url] [img] [video] [list] [*]. Los vídeos solo admiten YouTube y Vimeo.
      </p>
    </div>
  );
}