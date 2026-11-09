import { describe, expect, it } from "vitest";
import { bbcodeToText, embedForHost, parseBbcode, plainText, videoEmbedUrl } from "@/lib/utils/bbcode";

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

describe("vídeos incrustados", () => {
  const twitch = (raw: string) => embedForHost(videoEmbedUrl(raw)!, "roll2go.es");

  it("Twitch lleva el dominio de la página en canales, vídeos y clips", () => {
    expect(twitch("https://twitch.tv/ibai")).toBe("https://player.twitch.tv/?channel=ibai&parent=roll2go.es");
    expect(twitch("https://www.twitch.tv/videos/123")).toBe("https://player.twitch.tv/?video=123&parent=roll2go.es");
    expect(twitch("https://www.twitch.tv/ibai/clip/Abc-1")).toBe("https://clips.twitch.tv/embed?clip=Abc-1&parent=roll2go.es");
    expect(twitch("https://clips.twitch.tv/Abc-1")).toBe("https://clips.twitch.tv/embed?clip=Abc-1&parent=roll2go.es");
  });

  it("los demás proveedores no cambian", () => {
    const embed = videoEmbedUrl("https://youtu.be/dQw4w9WgXcQ")!;
    expect(embedForHost(embed, "roll2go.es")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });
});
