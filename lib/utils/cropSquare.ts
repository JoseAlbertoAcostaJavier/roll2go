// Geometría del recorte cuadrado de una imagen, en píxeles de la imagen original. Módulo puro.
export type SquareCrop = { x: number; y: number; size: number };
export type CropCorner = "nw" | "ne" | "sw" | "se";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** El mayor cuadrado que cabe, centrado a lo ancho y pegado arriba (en los retratos largos la cara suele estar ahí). */
export function initialCrop(width: number, height: number): SquareCrop {
  const size = Math.min(width, height);
  return { x: Math.round((width - size) / 2), y: 0, size };
}

export function moveCrop(crop: SquareCrop, dx: number, dy: number, width: number, height: number): SquareCrop {
  return { ...crop, x: clamp(crop.x + dx, 0, width - crop.size), y: clamp(crop.y + dy, 0, height - crop.size) };
}

/** Arrastra una esquina con la opuesta fija: sigue siendo cuadrado y no sale de la imagen. */
export function resizeCrop(crop: SquareCrop, corner: CropCorner, dx: number, dy: number, width: number, height: number, minSize: number): SquareCrop {
  const east = corner.endsWith("e");
  const south = corner.startsWith("s");
  const anchorX = east ? crop.x : crop.x + crop.size;
  const anchorY = south ? crop.y : crop.y + crop.size;
  const limit = Math.min(east ? width - anchorX : anchorX, south ? height - anchorY : anchorY);
  const size = clamp(crop.size + Math.max(east ? dx : -dx, south ? dy : -dy), Math.min(minSize, limit), limit);
  return { x: east ? anchorX : anchorX - size, y: south ? anchorY : anchorY - size, size };
}
