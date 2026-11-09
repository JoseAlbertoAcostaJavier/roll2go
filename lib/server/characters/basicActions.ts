import "server-only";
// Acciones básicas de un personaje: las que tiene disponibles y lo que permite elegir su campaña.
import { Campaign } from "@/lib/models/Campaign";
import { coreBookIds } from "@/lib/server/catalog/books";
import { listActions } from "@/lib/server/catalog/catalog";
import { isEditableAction, type BasicActionRules } from "@/lib/rules/dnd2024/sheet/basicActions";
import { refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";

type Target = { books: string[]; character: { campaign?: unknown } };

export async function loadBasicActions({ books, character }: Target) {
  const [all, coreBooks, campaign] = await Promise.all([
    listActions(books),
    coreBookIds(),
    character.campaign ? Campaign.findById(character.campaign).select("restrictBooks").lean() : null,
  ]);
  const rules: BasicActionRules = { coreBooks, restricted: !!campaign?.restrictBooks };
  return { all, rules };
}

/** Por qué no se puede aplicar una operación sobre las acciones básicas, o null si se puede. */
export async function basicOpError(target: Target, op: Record<string, unknown>): Promise<string | null> {
  const { all, rules } = await loadBasicActions(target);
  if (rules.restricted) return "En esta campaña las acciones disponibles las decide su configuración.";
  const entry = all.find((e) => refKey(e.ref) === op.key);
  if (!entry) return "Esa acción no está disponible para este personaje.";
  if (op.op === "basicEdit" && !isEditableAction(entry)) return "Esta acción tiene un texto oficial y no se puede editar.";
  return null;
}
