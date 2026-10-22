import { describe, expect, it } from "vitest";
import { bbcodeToText, parseBbcode, plainText } from "@/lib/bbcode";

describe("bbcode [ref]", () => {
  it("parsea [ref=tipo:clave] como nodo ref", () => {
    const [n] = parseBbcode("[ref=spell:fireball|xphb]Bola[/ref]");
    expect(n).toMatchObject({ type: "ref", target: "spell:fireball|xphb" });
    expect(plainText([n])).toBe("Bola");
  });

  it("bbcodeToText y plainText dejan solo el texto", () => {
    const src = "Lanza [ref=spell:fireball|xphb]Bola de fuego[/ref] y [b]grita[/b]";
    expect(bbcodeToText(src)).toBe("Lanza Bola de fuego y grita");
    expect(plainText(parseBbcode(src))).toBe("Lanza Bola de fuego y grita");
  });

  it("[ref] sin cerrar se cierra solo y las demás etiquetas siguen igual", () => {
    expect(parseBbcode("[ref=a:b]x")[0]).toMatchObject({ type: "ref", target: "a:b" });
    expect(parseBbcode("[b]x[/b]")[0]).toMatchObject({ type: "el", tag: "b" });
  });
});
