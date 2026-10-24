import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const CAMPAIGN = "c00000000000000000000001";
const PLAYER = "a00000000000000000000003";
const calls = vi.hoisted(() => ({ updateMany: [] as unknown[][] }));

vi.mock("@/lib/campaignApi", () => ({
  requireMember: async () => ({
    session: { id: "a00000000000000000000002" },
    campaign: { _id: "c00000000000000000000001", owner: "a00000000000000000000002" },
    isDm: true,
  }),
}));
vi.mock("@/lib/rateLimit", () => ({
  rateLimit: async () => ({ ok: true }),
  tooManyRequests: () => new Response(null, { status: 429 }),
}));
vi.mock("@/lib/Campaign", () => ({ Campaign: { updateOne: async () => ({ modifiedCount: 1 }) } }));
vi.mock("@/lib/Character", () => ({
  Character: { updateMany: async (...args: unknown[]) => (calls.updateMany.push(args), { modifiedCount: 1 }) },
}));
vi.mock("@/lib/CampaignLogEntry", () => ({ CampaignLogEntry: { countDocuments: async () => 0 } }));
vi.mock("@/lib/notify", () => ({ notify: async () => {} }));

const { DELETE } = await import("@/app/api/campaigns/[id]/members/[userId]/route");

describe("DELETE /api/campaigns/[id]/members/[userId]", () => {
  it("saca de la campaña sus personajes, también los pendientes, sin dejar campaignStatus", async () => {
    const res = await DELETE(
      new NextRequest(`http://localhost/api/campaigns/${CAMPAIGN}/members/${PLAYER}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: CAMPAIGN, userId: PLAYER }) },
    );
    expect(res.status).toBe(200);
    expect(calls.updateMany).toEqual([
      [{ campaign: CAMPAIGN, owner: PLAYER }, { $unset: { campaign: "", origin: "", campaignStatus: "" } }],
    ]);
  });
});
