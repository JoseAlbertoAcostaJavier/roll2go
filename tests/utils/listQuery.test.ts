import { describe, expect, it } from "vitest";
import { nextListQuery } from "@/lib/utils/listQuery";

describe("nextListQuery", () => {
  it("los cambios sucesivos se acumulan", () => {
    const a = nextListQuery(new URLSearchParams(), { name: "q", value: "abc", defaultValue: "" });
    const b = nextListQuery(a, { name: "status", value: "archived", defaultValue: "active" });
    const c = nextListQuery(b, { name: "sort", value: "name", defaultValue: "recent" });
    expect(c.get("q")).toBe("abc");
    expect(c.get("status")).toBe("archived");
    expect(c.get("sort")).toBe("name");
  });
  it("un valor vacío o el de por defecto quita el parámetro", () => {
    const base = new URLSearchParams("q=abc&status=archived");
    expect(nextListQuery(base, { name: "q", value: "", defaultValue: "" }).has("q")).toBe(false);
    expect(nextListQuery(base, { name: "status", value: "active", defaultValue: "active" }).has("status")).toBe(false);
    expect(nextListQuery(base, { name: "status", value: "active", defaultValue: "active" }).get("q")).toBe("abc");
  });
  it("vuelve a la primera página y no modifica la base", () => {
    const base = new URLSearchParams("q=abc&page=3");
    const next = nextListQuery(base, { name: "status", value: "archived", defaultValue: "active" });
    expect(next.has("page")).toBe(false);
    expect(base.get("page")).toBe("3");
  });
});
