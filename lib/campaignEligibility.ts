// Si un personaje puede solicitar unirse a una campaña (canRequestJoin con los libros que usa de verdad su hoja y los
// nombres de los libros no permitidos). La usan la ruta de la solicitud y las páginas que ofrecen unir personajes.
import mongoose from "mongoose";
import { Book } from "@/lib/Book";
import { canRequestJoin } from "@/lib/CampaignRules";
import { OUTDATED_SHEET_ERROR } from "@/lib/characterAccess";
import { getEntry } from "@/lib/rules/catalog";
import { booksUsedBy } from "@/lib/rules/dnd2024/booksUsed";
import type { AnySheet } from "@/lib/rules/dnd2024/sheet";
import { loadUpgradeEntries, missingForUpgrade, upgradeSheet } from "@/lib/rules/dnd2024/upgrade";

/** Campos de la campaña que hacen falta (como los guarda Mongo). */
export type JoinCampaign = {
  owner: unknown;
  members?: unknown[];
  systemId: string;
  status: string;
  characters?: { allowed?: boolean; external?: boolean };
  restrictBooks?: boolean;
  allowedBooks?: string[];
};

/** Campos del personaje que hacen falta; `sheet` es la hoja guardada (v1 o v2). */
export type JoinCharacter = { systemId: string; campaign?: unknown; sheet?: AnySheet };

const fakeId = () => "";

/**
 * Libros que usa una hoja guardada. Una v1 se convierte en memoria como lo haría la solicitud (sin guardarla); si no
 * se puede convertir (falta su clase o su trasfondo), null: la solicitud la rechazaría.
 */
export async function storedSheetBooks(sheet: AnySheet | undefined): Promise<string[] | null> {
  if (sheet?.version === 2) return booksUsedBy(sheet);
  if (sheet?.version !== 1) return [];
  const entries = await loadUpgradeEntries(sheet, getEntry);
  if (missingForUpgrade(sheet, entries).length > 0) return null;
  return booksUsedBy(upgradeSheet(sheet, entries, fakeId));
}

/**
 * Por qué no puede `userId` unir cada personaje a cada campaña (texto exacto de la spec, con los nombres de los
 * libros no permitidos), o null si puede. Las hojas se miran una sola vez aunque se repitan.
 */
export async function joinReasons(
  userId: string,
  checks: { campaign: JoinCampaign; character: JoinCharacter }[],
): Promise<(string | null)[]> {
  const booksBySheet = new Map<AnySheet | undefined, Promise<string[] | null>>();
  const booksOf = (sheet: AnySheet | undefined) => {
    if (!booksBySheet.has(sheet)) booksBySheet.set(sheet, storedSheetBooks(sheet));
    return booksBySheet.get(sheet)!;
  };

  const results = await Promise.all(
    checks.map(async ({ campaign, character }) => {
      const books = await booksOf(character.sheet);
      const rule = canRequestJoin({
        campaign: {
          systemId: campaign.systemId,
          status: campaign.status,
          characters: { allowed: !!campaign.characters?.allowed, external: !!campaign.characters?.external },
          restrictBooks: !!campaign.restrictBooks,
          allowedBooks: campaign.allowedBooks ?? [],
        },
        character: {
          systemId: character.systemId,
          campaign: character.campaign ? String(character.campaign) : null,
          books: books ?? [],
        },
        isMember: (campaign.members ?? []).some((m) => String(m) === userId),
      });
      return { rule, outdated: books === null };
    }),
  );

  // Nombres de todos los libros no permitidos de una vez (si alguno ya no existe, se muestra su id)
  const disallowed = [...new Set(results.flatMap(({ rule }) => (rule.ok ? [] : (rule.disallowed ?? []))))];
  const found = disallowed.length
    ? await Book.find({ _id: { $in: disallowed.filter((b) => mongoose.isValidObjectId(b)) } }).select("name").lean()
    : [];
  const names = new Map(found.map((b: { _id: unknown; name: string }) => [String(b._id), b.name]));

  return results.map(({ rule, outdated }) => {
    if (!rule.ok) {
      return rule.disallowed?.length
        ? `Este personaje usa libros que la campaña no permite: ${rule.disallowed.map((b) => names.get(b) ?? b).join(", ")}.`
        : rule.error;
    }
    return outdated ? OUTDATED_SHEET_ERROR : null;
  });
}
