import { describe, expect, it } from "vitest";
import type { FeatureGroup } from "@/lib/rules/dnd2024/derive/features";
import {
  BACKGROUND_SECTION_CHIPS, FEATURE_SECTION_CHIPS, featureSections, parseSection, sectionHref,
} from "@/lib/rules/dnd2024/sheet/sheetSections";

const group = (source: FeatureGroup["source"], title: string): FeatureGroup => ({ title, source, ref: null, features: [] });
const species = group("species", "Elfo");
const cls = group("class", "Mago");
const subclass = group("subclass", "Escuela de evocación");
const option = group("option", "Invocaciones sobrenaturales");
const feat = group("feat", "Dotes");
const lineage = group("lineage", "Alto elfo");
const groups: FeatureGroup[] = [species, cls, subclass, option, feat, lineage];

describe("featureSections", () => {
  it("con Todo, las secciones con algo en orden fijo, conservando el orden de los grupos", () => {
    const s = featureSections(groups, "todo");
    expect(s.map((x) => x.id)).toEqual(["clase", "especie", "dotes"]);
    expect(s.map((x) => x.title)).toEqual(["Rasgos de clase", "Rasgos de especie", "Dotes"]);
    expect(s[0].groups).toEqual([cls, subclass, option]);
    expect(s[1].groups).toEqual([species, lineage]);
    expect(s[2].groups).toEqual([feat]);
  });
  it("con una sección, solo esa", () => {
    expect(featureSections(groups, "especie").map((x) => x.id)).toEqual(["especie"]);
    expect(featureSections(groups, "especie")[0].groups).toEqual([species, lineage]);
    expect(featureSections(groups, "clase")[0].groups).toEqual([cls, subclass, option]);
  });
  it("sin dotes, no hay sección de dotes", () => {
    const sinDotes = groups.filter((g) => g.source !== "feat");
    expect(featureSections(sinDotes, "todo").map((x) => x.id)).toEqual(["clase", "especie"]);
    expect(featureSections(sinDotes, "dotes")).toEqual([]);
  });
});

describe("chips", () => {
  it("rasgos y trasfondo", () => {
    expect(FEATURE_SECTION_CHIPS.map((c) => c.label)).toEqual(["Todo", "Rasgos de clase", "Rasgos de especie", "Dotes"]);
    expect(BACKGROUND_SECTION_CHIPS.map((c) => c.label)).toEqual(["Todo", "Trasfondo", "Características", "Aspecto"]);
  });
});

describe("parseSection", () => {
  const ids = ["todo", "clase", "especie", "dotes"] as const;
  it("acepta los ids conocidos", () => {
    expect(parseSection("dotes", ids)).toBe("dotes");
  });
  it("desconocido o ausente → todo", () => {
    expect(parseSection("x", ids)).toBe("todo");
    expect(parseSection(undefined, ids)).toBe("todo");
  });
  it("con varios valores, el primero", () => {
    expect(parseSection(["dotes", "clase"], ids)).toBe("dotes");
    expect(parseSection(["x", "clase"], ids)).toBe("todo");
  });
});

describe("sectionHref", () => {
  it("con Todo omite seccion, quita saved y spell y conserva el resto", () => {
    expect(sectionHref({ tab: "rasgos", seccion: "clase", saved: "1" }, "todo")).toBe("?tab=rasgos");
    expect(sectionHref({ tab: "rasgos", spell: "x", foo: "1" }, "clase")).toBe("?tab=rasgos&foo=1&seccion=clase");
  });
  it("fija la sección y reemplaza la anterior", () => {
    expect(sectionHref({ tab: "trasfondo", seccion: "aspecto" }, "caracteristicas")).toBe("?tab=trasfondo&seccion=caracteristicas");
  });
});
