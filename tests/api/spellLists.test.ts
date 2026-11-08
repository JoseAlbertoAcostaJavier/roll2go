import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Base de datos falsa: tres libros con un conjuro de Mago cada uno (y uno de Clérigo en el primero); el usuario ve A y
// B, y la campaña limita a A. La caché de Next se ejecuta tal cual.
const A = "a00000000000000000000001";
const B = "a00000000000000000000002";
const C = "a00000000000000000000003";
const CAMPAIGN = "c00000000000000000000001";
const spell = (key: string, classes: string[], level = 1) => ({
  key, name: key, nameLower: key, data: {
    level, school: "V", time: "1 acción", range: "18 metros (60 pies)", components: "V, S", duration: "Instantáneo",
    concentration: false, ritual: false, classes, tags: ["Daño de fuego"],
  },
  description: "Una descripción larga.",
});
const SPELLS: Record<string, ReturnType<typeof spell>[]> = {
  [A]: [spell("spell:fire bolt|xphb", ["wizard"], 0), spell("spell:bless|xphb", ["cleric"])],
  [B]: [spell("spell:magic missile|xphb", ["wizard"])],
  [C]: [spell("spell:shield|xphb", ["wizard"])],
};
const db = vi.hoisted(() => ({ reader: true, limited: false }));

vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }));
vi.mock("@/lib/models/mongodb", () => ({ connectDB: async () => {} }));
vi.mock("@/lib/server/campaigns/campaignApi", () => ({ sessionOf: async () => ({ id: "u1" }) }));
vi.mock("@/lib/server/rateLimit", () => ({
  rateLimit: async () => (db.limited ? { ok: false, retryAfter: 60 } : { ok: true }),
  tooManyRequests: () => new Response(null, { status: 429 }),
}));
vi.mock("@/lib/server/catalog/books", () => ({
  visibleBooksOf: async () => [{ id: A }, { id: B }],
}));
vi.mock("@/lib/models/Book", () => ({
  Book: {
    find: (f: { _id: { $in: string[] } }) => ({
      select: () => ({ lean: async () => f._id.$in.map((id) => ({ _id: id, name: `Libro ${id.slice(-1)}` })) }),
    }),
  },
}));
vi.mock("@/lib/models/BookEntry", () => ({
  BookEntry: {
    find: (f: { book: { $in: string[] } }) => ({
      select: () => ({
        sort: () => ({
          lean: async () => f.book.$in
            .flatMap((book) => (SPELLS[book] ?? []).map((s) => ({ ...s, book })))
            .sort((a, b) => (a.nameLower < b.nameLower ? -1 : a.nameLower > b.nameLower ? 1 : 0)),
        }),
      }),
    }),
  },
}));
vi.mock("@/lib/models/Campaign", () => ({
  Campaign: {
    findOne: (f: { _id: string; members: string }) => ({
      select: () => ({
        lean: async () => (f._id === CAMPAIGN && f.members === "u1" ? { restrictBooks: true, allowedBooks: [A] } : null),
      }),
    }),
  },
}));
vi.mock("@/lib/server/characters/characterAccess", () => ({
  loadCharacterFor: async (_user: string, _id: string, mode: string) =>
    (db.reader && mode === "read" ? { books: [B] } : null),
}));

const rules = await import("@/app/api/rules/spells/route");
const character = await import("@/app/api/characters/[id]/spells/list/route");

const keys = (json: { spells: { ref: { key: string } }[] }) => json.spells.map((s) => s.ref.key);

async function getRules(qs: string) {
  const res = await rules.GET(new NextRequest(`http://localhost/api/rules/spells?${qs}`));
  return { status: res.status, json: await res.json().catch(() => null), cache: res.headers.get("cache-control") };
}
async function getCharacter(qs: string) {
  const res = await character.GET(new NextRequest(`http://localhost/api/characters/x/spells/list?${qs}`), {
    params: Promise.resolve({ id: "x" }),
  });
  return { status: res.status, json: await res.json().catch(() => null), cache: res.headers.get("cache-control") };
}

describe("GET /api/rules/spells", () => {
  it("filas ligeras de la lista pedida, de los libros que puede usar el usuario", async () => {
    const { status, json, cache } = await getRules(`system=dnd-2024&list=wizard&books=${A},${B},${C}`);
    expect(status).toBe(200);
    expect(cache).toBe("private, max-age=300");
    expect(keys(json)).toEqual(["spell:fire bolt|xphb", "spell:magic missile|xphb"]);
    expect(json.spells[0]).toEqual({
      ref: { book: A, key: "spell:fire bolt|xphb" }, name: "spell:fire bolt|xphb", nameEs: null, level: 0, school: "V",
      ritual: false, concentration: false, time: "1 acción", range: "18 metros (60 pies)", duration: "Instantáneo",
      classes: ["wizard"], tags: ["Daño de fuego"], summary: "Una descripción larga.",
    });
    // Sin el texto de los componentes (el del material es largo)
    expect(json.spells[0]).not.toHaveProperty("components");
  });

  it("con una campaña que limita los libros, un libro no permitido no aparece", async () => {
    const { json } = await getRules(`system=dnd-2024&list=wizard&books=${A},${B}&campaign=${CAMPAIGN}`);
    expect(keys(json)).toEqual(["spell:fire bolt|xphb"]);
  });

  it("los libros elegidos acotan; `*` son todas las listas", async () => {
    expect(keys((await getRules(`system=dnd-2024&list=wizard&books=${B}`)).json)).toEqual(["spell:magic missile|xphb"]);
    expect(keys((await getRules(`system=dnd-2024&list=*&books=${A}`)).json))
      .toEqual(["spell:bless|xphb", "spell:fire bolt|xphb"]);
  });

  it("con el límite de peticiones agotado → 429", async () => {
    db.limited = true;
    try {
      expect((await getRules("system=dnd-2024&list=wizard")).status).toBe(429);
    } finally {
      db.limited = false;
    }
  });

  it("campaña de la que no es miembro o sin lista → 404 / 400", async () => {
    expect((await getRules(`system=dnd-2024&list=wizard&campaign=c00000000000000000000009`)).status).toBe(404);
    expect((await getRules(`system=dnd-2024`)).status).toBe(400);
  });
});

describe("GET /api/characters/[id]/spells/list", () => {
  beforeEach(() => {
    db.reader = true;
  });

  it("solo los libros del personaje (no los que pida la dirección)", async () => {
    const { status, json, cache } = await getCharacter(`list=wizard&books=${A}`);
    expect(status).toBe(200);
    expect(cache).toBe("private, max-age=300");
    expect(keys(json)).toEqual(["spell:magic missile|xphb"]);
  });

  it("quien no puede leer el personaje → 404", async () => {
    db.reader = false;
    expect((await getCharacter("list=wizard")).status).toBe(404);
  });
});

describe("pendingSpellLists: listas que pide cada paso", async () => {
  const { pendingSpellLists } = await import("@/lib/rules/catalog/spellRows");
  const r = { book: A, key: "x" };
  const base = { source: "s", count: 1, label: "" };

  it("clase con Secretos mágicos, Arcano místico, rasgo y dotes", () => {
    expect(pendingSpellLists({
      ...base, type: "spells",
      spells: { class: r, mode: "levelUp", list: "bard", lists: ["bard", "wizard"], cantrips: 0, spells: 1, maxLevel: 5 },
    })).toEqual(["bard", "wizard"]);
    expect(pendingSpellLists({ ...base, type: "arcanum", arcanum: { level: 6, list: "warlock" } })).toEqual(["warlock"]);
    expect(pendingSpellLists({ ...base, type: "bonusSpells", bonusSpells: { class: r, lists: ["cleric", "druid"], origin: "" } }))
      .toEqual(["cleric", "druid"]);
    // Iniciado en la magia base: las que deja elegir; Pacto del tomo (trucos de cualquier lista): todas
    expect(pendingSpellLists({ ...base, type: "featSpells", featSpells: { feat: r, cantrip: { level: 0 }, lists: ["cleric", "wizard"] } }))
      .toEqual(["cleric", "wizard"]);
    expect(pendingSpellLists({ ...base, type: "featSpells", featSpells: { feat: r, cantrip: { level: 0 }, spell: { level: 1, ritual: true } } }))
      .toEqual(["*"]);
    expect(pendingSpellLists({ ...base, type: "featSpells", featSpells: { feat: r, spell: { level: 1, classes: ["wizard"] } } }))
      .toEqual(["wizard"]);
    expect(pendingSpellLists({ ...base, type: "skills" })).toEqual([]);
  });
});
