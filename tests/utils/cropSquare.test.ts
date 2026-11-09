import { describe, expect, it } from "vitest";
import { initialCrop, moveCrop, resizeCrop } from "@/lib/utils/cropSquare";

describe("recorte cuadrado", () => {
  it("empieza con el mayor cuadrado posible", () => {
    expect(initialCrop(400, 900)).toEqual({ x: 0, y: 0, size: 400 });
    expect(initialCrop(900, 400)).toEqual({ x: 250, y: 0, size: 400 });
  });

  it("no deja mover el cuadrado fuera de la imagen", () => {
    expect(moveCrop({ x: 10, y: 10, size: 100 }, -50, 1000, 300, 400)).toEqual({ x: 0, y: 300, size: 100 });
  });

  it("redimensiona con la esquina opuesta fija", () => {
    expect(resizeCrop({ x: 100, y: 100, size: 100 }, "se", 20, 5, 500, 500, 32)).toEqual({ x: 100, y: 100, size: 120 });
    expect(resizeCrop({ x: 100, y: 100, size: 100 }, "nw", -20, 0, 500, 500, 32)).toEqual({ x: 80, y: 80, size: 120 });
    expect(resizeCrop({ x: 100, y: 100, size: 100 }, "ne", 10, 0, 500, 500, 32)).toEqual({ x: 100, y: 90, size: 110 });
  });

  it("respeta los límites de la imagen y el tamaño mínimo", () => {
    expect(resizeCrop({ x: 100, y: 100, size: 100 }, "se", 900, 0, 300, 250, 32).size).toBe(150);
    expect(resizeCrop({ x: 100, y: 100, size: 100 }, "se", -900, -900, 500, 500, 32).size).toBe(32);
  });
});
