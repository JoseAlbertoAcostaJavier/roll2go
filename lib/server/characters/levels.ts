import "server-only";
// Subir un nivel y borrar el último. Solo el dueño (loadCharacterFor en modo "write"); se escribe solo lo que cambia
// y solo si nadie ha cambiado de nivel entretanto (si no, 409).
import { Campaign } from "@/lib/models/Campaign";
import { Character } from "@/lib/models/Character";
import { loadForWrite } from "@/lib/server/characters/writeAccess";
import { getEntries, getEntry } from "@/lib/server/catalog/catalog";
import { notify } from "@/lib/server/notifications/notify";
import { fail, type Result } from "@/lib/server/result";
import { unchangedFilter } from "@/lib/utils/unchangedFilter";
import { derive } from "@/lib/rules/dnd2024/derive";
import { applyLevel, checkExpectedLevel, removeLastLevel } from "@/lib/rules/dnd2024/levels/levelOps";
import { masteryCount } from "@/lib/rules/dnd2024/levels/masteries";
import { validateLevel } from "@/lib/rules/dnd2024/levels/validateLevel";
import { refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import type { LevelEntry } from "@/lib/rules/dnd2024/sheet/sheet";
import { loadSheetEntries } from "@/lib/rules/dnd2024/sheet/sheetEntries";
import type { SpellData } from "@/lib/rules/types";

const LEVEL_CHANGED = "El personaje ha cambiado de nivel; recarga la página.";


/* Sube un nivel { expectedLevel, class, choices, hp }; devuelve el nivel nuevo, o los errores por campo. Avisa al DM
   si el personaje está en su campaña. */
export async function levelUp(userId: string, id: string, body: unknown): Promise<Result<{ level: LevelEntry }>> {
  const { found, failure } = await loadForWrite(userId, id);
  if (failure) return failure;

  const { sheet } = found;
  const before = sheet.levels.length;
  const expected = typeof body === "object" && body !== null ? (body as { expectedLevel?: unknown }).expectedLevel : undefined;
  const checked = checkExpectedLevel(expected, before);
  if (!checked.ok) return fail(checked.status, checked.error);

  const result = await validateLevel(sheet, body, {
    userId,
    characterId: id,
    books: found.books,
    resolve: async (ref) => (found.books.includes(ref.book) ? getEntry(ref) : null),
    entries: found.entries,
  });
  if (!result.ok) return { ok: false, status: 400, errors: result.errors };

  // Máximos de PG antes y después: el nuevo puede traer una clase, una subclase o una dote que cuente
  const maxBefore = derive(sheet, found.entries).hp.max;
  const draft = applyLevel(sheet, result.entry, maxBefore, maxBefore);
  const entriesAfter = await loadSheetEntries(draft, found.books, getEntries);
  const maxAfter = derive(draft, entriesAfter).hp.max;
  const next = applyLevel(sheet, result.entry, maxBefore, maxAfter);

  // Solo lo que cambia, y solo si nadie ha subido de nivel entretanto
  const set: Record<string, unknown> = { "sheet.classesSummary": next.classesSummary, "sheet.hp.current": next.hp.current };
  if (next.weaponMasteries) set["sheet.weaponMasteries"] = next.weaponMasteries;
  const res = await Character.updateOne(
    { _id: id, "sheet.version": 2, "sheet.levels": { $size: before } },
    { $set: set, $push: { "sheet.levels": result.entry } },
  );
  if (res.matchedCount === 0) return fail(409, LEVEL_CHANGED);

  // Aviso al DM (si no es quien sube y quien sube sigue en la campaña). Un fallo aquí no deshace el nivel.
  const campaignId = found.character.campaign;
  if (campaignId) {
    try {
      const campaign = await Campaign.findById(campaignId).select("owner members").lean();
      const member = campaign?.members?.some((m: unknown) => String(m) === userId);
      if (campaign && member && String(campaign.owner) !== userId) {
        await notify({
          user: String(campaign.owner),
          type: "character_level_up",
          actor: userId,
          campaign: String(campaignId),
          character: id,
          text: `${found.character.name} a nivel ${result.entry.n}`,
        });
      }
    } catch (err) {
      console.error("No se pudo avisar al DM de la subida de nivel:", err);
    }
  }

  return { ok: true, level: result.entry };
}

// Borra el último nivel (el nivel 1 no se borra)
export async function deleteLastLevel(userId: string, id: string): Promise<Result> {
  const { found, failure } = await loadForWrite(userId, id);
  if (failure) return failure;

  const before = found.sheet.levels.length;
  // Sin el último nivel: el máximo de PG se calcula con la hoja ya recortada
  const probe = removeLastLevel(found.sheet, 0);
  if (!probe.ok) return fail(400, probe.error);
  const entriesAfter = await loadSheetEntries(probe.sheet, found.books, getEntries);
  const derivedAfter = derive(probe.sheet, entriesAfter);
  // Maestrías que permite la hoja sin el nivel (sin tope si falta alguna clase en el catálogo)
  const classesLoaded = probe.sheet.classesSummary.every((c) => entriesAfter.has(refKey(c.class.ref)));
  // Preparados que siguen cabiendo y espacios gastados (con el nivel de cada preparado, de los libros del personaje)
  const prepared = Object.values(found.sheet.prepared ?? {}).flat().filter((r) => found.books.includes(r.book));
  const spellLevels = new Map((await getEntries(prepared)).map((e) => [refKey(e.ref), (e.data as SpellData).level]));
  const result = removeLastLevel(
    found.sheet, derivedAfter.hp.max, classesLoaded ? masteryCount(probe.sheet, entriesAfter) : Infinity,
    classesLoaded ? { ...derivedAfter.spells, spellLevel: (r) => spellLevels.get(refKey(r)) } : undefined,
  );
  if (!result.ok) return fail(400, result.error);

  // Solo lo que cambia, y solo si nadie ha cambiado de nivel entretanto
  const set: Record<string, unknown> = { "sheet.classesSummary": result.sheet.classesSummary, "sheet.hp.current": result.sheet.hp.current };
  // (borrar solo quita maestrías: si cambian, cambia su número)
  if (result.sheet.weaponMasteries && result.sheet.weaponMasteries.length !== found.sheet.weaponMasteries?.length) {
    set["sheet.weaponMasteries"] = result.sheet.weaponMasteries;
  }
  // Los conjuros, solo si nadie los ha cambiado entretanto (si no, se perdería ese cambio); los usos por descanso
  // largo, solo si la hoja los tiene
  const unchanged: Record<string, unknown> = {};
  const stored = found.character.sheet as Record<string, unknown> | undefined;
  if (classesLoaded) {
    for (const field of ["prepared", "slotsUsed", "limitedUsed"] as const) {
      if (result.sheet[field] === undefined) continue;
      set[`sheet.${field}`] = result.sheet[field];
      unchanged[`sheet.${field}`] = unchangedFilter(stored?.[field]);
    }
  }
  // La alternativa de conjuros de la subclase que daba el nivel, igual
  const options = result.sheet.spellOption;
  if (options && Object.keys(options).length !== Object.keys(found.sheet.spellOption ?? {}).length) {
    set["sheet.spellOption"] = options;
    unchanged["sheet.spellOption"] = unchangedFilter(stored?.spellOption);
  }
  const res = await Character.updateOne(
    { _id: id, "sheet.version": 2, "sheet.levels": { $size: before }, ...unchanged },
    { $set: set, $pop: { "sheet.levels": 1 } },
  );
  if (res.matchedCount === 0) {
    // Si sigue en el mismo nivel, lo que cambió entretanto fueron sus conjuros
    const sameLevel = await Character.exists({ _id: id, "sheet.version": 2, "sheet.levels": { $size: before } });
    return fail(409, sameLevel ? "El personaje ha cambiado mientras borrabas el nivel. Recarga la página." : LEVEL_CHANGED);
  }
  return { ok: true };
}
