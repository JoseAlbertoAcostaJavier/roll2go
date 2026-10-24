import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const CAMPAIGN = "c00000000000000000000001";
const created = vi.hoisted(() => [] as Record<string, unknown>[]);

vi.mock("@/lib/campaignApi", () => ({ sessionOf: async () => ({ id: "a00000000000000000000003" }) }));
vi.mock("@/lib/rateLimit", () => ({
  rateLimit: async () => ({ ok: true }),
  tooManyRequests: () => new Response(null, { status: 429 }),
}));
vi.mock("@/lib/mongodb", () => ({ connectDB: async () => {} }));
vi.mock("@/lib/Campaign", () => ({
  Campaign: {
    findOne: () => ({
      select: () => ({
        lean: async () => ({
          _id: "c00000000000000000000001",
          owner: "a00000000000000000000002",
          systemId: "dnd-2024",
          restrictBooks: false,
          characters: { allowed: true, internal: true, external: true },
        }),
      }),
    }),
  },
}));
vi.mock("@/lib/CampaignImage", () => ({ CampaignImage: { deleteMany: async () => {} } }));
vi.mock("@/lib/Character", () => ({
  Character: { create: async (doc: Record<string, unknown>) => (created.push(doc), { _id: "b00000000000000000000001" }) },
}));
vi.mock("@/lib/notify", () => ({ notify: async () => {} }));
vi.mock("@/lib/rules/catalog", () => ({
  NotFoundError: class extends Error {},
  listEntries: async () => [],
  resolveRef: async () => null,
  usableBooks: async () => ["libro"],
}));
vi.mock("@/lib/rules/dnd2024/validate", () => ({
  validateSheet: async () => ({ ok: true, sheet: { version: 2, alignment: "" } }),
}));

const { POST } = await import("@/app/api/characters/route");

describe("POST /api/characters", () => {
  it("creado desde la campaña: queda aprobado en ella", async () => {
    const form = new FormData();
    form.set("system", "dnd-2024");
    form.set("name", "Prueba");
    form.set("status", "active");
    form.set("pronouns", "");
    form.set("campaign", CAMPAIGN);
    form.set("sheet", "{}");
    const res = await POST(new NextRequest("http://localhost/api/characters", { method: "POST", body: form }));
    expect(res.status).toBe(201);
    expect(created[0]).toMatchObject({ campaign: CAMPAIGN, origin: "internal", campaignStatus: "approved" });
  });
});
