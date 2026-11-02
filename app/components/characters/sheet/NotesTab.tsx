import type { Dnd2024SheetV2 } from "@/lib/rules/dnd2024/sheet/sheet";
import { card } from "@/app/components/ui/formStyles";
import { InlineText } from "./InlineText";

// Pestaña Notas (spec de rasgos §5): organizaciones, aliados, enemigos y otras notas, editables en el sitio por el dueño
export default function NotesTab({ characterId, isOwner, sheet }: { characterId: string; isOwner: boolean; sheet: Dnd2024SheetV2 }) {
  const fields = [
    { field: "organizations", label: "Organizaciones", value: sheet.organizations },
    { field: "allies", label: "Aliados", value: sheet.allies },
    { field: "enemies", label: "Enemigos", value: sheet.enemies },
    { field: "notes", label: "Otras notas", value: sheet.notes },
  ] as const;

  return (
    <section className={`${card} animate-fade-up`}>
      <div className="space-y-5">
        {fields.map((f) => (
          <InlineText
            key={f.field}
            characterId={characterId}
            field={f.field}
            label={f.label}
            value={f.value ?? ""}
            multiline
            editable={isOwner}
          />
        ))}
      </div>
    </section>
  );
}
