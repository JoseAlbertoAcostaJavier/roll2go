import { describe, expect, it } from "vitest";
import { CONDITION_RULES, exhaustionEffect } from "@/lib/rules/dnd2024/sheet/conditions";
import type { Dnd2024SheetV2 } from "@/lib/rules/dnd2024/sheet/sheet";
import { applyStatus, CONDITION_KEYS, statusOf } from "@/lib/rules/dnd2024/sheet/status";

// Solo importan los campos de estado: el resto de la hoja no se toca
const base = { version: 2 } as unknown as Dnd2024SheetV2;
const withStatus = (extra: Partial<Dnd2024SheetV2> = {}): Dnd2024SheetV2 => ({ ...base, ...extra });
const ok = (r: ReturnType<typeof applyStatus>) => {
  if (!r.ok) throw new Error(r.error);
  return r.sheet;
};
const errorOf = (r: ReturnType<typeof applyStatus>) => (r.ok ? null : r.error);

describe("statusOf", () => {
  it("una hoja antigua no tiene inspiración, estados ni agotamiento", () => {
    expect(statusOf(base)).toEqual({ heroicInspiration: false, conditions: [], exhaustion: 0 });
  });
  it("devuelve lo guardado", () => {
    const s = withStatus({ heroicInspiration: true, conditions: ["prone"], exhaustion: 2 });
    expect(statusOf(s)).toEqual({ heroicInspiration: true, conditions: ["prone"], exhaustion: 2 });
  });
});

describe("CONDITION_KEYS", () => {
  it("son los 14 estados de 2024, en el orden de CONDITION_NAMES, sin agotamiento ni enfermedad", () => {
    expect(CONDITION_KEYS).toEqual([
      "blinded", "charmed", "deafened", "frightened", "grappled", "incapacitated", "invisible",
      "paralyzed", "petrified", "poisoned", "prone", "restrained", "stunned", "unconscious",
    ]);
  });
  it("cada estado tiene su resumen", () => {
    for (const key of CONDITION_KEYS) expect(CONDITION_RULES[key]?.length).toBeGreaterThan(10);
  });
});

describe("inspiración", () => {
  it("se marca y se desmarca", () => {
    const on = ok(applyStatus(base, { op: "inspiration", value: true }));
    expect(statusOf(on).heroicInspiration).toBe(true);
    expect(statusOf(ok(applyStatus(on, { op: "inspiration", value: false }))).heroicInspiration).toBe(false);
  });
  it("rechaza un valor que no es booleano", () => {
    expect(errorOf(applyStatus(base, { op: "inspiration", value: "si" }))).toBe("Petición no válida.");
  });
});

describe("estados", () => {
  it("añadir uno que ya está no lo repite", () => {
    const once = ok(applyStatus(base, { op: "condition", key: "poisoned", active: true }));
    const twice = ok(applyStatus(once, { op: "condition", key: "poisoned", active: true }));
    expect(statusOf(twice).conditions).toEqual(["poisoned"]);
  });
  it("se guardan en el orden de CONDITION_NAMES", () => {
    const a = ok(applyStatus(base, { op: "condition", key: "prone", active: true }));
    const b = ok(applyStatus(a, { op: "condition", key: "blinded", active: true }));
    expect(statusOf(b).conditions).toEqual(["blinded", "prone"]);
  });
  it("quitar uno activo lo quita; quitar uno que no está no cambia nada", () => {
    const s = withStatus({ conditions: ["blinded", "prone"] });
    expect(statusOf(ok(applyStatus(s, { op: "condition", key: "blinded", active: false }))).conditions).toEqual(["prone"]);
    expect(statusOf(ok(applyStatus(s, { op: "condition", key: "stunned", active: false }))).conditions).toEqual(["blinded", "prone"]);
  });
  it("rechaza estados desconocidos y el agotamiento", () => {
    for (const key of ["zzz", "exhaustion", "disease"])
      expect(errorOf(applyStatus(base, { op: "condition", key, active: true }))).toBe("Estado desconocido.");
  });
  it("rechaza un active que no es booleano", () => {
    expect(errorOf(applyStatus(base, { op: "condition", key: "prone", active: 1 }))).toBe("Petición no válida.");
  });
});

describe("agotamiento", () => {
  it("fija el nivel", () => {
    expect(statusOf(ok(applyStatus(base, { op: "exhaustion", level: 3 }))).exhaustion).toBe(3);
  });
  it("rechaza lo que sale de 0 a 6", () => {
    for (const level of [-1, 7, 2.5])
      expect(errorOf(applyStatus(base, { op: "exhaustion", level }))).toBe("El agotamiento va de 0 a 6.");
  });
});

describe("operación no válida", () => {
  it("rechaza lo que no es una operación de estado", () => {
    expect(errorOf(applyStatus(base, null))).toBe("Petición no válida.");
    expect(errorOf(applyStatus(base, { op: "nada" }))).toBe("Petición no válida.");
  });
});

describe("exhaustionEffect", () => {
  it("resta 2 por nivel a las pruebas y 1,5 m por nivel a la velocidad", () => {
    expect(exhaustionEffect(2)).toBe("Nivel 2: −4 a las pruebas de d20 y −3 m de velocidad");
    expect(exhaustionEffect(1)).toBe("Nivel 1: −2 a las pruebas de d20 y −1,5 m de velocidad");
  });
  it("el nivel 6 es la muerte", () => {
    expect(exhaustionEffect(6)).toBe("Muerte");
  });
});
