// Migración de las hojas de D&D 2024 de la v1 a la v2: el nivel 1 pasa al historial de niveles (`levels`) y el
// equipo inicial elegido se vuelca al inventario. Es idempotente: las hojas que ya están en v2 se saltan.
// Uso: npm run migrate:levels
import mongoose from "mongoose";

// tsx no carga .env.local por sí solo
try {
  process.loadEnvFile(".env.local");
} catch {}

import { connectDB } from "../lib/mongodb";
import { Character } from "../lib/Character";
import { getEntry, type CatalogEntry } from "../lib/rules/catalog";
import { loadEquipmentEntries, refKey } from "../lib/rules/dnd2024/equipmentRefs";
import type { Dnd2024Sheet } from "../lib/rules/dnd2024/sheet";
import { upgradeSheet } from "../lib/rules/dnd2024/upgrade";
import type { BackgroundData, ClassData, Ref } from "../lib/rules/types";

// Entradas que necesita upgradeSheet: la clase, el trasfondo y los objetos del equipo elegido (con el contenido de
// los paquetes). Las que ya no existen quedan fuera: se usa el nombre guardado en el paquete.
async function loadEntries(sheet: Dnd2024Sheet): Promise<Map<string, CatalogEntry>> {
  const entries = new Map<string, CatalogEntry>();
  const cls = sheet.classes?.[0];
  const refs = [cls?.ref, sheet.background?.ref].filter((r): r is Ref => !!r);
  for (const r of refs) {
    const e = await getEntry(r);
    if (e) entries.set(refKey(r), e);
  }
  const klass = cls ? (entries.get(refKey(cls.ref))?.data as ClassData | undefined) : undefined;
  const bg = entries.get(refKey(sheet.background.ref))?.data as BackgroundData | undefined;
  const options = [klass?.equipment?.[cls?.equipment ?? ""] ?? [], bg?.equipment?.[sheet.background.equipment] ?? []];
  await loadEquipmentEntries(options, entries, getEntry);
  return entries;
}

async function main() {
  await connectDB();

  const already = await Character.countDocuments({ "sheet.version": 2 });
  const pending = await Character.find({ "sheet.version": 1 }).select("sheet").lean();
  let converted = 0;
  for (const doc of pending) {
    const sheet = (doc as { sheet: Dnd2024Sheet }).sheet;
    const upgraded = upgradeSheet(sheet, await loadEntries(sheet), () => new mongoose.Types.ObjectId().toHexString());
    // Solo si sigue en v1 (por si se ha convertido mientras tanto)
    const res = await Character.updateOne({ _id: doc._id, "sheet.version": 1 }, { $set: { sheet: upgraded } });
    if (res.modifiedCount) converted++;
  }

  console.log(`${converted} personajes convertidos, ${already} ya estaban en v2`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
