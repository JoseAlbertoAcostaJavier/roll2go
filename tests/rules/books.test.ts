import { describe, expect, it } from "vitest";
import { visibleBooksFilter } from "@/lib/server/catalog/books";

describe("visibleBooksFilter", () => {
  it("los oficiales solo si están listados (no el libro de las tablas de nombres); los propios, todos", () => {
    expect(visibleBooksFilter("u1", "dnd-2024")).toEqual({
      $or: [{ owner: null, visibility: "public", listed: { $ne: false } }, { owner: "u1" }],
      systemId: "dnd-2024",
    });
    expect(visibleBooksFilter("u1")).not.toHaveProperty("systemId");
  });
});
