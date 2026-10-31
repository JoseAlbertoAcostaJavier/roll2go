export type BbNode =
  | { type: "text"; text: string }
  | { type: "el"; tag: string; arg?: string; children: BbNode[] }
  // Referencia a una regla: [ref=tipo:clave]texto[/ref]
  | { type: "ref"; target: string; children: BbNode[] };

// Etiquetas admitidas: [b] [i] [url] [img] [video] [ref] [list] y [*] (elemento de lista)
const TOKEN = /\[(\/?)(b|i|url|img|video|ref|list|\*)(?:=([^\]\n]*))?\]/gi;

// Convierte el texto BBCode en un árbol. Etiquetas sin cerrar se cierran solas, y las desconocidas se dejan como texto.
export function parseBbcode(src: string): BbNode[] {
  const root: BbNode[] = [];
  const stack: { tag: string; arg?: string; children: BbNode[] }[] = [];

  const add = (node: BbNode) =>
    (stack.length ? stack[stack.length - 1].children : root).push(node);
  const closeTop = () => {
    const open = stack.pop()!;
    add(
      open.tag === "ref"
        ? { type: "ref", target: open.arg ?? "", children: open.children }
        : { type: "el", tag: open.tag, arg: open.arg, children: open.children },
    );
  };
  const closeTo = (i: number) => {
    while (stack.length > i) closeTop();
  };
  const lastIndex = (tag: string) => {
    for (let i = stack.length - 1; i >= 0; i--)
      if (stack[i].tag === tag) return i;
    return -1;
  };

  let last = 0;
  for (const m of src.matchAll(TOKEN)) {
    const start = m.index ?? 0;
    if (start > last) add({ type: "text", text: src.slice(last, start) });
    last = start + m[0].length;

    const closing = m[1] === "/";
    const tag = m[2].toLowerCase();
    const arg = m[3];

    if (closing) {
      const i = tag === "*" ? -1 : lastIndex(tag);
      if (i === -1)
        add({ type: "text", text: m[0] }); // cierre sin apertura: se muestra tal cual
      else closeTo(i);
    } else if (tag === "*") {
      const list = lastIndex("list");
      if (list === -1) {
        add({ type: "text", text: m[0] }); // [*] fuera de una lista
        continue;
      }
      const item = lastIndex("*");
      if (item > list) closeTo(item); // un [*] nuevo cierra el anterior
      stack.push({ tag: "*", children: [] });
    } else {
      stack.push({ tag, arg, children: [] });
    }
  }
  if (last < src.length) add({ type: "text", text: src.slice(last) });
  closeTo(0);
  return root;
}

export const plainText = (nodes: BbNode[]): string =>
  nodes
    .map((n) => (n.type === "text" ? n.text : plainText(n.children)))
    .join("");

// Devuelve la URL normalizada solo si usa uno de los protocolos permitidos
export function safeUrl(
  raw: string,
  protocols: string[] = ["http:", "https:"],
) {
  try {
    const u = new URL(raw.trim());
    return protocols.includes(u.protocol) ? u.toString() : null;
  } catch {
    return null;
  }
}

// Solo se incrustan vídeos de YouTube, Vimeo, Dailymotion y Twitch
export function videoEmbedUrl(raw: string) {
  const url = safeUrl(raw); //[cite: 1]
  if (!url) return null; //[cite: 1]
  const u = new URL(url); //[cite: 1]
  const host = u.hostname.replace(/^www\./, ""); //[cite: 1]

  // YouTube
  let id: string | null | undefined; //[cite: 1]
  if (host === "youtu.be") id = u.pathname.slice(1); //[cite: 1]
  else if (host === "youtube.com" || host === "m.youtube.com") { //[cite: 1]
    id =
      u.pathname === "/watch" //[cite: 1]
        ? u.searchParams.get("v") //[cite: 1]
        : u.pathname.match(/^\/(?:embed|shorts)\/([\w-]{11})/)?.[1]; //[cite: 1]
  }
  if (id && /^[\w-]{11}$/.test(id)) //[cite: 1]
    return `https://www.youtube-nocookie.com/embed/${id}`; //[cite: 1]

  // Vimeo
  if (host === "vimeo.com") { //[cite: 1]
    const vid = u.pathname.match(/^\/(\d+)/)?.[1]; //[cite: 1]
    if (vid) return `https://player.vimeo.com/video/${vid}`; //[cite: 1]
  }

  // Dailymotion
  if (host === "dai.ly") {
    const vid = u.pathname.slice(1);
    if (vid) return `https://www.dailymotion.com/embed/video/${vid}`;
  }
  if (host === "dailymotion.com") {
    const vid = u.pathname.match(/^\/video\/([a-zA-Z0-9]+)/)?.[1];
    if (vid) return `https://www.dailymotion.com/embed/video/${vid}`;
  }

  // Twitch
  if (host === "clips.twitch.tv") {
    const clip = u.pathname.slice(1);
    if (clip) return `https://clips.twitch.tv/embed?clip=${clip}&parent=localhost`;
  }
  if (host === "twitch.tv") {
    // Clips con formato twitch.tv/usuario/clip/ID_DEL_CLIP
    const clipMatch = u.pathname.match(/^\/[a-zA-Z0-9_]+\/clip\/([a-zA-Z0-9_-]+)/);
    if (clipMatch) return `https://clips.twitch.tv/embed?clip=${clipMatch[1]}&parent=localhost`;

    // Vídeos bajo demanda (VODs)
    const videoMatch = u.pathname.match(/^\/videos\/(\d+)/);
    if (videoMatch) return `https://player.twitch.tv/?video=${videoMatch[1]}&parent=localhost`;

    // Canales en directo (ej: twitch.tv/ibai)
    const channelMatch = u.pathname.match(/^\/([a-zA-Z0-9_]+)$/);
    if (channelMatch && !['videos', 'directory', 'downloads'].includes(channelMatch[1])) {
      return `https://player.twitch.tv/?channel=${channelMatch[1]}&parent=localhost`;
    }
  }

  return null; //[cite: 1]
}

// Texto plano sin etiquetas ni multimedia (para pasárselo al asistente de IA)
export function bbcodeToText(src: string): string {
  const walk = (nodes: BbNode[]): string =>
    nodes
      .map((n) => {
        if (n.type === "text") return n.text;
        if (n.type === "ref") return walk(n.children);
        if (n.tag === "img" || n.tag === "video") return "";
        if (n.tag === "*") return `\n- ${walk(n.children).trim()}`;
        return walk(n.children);
      })
      .join("");
  return walk(parseBbcode(src))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
