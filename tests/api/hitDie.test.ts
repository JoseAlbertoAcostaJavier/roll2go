import { beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { verifyHitDie } from "@/lib/rules/dnd2024/rolls";

// Sesión, acceso al personaje y límite de peticiones falsos: la ruta no toca la base de datos
vi.mock("@/lib/server/campaigns/campaignApi", () => ({ sessionOf: async () => ({ id: "u1" }) }));
vi.mock("@/lib/utils/rateLimit", () => ({
  rateLimit: async () => ({ ok: true }),
  tooManyRequests: () => new Response(null, { status: 429 }),
}));
vi.mock("@/lib/server/characters/characterAccess", () => ({
  loadCharacterFor: async (_user: string, id: string) => (id === "c1" ? { sheet: { levels: [{}, {}, {}] } } : null),
}));

const { POST } = await import("@/app/api/dice/hit-die/route");

beforeAll(() => {
  process.env.AUTH_SECRET = "secreto-de-prueba";
});

const roll = async (body: unknown) => {
  const res = await POST(new NextRequest("http://localhost/api/dice/hit-die", { method: "POST", body: JSON.stringify(body) }));
  return { status: res.status, json: await res.json() };
};

describe("POST /api/dice/hit-die", () => {
  it("repetir la tirada devuelve el mismo valor, con un token válido para el nivel siguiente", async () => {
    const a = await roll({ characterId: "c1", die: 10 });
    const b = await roll({ characterId: "c1", die: 10 });
    expect(a.status).toBe(200);
    expect(b.json.value).toBe(a.json.value);
    expect(a.json.value).toBeGreaterThanOrEqual(1);
    expect(a.json.value).toBeLessThanOrEqual(10);
    expect(verifyHitDie("u1", { characterId: "c1", n: 4, die: 10, value: a.json.value }, a.json.token)).toBe(true);
  });
  it("dado no válido → 400; personaje ajeno → 404", async () => {
    expect((await roll({ characterId: "c1", die: 7 })).status).toBe(400);
    expect((await roll({ characterId: "otro", die: 10 })).status).toBe(404);
  });
});
