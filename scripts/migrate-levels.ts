// Migración de las hojas de D&D 2024 de la v1 a la v2: el nivel 1 pasa al historial de niveles (`levels`) y el
// equipo inicial elegido se vuelca al inventario. Es idempotente: las hojas que ya están en v2 se saltan. Las que no se
// pueden convertir (su clase o su trasfondo ya no están en el catálogo) se dejan en v1 y se listan al final.
// Uso: npm run migrate:levels
import mongoose from "mongoose";

// tsx no carga .env.local por sí solo
try {
  process.loadEnvFile(".env.local");
} catch {}

import { connectDB } from "../lib/models/mongodb";
import { Character } from "../lib/models/Character";
import { getEntry } from "../lib/server/catalog/catalog";
import type { Dnd2024Sheet } from "../lib/rules/dnd2024/sheet";
import { loadUpgradeEntries, missingForUpgrade, upgradeSheet } from "../lib/rules/dnd2024/upgrade";

async function main() {
  await connectDB();

  const already = await Character.countDocuments({ "sheet.version": 2 });
  const pending = await Character.find({ "sheet.version": 1 }).select("name sheet").lean();
  let converted = 0;
  const skipped: string[] = [];
  for (const doc of pending) {
    const sheet = (doc as { sheet: Dnd2024Sheet }).sheet;
    const entries = await loadUpgradeEntries(sheet, getEntry);
    // Sin la clase o el trasfondo en el catálogo quedaría con 0 PG o sin inventario: se salta y se avisa
    const missing = missingForUpgrade(sheet, entries);
    if (missing.length) {
      skipped.push(`${doc._id} (${doc.name}): no se encuentra ${missing.join(", ")}`);
      continue;
    }
    const upgraded = upgradeSheet(sheet, entries, () => new mongoose.Types.ObjectId().toHexString());
    // Solo si sigue en v1 (por si se ha convertido mientras tanto)
    const res = await Character.updateOne({ _id: doc._id, "sheet.version": 1 }, { $set: { sheet: upgraded } });
    if (res.modifiedCount) converted++;
  }

  console.log(`${converted} personajes convertidos, ${already} ya estaban en v2`);
  if (skipped.length) {
    console.warn(`${skipped.length} personajes sin convertir (sigue faltando su clase o su trasfondo):`);
    for (const s of skipped) console.warn(`  ${s}`);
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
