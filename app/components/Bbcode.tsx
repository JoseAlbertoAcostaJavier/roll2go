import type { ReactNode } from "react";
import { parseBbcode, plainText, safeUrl, videoEmbedUrl, type BbNode } from "@/lib/bbcode";

// Quita los saltos de línea del principio y del final de un elemento de lista
function trimItem(nodes: BbNode[]): BbNode[] {
  const out = [...nodes];
  const first = out[0];
  if (first?.type === "text") out[0] = { type: "text", text: first.text.replace(/^\s+/, "") };
  const last = out[out.length - 1];
  if (last?.type === "text") out[out.length - 1] = { type: "text", text: last.text.replace(/\s+$/, "") };
  return out;
}

const linkClass = "text-brand-soft underline hover:text-white";

function render(nodes: BbNode[]): ReactNode[] {
  return nodes.map((n, i) => {
    if (n.type === "text") return n.text;

    switch (n.tag) {
      case "b":
        return <strong key={i}>{render(n.children)}</strong>;
      case "i":
        return <em key={i}>{render(n.children)}</em>;

      case "url": {
        const label = plainText(n.children);
        const href = safeUrl(n.arg ?? label, ["http:", "https:", "mailto:"]);
        if (!href) return <span key={i}>{render(n.children)}</span>;
        return (
          <a key={i} href={href} target="_blank" rel="noopener noreferrer nofollow ugc" className={linkClass}>
            {n.arg ? render(n.children) : label}
          </a>
        );
      }

      case "img": {
        const src = safeUrl(plainText(n.children));
        if (!src) return null;
        // eslint-disable-next-line @next/next/no-img-element
        return <img key={i} src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className="my-2 max-h-[32rem] max-w-full rounded-md" />;
      }

      case "video": {
        const raw = plainText(n.children);
        const embed = videoEmbedUrl(raw);
        if (embed) {
          return (
            <div key={i} className="my-2 max-w-2xl">
              <iframe
                src={embed}
                title="Vídeo"
                loading="lazy"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                className="aspect-video w-full rounded-md"
              />
            </div>
          );
        }
        const href = safeUrl(raw);
        return href ? (
          <a key={i} href={href} target="_blank" rel="noopener noreferrer nofollow ugc" className={linkClass}>
            {href}
          </a>
        ) : null;
      }

      case "list": {
        const items = n.children.filter((c) => c.type === "el" && c.tag === "*");
        const Tag = n.arg === "1" ? "ol" : "ul";
        return (
          <Tag key={i} className={`my-2 pl-6 ${n.arg === "1" ? "list-decimal" : "list-disc"}`}>
            {render(items)}
          </Tag>
        );
      }
      case "*":
        return <li key={i}>{render(trimItem(n.children))}</li>;

      default:
        return null;
    }
  });
}

export default function Bbcode({ source, className = "" }: { source: string; className?: string }) {
  return <div className={`whitespace-pre-wrap break-words ${className}`}>{render(parseBbcode(source))}</div>;
}