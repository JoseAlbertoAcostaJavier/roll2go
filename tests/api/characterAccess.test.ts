import { beforeEach, describe, expect, it, vi } from "vitest";

// Base de datos falsa: un personaje y una campaña con su DM y sus miembros. `Campaign.exists` evalúa el filtro.
const OWNER = "a00000000000000000000001";
const DM = "a00000000000000000000002";
const MEMBER = "a00000000000000000000003";
const CAMPAIGN = "c00000000000000000000001";
const ID = "b00000000000000000000001";
const db = vi.hoisted(() => ({ character: null as Record<string, unknown> | null }));
const sheet = { version: 2 };

vi.mock("@/lib/models/mongodb", () => ({ connectDB: async () => {} }));
vi.mock("@/lib/models/Character", () => ({
  Character: { findById: () => ({ lean: async () => db.character }) },
}));
vi.mock("@/lib/models/Campaign", () => ({
  Campaign: {
    exists: async (f: { _id: string; owner?: string; members?: string }) => {
      if (f._id !== CAMPAIGN) return null;
      if (f.owner !== undefined) return f.owner === DM ? { _id: CAMPAIGN } : null;
      return f.members !== undefined && [DM, OWNER, MEMBER].includes(f.members) ? { _id: CAMPAIGN } : null;
    },
  },
}));
vi.mock("@/lib/rules/catalog", () => ({
  NotFoundError: class extends Error {},
  getEntries: async () => [],
  getEntry: async () => null,
  usableBooks: async () => ["libro"],
}));
vi.mock("@/lib/rules/dnd2024/sheetEntries", () => ({ loadSheetEntries: async () => new Map() }));
vi.mock("@/lib/rules/dnd2024/upgrade", () => ({
  loadUpgradeEntries: async () => new Map(),
  missingForUpgrade: () => [],
  upgradeSheet: (s: unknown) => s,
}));

const { loadCharacterFor } = await import("@/lib/characterAccess");

const readable = async (userId: string) => (await loadCharacterFor(userId, ID, "read")) !== null;

describe("loadCharacterFor: personajes pendientes y aprobados", () => {
  const base = { _id: ID, owner: OWNER, systemId: "dnd-2024", campaign: CAMPAIGN, books: [], sheet };

  beforeEach(() => {
    db.character = null;
  });

  it("pendiente: lo leen el dueño y el DM, no otro miembro", async () => {
    db.character = { ...base, campaignStatus: "pending" };
    expect(await readable(OWNER)).toBe(true);
    expect(await readable(DM)).toBe(true);
    expect(await readable(MEMBER)).toBe(false);
  });

  it("aprobado: lo lee cualquier miembro", async () => {
    db.character = { ...base, campaignStatus: "approved" };
    expect(await readable(MEMBER)).toBe(true);
    expect(await readable(DM)).toBe(true);
  });

  it("sin estado (personajes antiguos): cuenta como aprobado", async () => {
    db.character = { ...base };
    expect(await readable(MEMBER)).toBe(true);
  });

  it("nadie más que el dueño escribe, aunque esté aprobado", async () => {
    db.character = { ...base, campaignStatus: "approved" };
    expect(await loadCharacterFor(DM, ID, "write")).toBeNull();
  });
});
