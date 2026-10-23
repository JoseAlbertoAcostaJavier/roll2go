import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { CatalogEntry } from "@/lib/rules/catalog";
import { derive } from "@/lib/rules/dnd2024/derive";
import type { Dnd2024Sheet } from "@/lib/rules/dnd2024/sheet";
import { BOOK_PLACEHOLDER, normalizeAll, type RawFiles } from "@/lib/rules/import/normalize";

const fixture = (f: string) =>
  JSON.parse(readFileSync(path.join(import.meta.dirname, "../fixtures/5etools", f), "utf8"));
const files: RawFiles = {
  races: fixture("races.json"),
  backgrounds: fixture("backgrounds.json"),
  feats: fixture("feats.json"),
  items: fixture("items.json"),
  itemsBase: fixture("items-base.json"),
  spells: [fixture("spells.json")],
  spellSources: fixture("spell-sources.json"),
  classes: [fixture("class-barbarian.json")],
};

const B = "libro-prueba";
// Como el importador: sustituye el marcador de libro por el id del libro
const withBook = <T,>(v: T): T =>
  JSON.parse(JSON.stringify(v).replaceAll(JSON.stringify(BOOK_PLACEHOLDER), JSON.stringify(B)));
const toEntry = (e: ReturnType<typeof normalizeAll>["entries"][number]): CatalogEntry => ({
  ref: { book: B, key: e.key }, name: e.name, nameEs: null, bookName: "Libro", srd52: e.srd52,
  data: withBook(e.data), description: e.description, descriptionEs: "", identifier: e.identifier,
  parent: e.parent ? { book: B, key: e.parent.key } : null, foundry: null,
});
const build = () => new Map(normalizeAll(files, "XPHB").entries.map((e) => {
  const c = toEntry(e);
  return [`${B}:${c.ref.key}`, c] as const;
}));
const ref = (key: string) => ({ book: B, key });

const sheet = (): Dnd2024Sheet => ({
  version: 1,
  species: { ref: ref("species:elf|xphb"), name: "Elfo" },
  lineage: { ref: ref("lineage:drow|xphb"), name: "Drow" },
  background: { ref: ref("background:acolyte|xphb"), name: "Acólito", abilities: { wis: 2, int: 1 }, equipment: "A" },
  classes: [{
    ref: ref("class:barbarian|xphb"), name: "Bárbaro", level: 1, subclass: null,
    skills: ["athletics", "intimidation"], equipment: "A",
  }],
  abilityMethod: "standard",
  baseAbilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
  rolls: null,
  speciesChoices: { skills: ["perception"], size: null },
  alignment: "", appearance: "", age: "", languages: "", notes: "", xp: 0,
  hp: { max: null, current: null, temp: 0 },
});

describe("derive", () => {
  const d = derive(sheet(), build());

  it("características, competencia, PG, CA e iniciativa", () => {
    expect(d.abilities.wis.score).toBe(12);
    expect(d.abilities.int.score).toBe(13);
    expect(d.abilities.str.mod).toBe(2);
    expect(d.proficiencyBonus).toBe(2);
    expect(d.hpMax).toBe(13);
    expect(d.ac).toBe(13);
    expect(d.initiative).toBe(2);
  });
  it("velocidad y visión en la oscuridad del legado", () => {
    expect(d.speed).toBe(30);
    expect(d.darkvision).toBe(120);
  });
  it("competencias", () => {
    expect(d.saves).toEqual(["str", "con"]);
    expect(d.skills).toEqual(expect.arrayContaining(["insight", "religion", "perception", "athletics", "intimidation"]));
    expect(d.armor).toEqual(["light", "medium", "shield"]);
    expect(d.weapons).toEqual(["simple", "martial"]);
    expect(d.tools).toEqual(["calligrapher's supplies"]);
  });
  it("equipo y oro de clase y trasfondo, con el paquete expandido", () => {
    expect(d.gold).toBe(23);
    const names = d.equipment.map((e) => e.name);
    expect(names).toEqual(expect.arrayContaining(["Greataxe", "Handaxe", "Book (Prayers)", "backpack", "torch"]));
    expect(names).not.toContain("Explorer's Pack");
    expect(d.equipment.find((e) => e.name === "Handaxe")?.quantity).toBe(4);
    expect(d.equipment.find((e) => e.name === "torch")?.quantity).toBe(10);
  });
  it("la opción B da solo oro", () => {
    const s = sheet();
    s.classes[0].equipment = "B";
    s.background.equipment = "B";
    const r = derive(s, build());
    expect(r.gold).toBe(125);
    expect(r.equipment).toEqual([]);
  });

  it("con la especie borrada anota el nombre guardado y calcula el resto", () => {
    const entries = build();
    entries.delete(`${B}:species:elf|xphb`);
    const r = derive(sheet(), entries);
    expect(r.missing).toContain("Elfo");
    expect(r.hpMax).toBe(13);
    expect(r.ac).toBe(13);
    expect(r.speed).toBe(30);
    expect(r.darkvision).toBe(120);
  });
  it("con la clase borrada no rompe", () => {
    const entries = build();
    entries.delete(`${B}:class:barbarian|xphb`);
    const r = derive(sheet(), entries);
    expect(r.missing).toContain("Bárbaro");
    expect(r.hpMax).toBe(0);
    expect(r.ac).toBe(13); // la Defensa sin armadura sale de la clave guardada
    expect(r.gold).toBe(8);
  });

  describe("rasgos de especie y dote de origen", () => {
    // Cambia la dote de origen del Acólito
    const withFeat = (key: string) => {
      const entries = build();
      const bg = entries.get(`${B}:background:acolyte|xphb`)!;
      entries.set(`${B}:background:acolyte|xphb`, { ...bg, data: { ...(bg.data as object), feat: ref(key) } });
      return entries;
    };
    it("Dureza enana: +1 PG por nivel", () => {
      const s = sheet();
      s.species = { ref: ref("species:dwarf|xphb"), name: "Enano" };
      s.lineage = null;
      expect(derive(s, build()).hpMax).toBe(14);
      s.classes[0].level = 3;
      // 12 + 1 + 2 × (7 + 1) = 29, más 3 de Dureza enana
      expect(derive(s, build()).hpMax).toBe(32);
    });
    it("Duro: +2 PG por nivel", () => {
      expect(derive(sheet(), withFeat("feat:tough|xphb")).hpMax).toBe(15);
    });
    it("Alerta suma el bonificador de competencia a la iniciativa", () => {
      expect(derive(sheet(), withFeat("feat:alert|xphb")).initiative).toBe(4);
      expect(derive(sheet(), build()).initiative).toBe(2);
    });
  });

  describe("armadura", () => {
    const withGear = (...keys: string[]) => {
      const entries = build();
      const barbarian = entries.get(`${B}:class:barbarian|xphb`)!;
      const data = barbarian.data as { equipment: Record<string, unknown[]> };
      data.equipment.A = keys.map((key) => ({ ref: ref(key) }));
      return entries;
    };
    it("armadura pesada: ignora DES y la Defensa sin armadura", () => {
      expect(derive(sheet(), withGear("item:chain mail|xphb")).ac).toBe(16);
    });
    it("el escudo suma 2 con armadura y sin ella", () => {
      expect(derive(sheet(), withGear("item:chain mail|xphb", "item:shield|xphb")).ac).toBe(18);
      expect(derive(sheet(), withGear("item:shield|xphb")).ac).toBe(15);
    });
    it("armadura ligera suma DES completo", () => {
      expect(derive(sheet(), withGear("item:studded leather armor|xphb")).ac).toBe(14);
    });
    it("el Monje usa SAB y una clase sin Defensa usa solo DES", () => {
      const entries = build();
      const barb = entries.get(`${B}:class:barbarian|xphb`)!;
      const clone = (key: string) => ({ ...barb, ref: ref(key), data: { ...(barb.data as object), equipment: { A: [] } } });
      entries.set(`${B}:class:monk|xphb`, clone("class:monk|xphb"));
      entries.set(`${B}:class:fighter|xphb`, clone("class:fighter|xphb"));
      const s = sheet();
      s.classes[0].ref = ref("class:monk|xphb");
      expect(derive(s, entries).ac).toBe(10 + 2 + 1);
      s.classes[0].ref = ref("class:fighter|xphb");
      expect(derive(s, entries).ac).toBe(12);
    });
    it("con escudo, la Defensa sin armadura del Monje no se aplica y la del Bárbaro sí", () => {
      const entries = withGear("item:shield|xphb");
      const barb = entries.get(`${B}:class:barbarian|xphb`)!;
      entries.set(`${B}:class:monk|xphb`, { ...barb, ref: ref("class:monk|xphb") });
      const s = sheet();
      expect(derive(s, entries).ac).toBe(10 + 2 + 1 + 2);
      s.classes[0].ref = ref("class:monk|xphb");
      expect(derive(s, entries).ac).toBe(10 + 2 + 2);
    });
  });
});
