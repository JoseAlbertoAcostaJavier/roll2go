// Convierte la carpeta de iconos (clases, escuelas de magia, especies y estados) en los archivos de public/images.
// Clases, escuelas y especies se reducen a WebP cuadrado de 192 px (se ven como mucho a 96 px); los estados son
// siluetas blancas pequeñas y se copian como SVG para teñirlos con CSS (máscara).
// Uso: npm run icons -- "<carpeta Iconos DnD>"
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { iconFileId } from "../lib/icons";

const SIZE = 192;
const root = process.argv[2];
if (!root || !existsSync(root)) {
  console.error('Uso: npm run icons -- "<carpeta Iconos DnD>"');
  process.exit(1);
}
const out = path.join(process.cwd(), "public", "images");

// Carpeta de origen → carpeta de destino y tipo de icono
const GROUPS = [
  { from: path.join("Classes", "PHB"), to: "classes", kind: "class" },
  { from: "Magic Schools", to: "schools", kind: "school" },
  { from: path.join("Species", "PHB"), to: "species", kind: "species" },
  { from: "Statues Badge", to: "status", kind: "status" },
] as const;

async function main() {
  for (const g of GROUPS) {
    const dir = path.join(root, g.from);
    if (!existsSync(dir)) {
      console.warn(`No existe ${dir}; se omite.`);
      continue;
    }
    const dest = path.join(out, g.to);
    mkdirSync(dest, { recursive: true });
    for (const file of readdirSync(dir).filter((f) => /\.(svg|png|webp|jpe?g)$/i.test(f))) {
      const id = iconFileId(g.kind, file);
      if (!id) {
        console.warn(`${g.from}/${file}: nombre no reconocido; se omite.`);
        continue;
      }
      if (g.kind === "status") {
        copyFileSync(path.join(dir, file), path.join(dest, `${id}.svg`));
      } else {
        await sharp(path.join(dir, file), { density: 144 })
          .resize(SIZE, SIZE, { fit: "cover" })
          .webp({ quality: 82 })
          .toFile(path.join(dest, `${id}.webp`));
      }
      console.log(`${g.to}/${id}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
