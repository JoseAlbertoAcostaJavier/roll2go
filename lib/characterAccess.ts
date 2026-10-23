// Acceso a un personaje de D&D 2024 desde las rutas de la ficha. Ver: el dueño o un miembro de su campaña; escribir:
// solo el dueño. Cualquier otro caso devuelve null (las rutas responden 404 sin revelar que existe).
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Campaign } from "@/lib/Campaign";
import { Character } from "@/lib/Character";
import { NotFoundError, getEntries, usableBooks } from "@/lib/rules/catalog";
import type { AnySheet, Dnd2024SheetV2 } from "@/lib/rules/dnd2024/sheet";
import { loadSheetEntries } from "@/lib/rules/dnd2024/sheetEntries";
import { upgradeSheet } from "@/lib/rules/dnd2024/upgrade";

const newId = () => new mongoose.Types.ObjectId().toHexString();

/**
 * Personaje al que `userId` puede acceder, con su hoja en v2 (una v1 se convierte en memoria; quien escribe guarda
 * el resultado), los libros que puede usar y las entradas del catálogo de la hoja. null = 404.
 */
export async function loadCharacterFor(userId: string, id: string, mode: "read" | "write") {
  if (!mongoose.isValidObjectId(id)) return null;
  await connectDB();
  const character = await Character.findById(id).lean();
  if (!character || character.systemId !== "dnd-2024") return null;

  const isOwner = String(character.owner) === userId;
  if (!isOwner) {
    if (mode === "write" || !character.campaign) return null;
    const member = await Campaign.exists({ _id: character.campaign, members: userId });
    if (!member) return null;
  }

  const stored = character.sheet as AnySheet | undefined;
  if (stored?.version !== 1 && stored?.version !== 2) return null;

  // Libros del personaje: su filtro propio o, si no tiene, todos los que le corresponden por sistema y campaña
  const owner = String(character.owner);
  const base = { userId: owner, systemId: character.systemId as string };
  const chosenBooks = ((character.books ?? []) as string[]).length ? (character.books as string[]) : undefined;
  let books: string[];
  try {
    books = await usableBooks({ ...base, campaignId: character.campaign ? String(character.campaign) : undefined, chosenBooks });
  } catch (e) {
    if (!(e instanceof NotFoundError)) throw e;
    // El dueño ya no es miembro de la campaña: se usan los libros que ve por sistema
    books = await usableBooks({ ...base, chosenBooks });
  }

  const entries = await loadSheetEntries(stored, books, getEntries);
  const sheet: Dnd2024SheetV2 = upgradeSheet(stored, entries, newId);
  return { character, sheet, books, entries };
}
