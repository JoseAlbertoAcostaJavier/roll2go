import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import { derive } from "@/lib/rules/dnd2024/derive";
import { FEATURE_COLUMNS } from "@/lib/rules/dnd2024/derive/features";
import type { Choice, Dnd2024Sheet, Dnd2024SheetV2, InventoryItem, LevelEntry } from "@/lib/rules/dnd2024/sheet";
import { upgradeSheet } from "@/lib/rules/dnd2024/upgrade";
import { B, buildCatalog as build, ref } from "./fixtureCatalog";

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

// Hoja v2 del mismo personaje; `more` añade niveles de Bárbaro (2, 3…) con sus elecciones
const v2 = (entries = build(), ...more: Choice[][]): Dnd2024SheetV2 => {
  let i = 0;
  const s = upgradeSheet(sheet(), entries, () => `id${++i}`);
  more.forEach((choices, j) => s.levels.push({
    n: j + 2, class: s.levels[0].class, classLevel: j + 2, hp: { method: "average", value: 7 }, choices,
  } satisfies LevelEntry));
  return s;
};
const line = (key: string, name: string, quantity = 1, equipped = false): InventoryItem =>
  ({ id: key, ref: ref(key), name, quantity, equipped, notes: "" });

describe("derive", () => {
  const d = derive(sheet(), build());

  it("características, competencia, PG, CA e iniciativa", () => {
    expect(d.abilities.wis.score).toBe(12);
    expect(d.abilities.int.score).toBe(13);
    expect(d.abilities.str.mod).toBe(2);
    expect(d.proficiencyBonus).toBe(2);
    expect(d.hp).toEqual({ max: 13, current: 13, temp: 0 });
    expect(d.ac).toBe(13);
    expect(d.initiative).toBe(2);
    expect(d.level).toBe(1);
    expect(d.classes).toEqual([{ name: "Bárbaro", level: 1, subclass: null, ref: ref("class:barbarian|xphb") }]);
  });
  it("velocidad y visión en la oscuridad del legado", () => {
    expect(d.speed).toBe(30);
    expect(d.darkvision).toBe(120);
  });
  it("salvaciones: las 6, con competencia en las de la clase", () => {
    expect(d.saves).toHaveLength(6);
    expect(d.saves.filter((s) => s.proficient).map((s) => s.ability)).toEqual(["str", "con"]);
    expect(d.saves.find((s) => s.ability === "str")?.total).toBe(4);
    expect(d.saves.find((s) => s.ability === "dex")?.total).toBe(2);
  });
  it("habilidades: las 18, con competencia de especie, trasfondo y clase", () => {
    expect(d.skills).toHaveLength(18);
    expect(d.skills.filter((s) => s.proficiency === 1).map((s) => s.id).sort())
      .toEqual(["athletics", "insight", "intimidation", "perception", "religion"]);
    expect(d.skills.find((s) => s.id === "athletics")).toEqual({ id: "athletics", ability: "str", proficiency: 1, total: 4 });
    expect(d.skills.find((s) => s.id === "stealth")).toEqual({ id: "stealth", ability: "dex", proficiency: 0, total: 2 });
  });
  it("pericia: competencia 2 y bonificador doble", () => {
    const r = derive(v2(build(), [{ type: "expertise", source: "x", value: ["athletics"] }]), build());
    expect(r.skills.find((s) => s.id === "athletics")).toMatchObject({ proficiency: 2, total: 2 + 4 });
  });
  it("otras competencias e idiomas", () => {
    expect(d.armor).toEqual(["light", "medium", "shield"]);
    expect(d.weapons).toEqual(["simple", "martial"]);
    expect(d.tools).toEqual(["calligrapher's supplies"]);
    const s = sheet();
    s.languages = "Común, Élfico\nInfracomún";
    expect(derive(s, build()).languages).toEqual(["Común", "Élfico", "Infracomún"]);
    expect(d.languages).toEqual([]);
  });

  it("con la especie borrada anota el nombre guardado y calcula el resto", () => {
    const entries = build();
    entries.delete(`${B}:species:elf|xphb`);
    const r = derive(sheet(), entries);
    expect(r.missing).toContain("Elfo");
    expect(r.hp.max).toBe(13);
    expect(r.ac).toBe(13);
    expect(r.speed).toBe(30);
    expect(r.darkvision).toBe(120);
  });
  it("con la clase borrada no rompe", () => {
    const entries = build();
    entries.delete(`${B}:class:barbarian|xphb`);
    const r = derive(sheet(), entries);
    expect(r.missing).toContain("Bárbaro");
    expect(r.hp.max).toBe(1); // sin dado de golpe conocido, solo la CON
    expect(r.ac).toBe(13); // la Defensa sin armadura sale de la clave guardada
    expect(r.attacks.map((a) => a.name)).toEqual(["Ataque sin armas"]);
  });
  it("una hoja v2 con la clase borrada conserva los PG guardados", () => {
    const s = v2(build(), []);
    const entries = build();
    entries.delete(`${B}:class:barbarian|xphb`);
    expect(derive(s, entries).hp.max).toBe(12 + 7 + 2 * 1);
  });

  describe("niveles", () => {
    it("nivel total, nivel por clase y PG por entrada", () => {
      const r = derive(v2(build(), [], [], []), build());
      expect(r.level).toBe(4);
      expect(r.classes[0].level).toBe(4);
      expect(r.proficiencyBonus).toBe(2);
      expect(r.hp.max).toBe(12 + 7 * 3 + 4 * 1);
      expect(derive(v2(build(), [], [], [], []), build()).proficiencyBonus).toBe(3);
    });
    it("mejora de característica suma con tope 20", () => {
      const asi = (value: Extract<Choice, { type: "asi" }>["value"]): Choice[] => [{ type: "asi", source: "x", value }];
      const r = derive(v2(build(), [], [], asi({ abilities: { str: 2 } })), build());
      expect(r.abilities.str.score).toBe(17);
      const s = v2(build(), [], [], asi({ abilities: { str: 2, wis: 1 } }));
      s.baseAbilities.str = 19;
      expect(derive(s, build()).abilities.str.score).toBe(20);
      expect(derive(s, build()).abilities.wis.score).toBe(13);
    });
    it("PG actuales y temporales guardados", () => {
      const s = v2();
      s.hp = { max: null, current: 5, temp: 3 };
      expect(derive(s, build()).hp).toEqual({ max: 13, current: 5, temp: 3 });
    });
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
      expect(derive(s, build()).hp.max).toBe(14);
      const s3 = v2(build(), [], []);
      s3.species = s.species;
      s3.lineage = null;
      // 12 + 7 + 7 + 3 × CON 1, más 3 de Dureza enana
      expect(derive(s3, build()).hp.max).toBe(32);
    });
    it("Duro: +2 PG por nivel", () => {
      expect(derive(sheet(), withFeat("feat:tough|xphb")).hp.max).toBe(15);
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
    it("solo cuenta la armadura equipada", () => {
      const s = v2();
      s.inventory.items.push(line("item:chain mail|xphb", "Cota de malla"));
      expect(derive(s, build()).ac).toBe(13);
      s.inventory.items.at(-1)!.equipped = true;
      expect(derive(s, build()).ac).toBe(16);
    });
    it("aviso sin competencia con la armadura equipada", () => {
      const s = v2();
      s.inventory.items.push(line("item:chain mail|xphb", "Cota de malla", 1, true));
      expect(derive(s, build()).armorWarning).toBe("Sin competencia con esta armadura");
      s.inventory.items.at(-1)!.equipped = false;
      s.inventory.items.push(line("item:studded leather armor|xphb", "Cuero tachonado", 1, true));
      expect(derive(s, build()).armorWarning).toBeNull();
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

  describe("ataques", () => {
    it("una fila por arma equipada y el ataque sin armas siempre", () => {
      expect(d.attacks.map((a) => a.name)).toEqual(["Greataxe", "Handaxe", "Ataque sin armas"]);
      expect(d.attacks[0]).toMatchObject({ bonus: 4, damage: "1d12+2", damageType: "cortante", mastery: null });
      expect(d.attacks[2]).toMatchObject({ bonus: 4, damage: "3", damageType: "contundente" });
      const s = v2();
      for (const i of s.inventory.items) i.equipped = false;
      expect(derive(s, build()).attacks.map((a) => a.name)).toEqual(["Ataque sin armas"]);
    });
    it("maestría con las armas de weaponMasteries (las actuales, no las elegidas al subir)", () => {
      const s = v2(build(), [{ type: "weaponMastery", source: "x", value: [ref("item:handaxe|xphb")] }]);
      s.weaponMasteries = [ref("item:greataxe|xphb")];
      const r = derive(s, build());
      expect(r.attacks[0].mastery).toBe("Hendir");
      expect(r.attacks[1].mastery).toBeNull();
    });
    it("hoja guardada sin weaponMasteries: las elegidas al subir de nivel", () => {
      const s = v2(build(), [{ type: "weaponMastery", source: "x", value: [ref("item:greataxe|xphb")] }]);
      delete (s as { weaponMasteries?: unknown }).weaponMasteries;
      expect(derive(s, build()).attacks[0].mastery).toBe("Hendir");
    });
    it("Monje: dado de Artes marciales de la tabla y la mejor de FUE y DES", () => {
      const entries = build();
      const barb = entries.get(`${B}:class:barbarian|xphb`)!;
      const monk = { ...barb, ref: ref("class:monk|xphb"), data: { ...(barb.data as object), equipment: { A: [] } } };
      entries.set(`${B}:class:monk|xphb`, monk);
      const s = sheet();
      s.classes[0].ref = ref("class:monk|xphb");
      s.baseAbilities.dex = 16;
      const unarmed = (r: ReturnType<typeof derive>) => r.attacks.find((a) => a.name === "Ataque sin armas")!;
      // Sin tabla en el catálogo: 1d6 a nivel 1
      expect(unarmed(derive(s, entries))).toMatchObject({ bonus: 5, damage: "1d6+3" });
      const values = ["1d6", "1d6", "1d6", "1d6", "1d8", ...Array(15).fill("1d10")];
      entries.set(`${B}:class:monk|xphb`, { ...monk, data: { ...monk.data, table: { columns: [{ label: "Artes marciales", values }] } } });
      expect(unarmed(derive(s, entries)).damage).toBe("1d6+3");
      const s5 = upgradeSheet(s, entries, () => "x");
      for (let n = 2; n <= 5; n++) s5.levels.push({ ...s5.levels[0], n, classLevel: n, choices: [] });
      expect(unarmed(derive(s5, entries)).damage).toBe("1d8+3");
    });
  });

  describe("Monje con armas", () => {
    // Monje de nivel 5 (Artes marciales 1d8) con FUE 15 y DES 16, una lanza y una espada corta
    const monkCase = () => {
      const entries = build();
      const barb = entries.get(`${B}:class:barbarian|xphb`)!;
      entries.set(`${B}:class:monk|xphb`, {
        ...barb, ref: ref("class:monk|xphb"),
        data: { ...(barb.data as object), weapons: ["simple", "Martial weapons that have the Light property"], equipment: { A: [] } },
      });
      const axe = entries.get(`${B}:item:handaxe|xphb`)!;
      const item = (key: string, name: string, weapon: object) =>
        entries.set(`${B}:${key}`, { ...axe, ref: ref(key), name, data: { ...(axe.data as object), weapon } });
      item("item:spear|xphb", "Spear", { damage: "1d6", damageType: "P", properties: ["T", "V"], mastery: "sap", category: "simple" });
      item("item:shortsword|xphb", "Shortsword", { damage: "1d6", damageType: "P", properties: ["F", "L"], mastery: "vex", category: "martial" });
      item("item:longsword|xphb", "Longsword", { damage: "1d8", damageType: "S", properties: ["V"], mastery: "sap", category: "martial" });
      const s = sheet();
      s.classes[0].ref = ref("class:monk|xphb");
      s.baseAbilities.dex = 16;
      const s5 = upgradeSheet(s, entries, () => "x");
      for (let n = 2; n <= 5; n++) s5.levels.push({ ...s5.levels[0], n, classLevel: n, choices: [] });
      s5.inventory.items = [
        line("item:spear|xphb", "Lanza", 1, true), line("item:shortsword|xphb", "Espada corta", 1, true),
        line("item:longsword|xphb", "Espada larga", 1, true),
      ];
      return { s5, entries };
    };
    const attack = (r: ReturnType<typeof derive>, name: string) => r.attacks.find((a) => a.name === name)!;

    it("con un arma de monje usa DES y el dado de Artes marciales si es mayor", () => {
      const { s5, entries } = monkCase();
      const r = derive(s5, entries);
      // DES 16 (+3) frente a FUE 15 (+2); competencia +3 a nivel 5
      expect(attack(r, "Lanza")).toMatchObject({ bonus: 6, damage: "1d8+3 / 1d8+3 (dos manos)" });
      expect(attack(r, "Espada corta")).toMatchObject({ bonus: 6, damage: "1d8+3" });
      // La espada larga no es arma de monje ni tiene competencia
      expect(attack(r, "Espada larga")).toMatchObject({ bonus: 2, damage: "1d8+2 / 1d10+2 (dos manos)" });
      expect(attack(r, "Ataque sin armas").damage).toBe("1d8+3");
    });
    it("con escudo o armadura no se aplican las Artes marciales", () => {
      const { s5, entries } = monkCase();
      s5.inventory.items.push(line("item:shield|xphb", "Escudo", 1, true));
      const r = derive(s5, entries);
      expect(attack(r, "Lanza")).toMatchObject({ bonus: 5, damage: "1d6+2 / 1d8+2 (dos manos)" });
      expect(attack(r, "Ataque sin armas")).toMatchObject({ bonus: 5, damage: "3" });
      s5.inventory.items.at(-1)!.ref = ref("item:studded leather armor|xphb");
      expect(attack(derive(s5, entries), "Lanza").damage).toBe("1d6+2 / 1d8+2 (dos manos)");
    });
  });

  describe("peso y capacidad", () => {
    const withPack = (entries: Map<string, CatalogEntry>) => {
      const s = v2(entries);
      s.inventory.items = [line("item:explorer's pack|xphb", "Paquete de explorador"), line("item:greataxe|xphb", "Hacha", 1, true)];
      return s;
    };
    it("suma el peso de cada línea por su cantidad", () => {
      expect(derive(withPack(build()), build()).weight).toEqual({ total: 55 + 7, capacity: 225, over: false });
      const s = withPack(build());
      s.inventory.items[1].quantity = 2;
      expect(derive(s, build()).weight.total).toBe(55 + 14);
    });
    it("capacidad FUE × 15, doble si es Grande; aviso al superarla", () => {
      const s = withPack(build());
      s.speciesChoices.size = "L";
      expect(derive(s, build()).weight.capacity).toBe(450);
      s.speciesChoices.size = null;
      s.baseAbilities.str = 4;
      expect(derive(s, build()).weight).toEqual({ total: 62, capacity: 60, over: true });
    });
  });

  describe("rasgos", () => {
    it("bloques de especie, legado, clase y dotes", () => {
      expect(d.features.map((g) => [g.source, g.title])).toEqual([
        ["species", "Elfo"], ["lineage", "Drow"], ["class", "Bárbaro"], ["feat", "Dotes"],
      ]);
      const cls = d.features[2];
      expect(cls.level).toBe(1);
      expect(cls.features.map((f) => f.name)).toEqual(["Rage", "Unarmored Defense", "Weapon Mastery"]);
      expect(d.features[3].features).toEqual([
        { ref: ref("feat:magic initiate; cleric|xphb"), name: "Magic Initiate; Cleric", level: 1 },
      ]);
    });
    it("rasgos de clase hasta su nivel y de la subclase elegida", () => {
      const berserker = { ref: ref("subclass:path of the berserker|barbarian|xphb"), name: "Senda del berserker" };
      const r = derive(v2(build(), [], [{ type: "subclass", source: "x", value: berserker }]), build());
      const cls = r.features.find((g) => g.source === "class")!;
      expect(cls.features.map((f) => f.level)).toEqual([1, 1, 1, 2, 2, 3, 3]);
      // Sin la entrada del rasgo en el catálogo, el nombre sale de la clave
      expect(cls.features[3].name).toBe("Danger sense");
      const sub = r.features.find((g) => g.source === "subclass")!;
      expect(sub).toMatchObject({ title: "Senda del berserker", level: 3, ref: berserker.ref });
      expect(sub.features.every((f) => f.level <= 3)).toBe(true);
      expect(r.classes[0].subclass).toBe("Senda del berserker");
    });
  });

  describe("multiclase y elecciones de nivel", () => {
    const entries = build(["class-barbarian.json", "class-cleric.json", "class-fighter.json"]);
    const feat = (key: string, data: object, name: string) =>
      entries.set(`${B}:${key}`, { ...entries.get(`${B}:item:greataxe|xphb`)!, ref: ref(key), name, nameEs: null, data });
    feat("feat:great weapon master|xphb", { category: "general", repeatable: false, abilityIncrease: ["str"] }, "Great Weapon Master");
    feat("feat:boon of combat prowess|xphb", { category: "epicBoon", repeatable: false, abilityIncrease: ["str"] }, "Boon of Combat Prowess");
    feat("feat:archery|xphb", { category: "fightingStyle", repeatable: false }, "Archery");
    feat("feat:defense|xphb", { category: "fightingStyle", repeatable: false }, "Defense");
    const named = (key: string) => ({ ref: ref(key), name: entries.get(`${B}:${key}`)?.name ?? key });

    // Bárbaro 1 de la hoja de prueba y después `[clase, niveles]`; `choices` por nivel total
    const multi = (more: [string, number][], choices: Record<number, Choice[]> = {}) => {
      const s = v2(entries);
      const perClass = new Map<string, number>([["barbarian", 1]]);
      for (const [name, count] of more) {
        for (let i = 0; i < count; i++) {
          const classLevel = (perClass.get(name) ?? 0) + 1;
          perClass.set(name, classLevel);
          const n = s.levels.length + 1;
          s.levels.push({
            n, class: named(`class:${name}|xphb`), classLevel, hp: { method: "average", value: 5 }, choices: choices[n] ?? [],
          });
        }
      }
      return s;
    };

    it("Bárbaro 4 con mejora +2 FUE: FUE sube 2", () => {
      const r = derive(multi([["barbarian", 3]], { 4: [{ type: "asi", source: "x", value: { abilities: { str: 2 } } }] }), entries);
      expect(r.abilities.str.score).toBe(17);
    });
    it("Bárbaro 3 + Clérigo 1: competencia por nivel total, salvaciones solo de la primera clase y competencias de multiclase", () => {
      const r = derive(multi([["barbarian", 2], ["cleric", 1]]), entries);
      expect(r.level).toBe(4);
      expect(r.proficiencyBonus).toBe(2);
      expect(r.classes.map((c) => [c.name, c.level])).toEqual([["Bárbaro", 3], ["Cleric", 1]]);
      expect(r.saves.filter((s) => s.proficient).map((s) => s.ability)).toEqual(["str", "con"]);
      expect(r.armor).toEqual(["light", "medium", "shield"]);
      expect(r.weapons).toEqual(["simple", "martial"]);
      expect(derive(multi([["barbarian", 3], ["cleric", 1]]), entries).proficiencyBonus).toBe(3);
    });
    it("habilidades de multiclase y pericia de las elecciones", () => {
      const r = derive(multi([["barbarian", 1]], {
        2: [{ type: "skills", source: "multiclass:x", value: ["stealth"] }, { type: "expertise", source: "y", value: ["stealth"] }],
      }), entries);
      expect(r.skills.find((s) => s.id === "stealth")).toMatchObject({ proficiency: 2, total: 2 + 4 });
    });
    it("el rasgo Furia muestra el valor de la tabla de su nivel", () => {
      const rage = (r: ReturnType<typeof derive>) =>
        r.features.find((g) => g.source === "class")!.features.find((f) => f.ref.key.startsWith("classFeature:rage|"));
      expect(rage(derive(multi([]), entries))?.value).toBe("2");
      expect(rage(derive(multi([["barbarian", 2]]), entries))?.value).toBe("3");
    });
    it("Ataque adicional no se acumula: solo aparece en la primera clase que lo da", () => {
      const r = derive(multi([["barbarian", 4], ["fighter", 5]]), entries);
      const extra = r.features.filter((g) => g.source === "class")
        .map((g) => g.features.filter((f) => f.ref.key.startsWith("classFeature:extra attack|")).length);
      expect(extra).toEqual([1, 0]);
    });
    it("dotes de nivel: suben su característica (tope 20; dones épicos hasta 30) y aparecen en los rasgos", () => {
      const gwm: Choice = { type: "asi", source: "x", value: { feat: named("feat:great weapon master|xphb"), ability: "str" } };
      const s = multi([["barbarian", 3]], { 4: [gwm] });
      const r = derive(s, entries);
      expect(r.abilities.str.score).toBe(16);
      expect(r.features.find((g) => g.source === "feat")!.features.map((f) => [f.name, f.level]))
        .toContainEqual(["Great Weapon Master", 4]);
      s.baseAbilities.str = 20;
      expect(derive(s, entries).abilities.str.score).toBe(20);
      const boon: Choice = { type: "feat", source: "y", value: [{ ...named("feat:boon of combat prowess|xphb"), ability: "str" }] };
      s.levels[1].choices = [boon];
      expect(derive(s, entries).abilities.str.score).toBe(21);
    });
    it("Ataque adicional de una subclase no se acumula con el de una clase", () => {
      const sub = "subclass:college of valor|bard|xphb";
      const valorAttack = "subclassFeature:extra attack|bard|xphb|valor|xphb|6";
      entries.set(`${B}:${sub}`, {
        ...entries.get(`${B}:item:greataxe|xphb`)!, ref: ref(sub), name: "College of Valor", nameEs: null,
        data: { features: [{ ref: ref(valorAttack), level: 6 }], spells: [], progressions: { feats: [], optionalFeatures: [] } },
      });
      // Bárbaro 5 (Ataque adicional) y después Bardo 6 del Colegio del valor
      entries.set(`${B}:class:bard|xphb`, { ...entries.get(`${B}:class:cleric|xphb`)!, ref: ref("class:bard|xphb"), name: "Bard" });
      const s = multi([["barbarian", 4], ["bard", 6]], { 8: [{ type: "subclass", source: "class:subclass", value: named(sub) }] });
      const count = (r: ReturnType<typeof derive>) => r.features.filter((g) => g.source === "class" || g.source === "subclass")
        .map((g) => [g.source, g.features.filter((f) => /^[^:]*:extra attack\|/.test(f.ref.key)).length]);
      expect(count(derive(s, entries))).toEqual([["class", 1], ["class", 0], ["subclass", 0]]);
      // Al revés (Bardo del valor primero), el de la subclase es el que se muestra
      const t = v2(entries);
      t.levels = [];
      for (let n = 1; n <= 6; n++) {
        t.levels.push({
          n, class: named("class:bard|xphb"), classLevel: n, hp: { method: "average", value: 5 },
          choices: n === 3 ? [{ type: "subclass", source: "class:subclass", value: named(sub) }] : [],
        });
      }
      for (let k = 1; k <= 5; k++) {
        t.levels.push({ n: 6 + k, class: named("class:barbarian|xphb"), classLevel: k, hp: { method: "average", value: 7 }, choices: [] });
      }
      expect(count(derive(t, entries))).toEqual([["class", 0], ["subclass", 1], ["class", 0]]);
    });
    it("una dote elegida, sustituida y vuelta a elegir aparece una vez, con el último nivel", () => {
      const s = multi([["fighter", 3]], {
        2: [{ type: "feat", source: "fs", value: [named("feat:archery|xphb")] }],
        3: [{ type: "feat", source: "fs", value: [named("feat:defense|xphb")], replaced: [named("feat:archery|xphb")] }],
        // (copias nuevas, no los mismos objetos)
        4: [{ type: "feat", source: "fs", value: [named("feat:archery|xphb")], replaced: [named("feat:defense|xphb")] }],
      });
      const feats = derive(s, entries).features.find((g) => g.source === "feat")!.features;
      expect(feats.filter((f) => f.name !== "Magic Initiate; Cleric").map((f) => [f.name, f.level])).toEqual([["Archery", 4]]);
    });
    it("Guerrero 3 Maestro de batalla: Combat Superiority, maniobras elegidas y opciones de rasgo en los rasgos", () => {
      const bm = "subclass:battle master|fighter|xphb";
      const MV = "progression:maneuvers|battle master|fighter|xphb";
      const s = multi([["fighter", 4]], {
        // Nivel total 4 = Guerrero 3; 5 = Guerrero 4 sustituye una maniobra
        4: [
          { type: "subclass", source: "class:subclass", value: named(bm) },
          { type: "optionalFeature", source: MV, value: ["ambush", "parry", "rally"].map((k) => named(`optionalFeature:${k}|xphb`)) },
        ],
        5: [{
          type: "optionalFeature", source: MV, value: [named("optionalFeature:riposte|xphb")],
          replaced: [named("optionalFeature:parry|xphb")],
        }],
        // Opción escrita a mano (sin entrada de catálogo): se muestra con su nombre en español junto a su rasgo
        2: [{
          type: "featureOption", source: "subclassFeature:combat superiority|fighter|xphb|battle master|xphb|3",
          value: { ref: { book: "builtin", key: "option:hunters-prey:horde-breaker" }, name: "x" },
        }],
      });
      const r = derive(s, entries);
      const sub = r.features.find((g) => g.source === "subclass")!;
      const superiority = sub.features.find((f) => f.ref.key.startsWith("subclassFeature:combat superiority|"));
      expect(superiority).toMatchObject({ level: 3, chosen: ["Rompehordas"] });
      const maneuvers = r.features.find((g) => g.source === "option")!;
      expect(maneuvers.title).toBe("Maniobras");
      expect(maneuvers.features.map((f) => [f.ref.key, f.level])).toEqual([
        ["optionalFeature:ambush|xphb", 4], ["optionalFeature:rally|xphb", 4], ["optionalFeature:riposte|xphb", 5],
      ]);
      // Van detrás de las clases y antes de las dotes
      expect(r.features.map((g) => g.source).slice(-2)).toEqual(["option", "feat"]);
    });
    it("una dote sustituida deja de aparecer", () => {
      const s = multi([["fighter", 2]], {
        2: [{ type: "feat", source: "fs", value: [named("feat:archery|xphb")] }],
        3: [{ type: "feat", source: "fs", value: [named("feat:defense|xphb")], replaced: [named("feat:archery|xphb")] }],
      });
      const feats = derive(s, entries).features.find((g) => g.source === "feat")!.features.map((f) => f.name);
      expect(feats).toContain("Defense");
      expect(feats).not.toContain("Archery");
    });
  });

  describe("valores de la tabla de clase", () => {
    const entries = build(["class-rogue.json", "class-monk.json", "class-barbarian.json"]);
    const columns = (cls: string) =>
      (entries.get(`${B}:class:${cls}|xphb`)!.data as { table: { columns: { label: string }[] } }).table.columns.map((c) => c.label);
    it("las columnas de FEATURE_COLUMNS coinciden con las del importador (Ataque furtivo, Artes marciales, Furias)", () => {
      expect(columns("rogue")).toContain(FEATURE_COLUMNS["sneak attack"]);
      expect(columns("monk")).toContain(FEATURE_COLUMNS["martial arts"]);
      expect(columns("monk")).toContain(FEATURE_COLUMNS["unarmored movement"]);
      expect(columns("barbarian")).toContain(FEATURE_COLUMNS.rage);
    });
    it("Ataque furtivo y Artes marciales muestran el valor de su nivel", () => {
      const s = v2(entries);
      const level = (cls: string) => {
        const t = structuredClone(s);
        t.levels = [1, 2, 3].map((n) => ({
          n, class: { ref: ref(`class:${cls}|xphb`), name: cls }, classLevel: n, hp: { method: "average" as const, value: 5 }, choices: [],
        }));
        return derive(t, entries).features.find((g) => g.source === "class")!.features;
      };
      expect(level("rogue").find((f) => f.ref.key.startsWith("classFeature:sneak attack|"))?.value).toBe("2d6");
      expect(level("monk").find((f) => f.ref.key.startsWith("classFeature:martial arts|"))?.value).toBe("1d6");
    });
  });
});
