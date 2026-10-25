import type { CatalogEntry } from "@/lib/rules/catalog/types";
import { ALIGNMENTS, alignmentName } from "@/lib/rules/dnd2024/sheet/alignments";
import { ABILITY_NAMES, skillName, toolName } from "@/lib/rules/dnd2024/sheet/labels";
import type { Dnd2024SheetV2 } from "@/lib/rules/dnd2024/sheet/sheet";
import type { Ability, BackgroundData } from "@/lib/rules/types";
import Bbcode from "@/app/components/ui/Bbcode";
import { card, cardTitle } from "@/app/components/ui/formStyles";

type Props = {
  sheet: Dnd2024SheetV2;
  backstory: string;
  imageUrl: string | null;
  background: CatalogEntry | null;
  feat: CatalogEntry | null;
};

const entryName = (e: CatalogEntry) => e.nameEs ?? e.name;
const entryText = (e: CatalogEntry) => e.descriptionEs || e.description;

export default function BackgroundTab({ sheet, backstory, imageUrl, background, feat }: Props) {
  const alignment = ALIGNMENTS.find((a) => a.id === sheet.alignment);
  const details = [
    { label: "Edad", value: sheet.age },
    { label: "Apariencia", value: sheet.appearance },
    { label: "Idiomas", value: sheet.languages },
    { label: "Puntos de experiencia", value: String(sheet.xp ?? 0) },
  ].filter((x) => x.value);
  const bg = background?.data as BackgroundData | undefined;
  const bonuses = (Object.entries(sheet.background.abilities) as [Ability, number][])
    .map(([a, v]) => `${ABILITY_NAMES[a]} +${v}`);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      {imageUrl && (
        // En móvil la imagen va arriba; en escritorio, a la derecha
        <div className="animate-fade-up lg:order-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" className="mx-auto max-h-80 w-full lg:max-h-[32rem] rounded-lg border border-line object-contain" />
        </div>
      )}

      <div className="min-w-0 space-y-6 lg:order-1">
        <section className={`${card} animate-fade-up`}>
          <h3 className={cardTitle}>Detalles</h3>
          <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="font-semibold">Alineamiento</dt>
            <dd className="text-muted">
              {sheet.alignment ? (
                <>
                  <span className="text-fg">{alignmentName(sheet.alignment)}</span>
                  {alignment && <span className="block">{alignment.description}</span>}
                </>
              ) : "—"}
            </dd>
            {details.map((x) => (
              <div key={x.label} className="contents">
                <dt className="font-semibold">{x.label}</dt>
                <dd className="whitespace-pre-wrap text-muted">{x.value}</dd>
              </div>
            ))}
          </dl>
          {backstory && (
            <>
              <h4 className="mb-2 mt-5 font-semibold">Historia</h4>
              <Bbcode source={backstory} className="text-sm" />
            </>
          )}
          {sheet.notes && (
            <>
              <h4 className="mb-2 mt-5 font-semibold">Notas</h4>
              <p className="whitespace-pre-wrap text-sm text-muted">{sheet.notes}</p>
            </>
          )}
        </section>

        <section className={`${card} animate-fade-up`} style={{ animationDelay: "50ms" }}>
          <h3 className={cardTitle}>Trasfondo: {background ? entryName(background) : sheet.background.name}</h3>
          {background ? (
            entryText(background) ? <Bbcode source={entryText(background)} className="text-sm" /> : null
          ) : (
            <p className="text-sm text-muted">Contenido no disponible.</p>
          )}
          <dl className="mt-4 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
            {bonuses.length > 0 && (
              <>
                <dt className="font-semibold">Características</dt>
                <dd className="text-muted">{bonuses.join(", ")}</dd>
              </>
            )}
            <dt className="font-semibold">Dote de origen</dt>
            <dd className="text-muted">{feat ? entryName(feat) : "—"}</dd>
            <dt className="font-semibold">Habilidades</dt>
            <dd className="text-muted">{bg?.skills.map(skillName).join(", ") || "—"}</dd>
            <dt className="font-semibold">Herramientas</dt>
            <dd className="text-muted">{bg?.tools.map(toolName).join(", ") || "—"}</dd>
          </dl>
        </section>
      </div>
    </div>
  );
}
