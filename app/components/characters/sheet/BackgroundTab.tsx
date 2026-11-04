import type { CatalogEntry } from "@/lib/rules/catalog/types";
import { ALIGNMENTS } from "@/lib/rules/dnd2024/sheet/alignments";
import { parsePronouns, pronounsText } from "@/lib/rules/dnd2024/creation/names";
import { ABILITY_NAMES, skillName, toolName } from "@/lib/rules/dnd2024/sheet/labels";
import type { Dnd2024SheetV2 } from "@/lib/rules/dnd2024/sheet/sheet";
import { BACKGROUND_SECTION_CHIPS, parseSection, type BackgroundSection } from "@/lib/rules/dnd2024/sheet/sheetSections";
import type { SheetTextField } from "@/lib/rules/dnd2024/sheet/textFields";
import type { Ability, BackgroundData } from "@/lib/rules/types";
import Bbcode from "@/app/components/ui/Bbcode";
import { sheetCard, cardTitle } from "@/app/components/ui/formStyles";
import { InlineSelect, InlineText } from "./InlineText";
import SectionChips from "./SectionChips";

type Query = Record<string, string | string[] | undefined>;

type Props = {
  characterId: string;
  isOwner: boolean;
  sheet: Dnd2024SheetV2;
  backstory: string;
  imageUrl: string | null;
  background: CatalogEntry | null;
  feat: CatalogEntry | null;
  /** Tamaño ya traducido («Mediano»), o «—» si no se sabe. */
  size: string;
  /** Pronombres de la creación, para el género. */
  pronouns: string[];
  base: string;
  query: Query;
};

const entryName = (e: CatalogEntry) => e.nameEs ?? e.name;
const entryText = (e: CatalogEntry) => e.descriptionEs || e.description;

// Trasfondo en tres secciones (Trasfondo, Características, Aspecto) con chips de filtro. Lo que el filtro oculta sigue en
// el DOM (`hidden print:block`) para que la impresión lo saque todo. Las características se editan en el sitio.
export default function BackgroundTab({ characterId, isOwner, sheet, backstory, imageUrl, background, feat, size, pronouns, base, query }: Props) {
  const active: BackgroundSection = parseSection(query.seccion, BACKGROUND_SECTION_CHIPS.map((c) => c.id));
  const hide = (id: Exclude<BackgroundSection, "todo">) => (active === "todo" || active === id ? "" : "hidden print:block");
  const bg = background?.data as BackgroundData | undefined;
  const bonuses = (Object.entries(sheet.background.abilities) as [Ability, number][])
    .map(([a, v]) => `${ABILITY_NAMES[a]} +${v}`);
  const text = (name: SheetTextField, label: string, multiline?: boolean, boxed?: boolean) => (
    <InlineText
      characterId={characterId}
      field={name}
      label={label}
      value={sheet[name] ?? ""}
      multiline={multiline}
      boxed={boxed}
      editable={isOwner}
    />
  );

  return (
    <div>
      <SectionChips chips={BACKGROUND_SECTION_CHIPS} active={active} base={base} query={query} label="Filtrar trasfondo" />
      <div className="space-y-6">
        <section aria-label="Trasfondo" className={`${sheetCard} animate-fade-up ${hide("trasfondo")}`}>
          <h3 className={cardTitle}>Trasfondo: {background ? entryName(background) : sheet.background.name}</h3>
          {background ? (
            entryText(background) ? <Bbcode source={entryText(background)} className="text-sm" /> : null
          ) : (
            <p className="text-sm text-muted">Contenido no disponible.</p>
          )}
          <dl className="mt-4 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
            {bonuses.length > 0 && (
              <>
                <dt className="font-semibold">Mejoras de característica</dt>
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

        <section aria-label="Características" className={`${sheetCard} animate-fade-up ${hide("caracteristicas")}`} style={{ animationDelay: "50ms" }}>
          <h3 className={cardTitle}>Características</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-5">
            <InlineSelect
              characterId={characterId}
              field="alignment"
              label="Alineamiento"
              value={sheet.alignment}
              options={ALIGNMENTS}
              editable={isOwner}
            />
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">Género</div>
              <p className="text-sm text-fg">{pronounsText(parsePronouns(pronouns.join(",")) ?? []) || "—"}</p>
            </div>
            {text("eyes", "Ojos", false, true)}
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">Tamaño</div>
              <p className="text-sm text-fg">{size}</p>
            </div>
            {text("height", "Altura", false, true)}
            {text("faith", "Fe", false, true)}
            {text("hair", "Pelo", false, true)}
            {text("skin", "Piel", false, true)}
            {text("age", "Edad", false, true)}
            {text("weight", "Peso", false, true)}
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {text("personality", "Rasgos de personalidad", true)}
            {text("ideals", "Ideales", true)}
            {text("bonds", "Vínculos", true)}
            {text("flaws", "Defectos", true)}
          </div>
        </section>

        <section aria-label="Aspecto" className={`${sheetCard} animate-fade-up ${hide("aspecto")}`} style={{ animationDelay: "100ms" }}>
          <h3 className={cardTitle}>Aspecto</h3>
          <div className={imageUrl ? "grid gap-6 lg:grid-cols-[1fr_20rem]" : ""}>
            {imageUrl && (
              // En móvil la imagen va arriba; en escritorio, a la derecha
              <div className="lg:order-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="" className="mx-auto max-h-80 w-full lg:max-h-[32rem] rounded-lg border border-line object-contain" />
              </div>
            )}
            <div className="min-w-0 space-y-5 lg:order-1">
              {text("appearance", "Apariencia", true)}
              {backstory && (
                <div>
                  <h4 className="mb-2 font-semibold">Historia</h4>
                  <Bbcode source={backstory} className="text-sm" />
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
