import { describe, expect, test } from "vitest";
import { ACTION_ICONS, actionIcon } from "@/lib/rules/dnd2024/sheet/actionIcons";

describe("actionIcon", () => {
  test("Correr usa dash", () => {
    expect(actionIcon("action:dash|xphb")).toMatch(/\/dark\/actions\/dash\.svg$/);
  });
  test("Estudiar usa search", () => {
    expect(actionIcon("action:study|xphb")).toMatch(/\/dark\/actions\/search\.svg$/);
  });
  test("Usar, Magia e Influir", () => {
    expect(actionIcon("action:utilize|xphb")).toMatch(/quick-interaction\.svg$/);
    expect(actionIcon("action:magic|xphb")).toMatch(/cast-spell\.svg$/);
    expect(actionIcon("action:influence|xphb")).toMatch(/communicate\.svg$/);
  });
  test("una clave desconocida no tiene icono", () => {
    expect(actionIcon("action:nope|xphb")).toBeNull();
  });
  test("todas las acciones del mapa tienen archivo", () => {
    for (const key of Object.keys(ACTION_ICONS)) expect(actionIcon(key), key).not.toBeNull();
  });
});
