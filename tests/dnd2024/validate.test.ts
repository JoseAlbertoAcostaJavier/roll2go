import { beforeAll, describe, expect, it } from "vitest";
import type { CatalogEntry } from "@/lib/rules/catalog";
import { validateSheet } from "@/lib/rules/dnd2024/validate";
import { signRolls } from "@/lib/rules/dnd2024/rolls";
import type { Ref } from "@/lib/rules/types";

beforeAll(() => {
  process.env.AUTH_SECRET = "secreto-de-prueba";
});

type Sheet = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const B = "b1";
const entry = (key: string, data: unknown, extra: Partial<CatalogEntry> = {}): CatalogEntry => ({
  ref: { book: B, key }, name: key, nameEs: null, bookName: "Libro", srd52: true, data,
  description: "", descriptionEs: "", identifier: "", parent: null, foundry: null, ...extra,
});
const catalog = new Map<string, CatalogEntry>(
  [
    entry("species:elf|xphb", { size: ["M"], hasLineages: true, skills: { fixed: [] } }, { name: "Elf", nameEs: "Elfo" }),
    entry("species:dwarf|xphb", {
      size: ["M"], hasLineages: false, skills: { fixed: ["Perception"] },
    }),
    // Tiene legados, pero ninguno en los libros utilizables
    entry("species:gnome|xphb", { size: ["S"], hasLineages: true, skills: { fixed: [] } }),
    entry("species:human|xphb", {
      size: ["M", "S"], hasLineages: false, skills: { fixed: [], choose: { count: 1, from: ["Perception", "Insight"] } },
    }),
    entry("lineage:drow|xphb", {}, { parent: { book: B, key: "species:elf|xphb" } }),
    entry("lineage:other|xphb", {}, { parent: { book: B, key: "species:dwarf|xphb" } }),
    entry("background:acolyte|xphb", {
      abilities: ["int", "wis", "cha"], skills: ["Insight", "Religion"], equipment: { A: [], B: [] },
    }),
    entry("class:fighter|xphb", {
      skills: { count: 2, from: ["Acrobatics", "Athletics", "Insight", "Perception"] },
      equipment: { A: [], B: [], C: [] }, subclassLevel: 3,
    }, { name: "Fighter", nameEs: "Guerrero" }),
  ].map((e) => [e.ref.key, e]),
);
const ctx = {
  userId: "u1",
  books: [B],
  resolve: async (r: Ref) => (r.book === B ? (catalog.get(r.key) ?? null) : null),
  hasLineages: async (species: Ref) =>
    [...catalog.values()].some((e) => e.ref.key.startsWith("lineage:") && e.parent?.key === species.key && e.parent.book === species.book),
};
const named = (key: string, book = B) => ({ ref: { book, key }, name: "cliente" });

const valid = (): Sheet => ({
  version: 1,
  species: named("species:elf|xphb"),
  lineage: named("lineage:drow|xphb"),
  background: { ...named("background:acolyte|xphb"), abilities: { int: 2, wis: 1 }, equipment: "A" },
  classes: [{
    ...named("class:fighter|xphb"), level: 1, subclass: null, skills: ["Athletics", "Acrobatics"], equipment: "C",
  }],
  abilityMethod: "standard",
  baseAbilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
  rolls: null,
  speciesChoices: { skills: [], size: null },
  alignment: "Neutral", appearance: "", age: "", languages: "", notes: "", xp: 0,
  hp: { max: null, current: null, temp: 0 },
});
const run = (mut: (s: Sheet) => void) => {
  const s = valid();
  mut(s);
  return validateSheet(s, ctx);
};
const errorsOf = async (mut: (s: Sheet) => void) => {
  const r = await run(mut);
  return r.ok ? {} : r.errors;
};

describe("validateSheet", () => {
  it("acepta una hoja válida y toma los nombres del catálogo", async () => {
    const r = await run(() => {});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sheet.species.name).toBe("Elfo");
    expect(r.sheet.classes[0].name).toBe("Guerrero");
    expect(r.sheet.lineage?.name).toBe("lineage:drow|xphb");
    expect(r.sheet.classes[0].equipment).toBe("C");
  });
  it("rechaza lo que no es un objeto", async () => {
    expect((await validateSheet(null, ctx)).ok).toBe(false);
  });
  it("legados", async () => {
    expect(await errorsOf((s) => {
      s.species = named("species:human|xphb");
      s.speciesChoices = { skills: ["Insight"], size: "M" };
    })).toHaveProperty("lineage");
    expect(await errorsOf((s) => { s.lineage = named("lineage:other|xphb"); })).toHaveProperty("lineage");
    expect(await errorsOf((s) => { s.lineage = null; })).toHaveProperty("lineage");
  });
  it("sin legados en los libros utilizables no se exige legado", async () => {
    const r = await run((s) => { s.species = named("species:gnome|xphb"); s.lineage = null; });
    expect(r.ok).toBe(true);
  });
  it("referencias fuera de books, inexistentes o de otro tipo", async () => {
    expect(await errorsOf((s) => { s.species = named("species:elf|xphb", "otro"); })).toHaveProperty("species");
    expect(await errorsOf((s) => { s.species = named("species:nope|xphb"); })).toHaveProperty("species");
    expect(await errorsOf((s) => { s.species = named("class:fighter|xphb"); })).toHaveProperty("species");
  });
  it("elección de habilidades y tamaño de especie", async () => {
    const human = (s: Sheet) => { s.species = named("species:human|xphb"); s.lineage = null; };
    expect(await errorsOf((s) => { human(s); })).toHaveProperty("speciesChoices.skills");
    expect(await errorsOf((s) => { human(s); s.speciesChoices.skills = ["Stealth"]; }))
      .toHaveProperty("speciesChoices.skills");
    expect(await errorsOf((s) => { human(s); s.speciesChoices = { skills: ["Perception"], size: null }; }))
      .toHaveProperty("speciesChoices.size");
    expect((await run((s) => { human(s); s.speciesChoices = { skills: ["Perception"], size: "S" }; })).ok).toBe(true);
    expect(await errorsOf((s) => { s.speciesChoices.skills = ["Insight"]; })).toHaveProperty("speciesChoices.skills");
  });
  it("trasfondo: bonificación, total y equipo", async () => {
    expect(await errorsOf((s) => { s.background.abilities = { str: 2, wis: 1 }; })).toHaveProperty("background.abilities");
    expect(await errorsOf((s) => { s.background.abilities = { int: 3 }; })).toHaveProperty("background.abilities");
    expect(await errorsOf((s) => {
      s.abilityMethod = "manual";
      s.baseAbilities = { str: 10, dex: 10, con: 10, int: 19, wis: 10, cha: 10 };
    })).toHaveProperty("background.abilities");
    expect(await errorsOf((s) => { s.background.equipment = "C"; })).toHaveProperty("background.equipment");
  });
  it("habilidades y equipo de clase", async () => {
    // repite una del trasfondo
    expect(await errorsOf((s) => { s.classes[0].skills = ["Athletics", "Insight"]; })).toHaveProperty("classes.0.skills");
    expect(await errorsOf((s) => { s.classes[0].skills = ["Athletics"]; })).toHaveProperty("classes.0.skills");
    expect(await errorsOf((s) => { s.classes[0].skills = ["Athletics", "Athletics"]; })).toHaveProperty("classes.0.skills");
    expect(await errorsOf((s) => { s.classes[0].skills = ["Athletics", "Stealth"]; })).toHaveProperty("classes.0.skills");
    expect(await errorsOf((s) => { s.classes[0].equipment = "D"; })).toHaveProperty("classes.0.equipment");
  });
  it("las habilidades de clase no repiten las de la especie (fijas o elegidas)", async () => {
    const human = (s: Sheet) => {
      s.species = named("species:human|xphb");
      s.lineage = null;
      s.speciesChoices = { skills: ["Perception"], size: "M" };
    };
    expect(await errorsOf((s) => { human(s); s.classes[0].skills = ["Athletics", "Perception"]; }))
      .toHaveProperty("classes.0.skills");
    expect((await run((s) => { human(s); })).ok).toBe(true);
    const dwarf = (s: Sheet) => { s.species = named("species:dwarf|xphb"); s.lineage = null; };
    expect((await run(dwarf)).ok).toBe(true);
    expect(await errorsOf((s) => { dwarf(s); s.classes[0].skills = ["Athletics", "Perception"]; }))
      .toHaveProperty("classes.0.skills");
  });
  it("la habilidad elegida de especie no repite una del trasfondo", async () => {
    expect(await errorsOf((s) => {
      s.species = named("species:human|xphb");
      s.lineage = null;
      s.speciesChoices = { skills: ["Insight"], size: "M" };
    })).toHaveProperty("speciesChoices.skills");
  });
  it("al crear, los PG deben llegar vacíos", async () => {
    expect((await run((s) => { delete s.hp; })).ok).toBe(true);
    expect(await errorsOf((s) => { s.hp = { max: 10, current: null, temp: 0 }; })).toHaveProperty("hp");
    expect(await errorsOf((s) => { s.hp = { max: null, current: 5, temp: 0 }; })).toHaveProperty("hp");
    expect(await errorsOf((s) => { s.hp = { max: null, current: null, temp: 3 }; })).toHaveProperty("hp");
    expect(await errorsOf((s) => { s.hp = "x"; })).toHaveProperty("hp");
  });
  it("métodos de características", async () => {
    expect(await errorsOf((s) => { s.baseAbilities.str = 14; })).toHaveProperty("baseAbilities");
    const pb = (v: number[]) => (s: Sheet) => {
      s.abilityMethod = "pointBuy";
      s.baseAbilities = { str: v[0], dex: v[1], con: v[2], int: v[3], wis: v[4], cha: v[5] };
    };
    expect((await run(pb([15, 15, 15, 8, 8, 8]))).ok).toBe(true);
    expect(await errorsOf(pb([15, 15, 15, 9, 8, 8]))).toHaveProperty("baseAbilities");
    expect(await errorsOf(pb([16, 8, 8, 8, 8, 8]))).toHaveProperty("baseAbilities");
    expect(await errorsOf(pb([7, 8, 8, 8, 8, 8]))).toHaveProperty("baseAbilities");
    const manual = (n: number) => (s: Sheet) => { s.abilityMethod = "manual"; s.baseAbilities.str = n; };
    expect((await run(manual(20))).ok).toBe(true);
    expect(await errorsOf(manual(21))).toHaveProperty("baseAbilities");
    expect(await errorsOf(manual(2))).toHaveProperty("baseAbilities");
  });
  it("tiradas firmadas", async () => {
    const values = [15, 14, 13, 12, 10, 8];
    const roll = (token: string, vals = values) => (s: Sheet) => {
      s.abilityMethod = "roll";
      s.rolls = { values: vals, token };
    };
    const r = await run(roll(signRolls("u1", values)));
    expect(r.ok && r.sheet.rolls?.values).toEqual(values);
    expect(await errorsOf(roll("x.y"))).toHaveProperty("rolls");
    expect(await errorsOf(roll(signRolls("u2", values)))).toHaveProperty("rolls");
    expect(await errorsOf(roll(signRolls("u1", values, Date.now() - 25 * 3600 * 1000)))).toHaveProperty("rolls");
    // el reparto no usa las tiradas firmadas
    const other = [15, 14, 13, 12, 10, 9];
    expect(await errorsOf(roll(signRolls("u1", other), other))).toHaveProperty("baseAbilities");
    expect(await errorsOf((s) => { s.abilityMethod = "roll"; s.rolls = null; })).toHaveProperty("rolls");
  });
  it("textos y experiencia", async () => {
    expect(await errorsOf((s) => { s.alignment = "x".repeat(41); })).toHaveProperty("alignment");
    expect(await errorsOf((s) => { s.notes = "x".repeat(10001); })).toHaveProperty("notes");
    expect(await errorsOf((s) => { s.xp = 355001; })).toHaveProperty("xp");
    expect(await errorsOf((s) => { s.xp = 1.5; })).toHaveProperty("xp");
    const r = await run((s) => { s.notes = "a\u0000b"; });
    expect(r.ok && r.sheet.notes).toBe("ab");
  });
});
