import { describe, expect, it } from "vitest";
import { blankForm, isUntouched, parseDraft } from "@/app/components/characters/creator/CharacterCreator";

const props = { species: [], lineages: {}, levelOneSubclasses: {}, classes: [], backgrounds: [], languages: [], choiceItems: [] } as unknown as Parameters<typeof parseDraft>[1];

describe("parseDraft", () => {
  it("un borrador antiguo con `prepared` se lee sin fallar y el formulario ya no lo tiene", () => {
    const raw = JSON.stringify({
      name: "Ana", prepared: ["xphb:spell:bless|xphb"],
      method: "roll", rolls: { values: [15, 14, 13, 12, 10, 8], token: "1.abc" },
    });
    const form = parseDraft(raw, props);
    expect(form.name).toBe("Ana");
    expect(form.method).toBe("roll");
    expect(form.rolls).toMatchObject({ values: [15, 14, 13, 12, 10, 8], token: "1.abc" });
    expect(form).not.toHaveProperty("prepared");
  });
});

describe("parseDraft: objetos a elegir e idiomas", () => {
  const opt = (key: string, data: unknown = null) => ({
    ref: { book: "b", key }, name: key, nameEs: null, bookName: "", srd52: true, data,
  });
  const equipment = {
    A: [{ displayName: "Un juego (a elegir)", choose: { kinds: ["gaming"], label: "Un juego (a elegir)" } }],
    B: [{ value: 5000 }],
  };
  const full = {
    species: [], lineages: {}, levelOneSubclasses: {},
    classes: [opt("class:rogue|xphb", { equipment })],
    backgrounds: [opt("background:soldier|xphb", { equipment })],
    languages: [opt("language:elvish|xphb", { type: "standard" }), opt("language:dwarvish|xphb", { type: "standard" }), opt("language:celestial|xphb", { type: "rare" })],
    choiceItems: [opt("item:dice set|xphb", { type: "GS" })],
  } as unknown as Parameters<typeof parseDraft>[1];
  const r = (key: string) => ({ book: "b", key });

  it("un borrador antiguo (idiomas de texto, sin picks) se abre y conserva el texto", () => {
    const form = parseDraft(JSON.stringify({ name: "Ana", languages: "Élfico", klass: r("class:rogue|xphb") }), full);
    expect(form.languages).toBe("Élfico");
    expect(form.bgEquipmentPicks).toEqual({});
    expect(form.classEquipmentPicks).toEqual({});
    expect(form.languageChoices).toEqual([null, null, null]);
  });
  it("recupera los picks de la opción elegida y los idiomas, y descarta lo que ya no vale", () => {
    const form = parseDraft(JSON.stringify({
      background: r("background:soldier|xphb"), bgEquipment: "A",
      bgEquipmentPicks: { "0": r("item:dice set|xphb"), "3": r("item:dice set|xphb") },
      klass: r("class:rogue|xphb"), classEquipment: "B", classEquipmentPicks: { "0": r("item:dice set|xphb") },
      languageChoices: [r("language:elvish|xphb"), r("language:nope|xphb"), r("language:dwarvish|xphb"), r("language:elvish|xphb")],
    }), full);
    expect(form.bgEquipmentPicks).toEqual({ "0": r("item:dice set|xphb") });
    expect(form.classEquipmentPicks).toEqual({});
    expect(form.languageChoices).toEqual([r("language:elvish|xphb"), null, r("language:dwarvish|xphb")]);
  });
});

describe("isUntouched: borrador vacío", () => {
  it("el formulario recién abierto y el de un borrador ausente o corrupto no cuentan como datos", () => {
    expect(isUntouched(parseDraft(null, props), blankForm())).toBe(true);
    expect(isUntouched(parseDraft("{no es json", props), blankForm())).toBe(true);
  });

  it("un cambio del usuario (nombre, método, tiradas) sí cuenta, y volver al inicio deja de contar", () => {
    const base = blankForm();
    expect(isUntouched({ ...base, name: "Ana" }, base)).toBe(false);
    expect(isUntouched({ ...base, method: "manual" }, base)).toBe(false);
    expect(isUntouched({ ...base, base: { ...base.base, str: 9 } }, base)).toBe(false);
    expect(isUntouched({ ...base, name: "" }, base)).toBe(true);
  });

  it("un borrador con datos se recupera y no es el formulario vacío", () => {
    const form = parseDraft(JSON.stringify({ name: "Ana" }), props);
    expect(form.name).toBe("Ana");
    expect(isUntouched(form, blankForm())).toBe(false);
  });
});
