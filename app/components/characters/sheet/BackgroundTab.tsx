import type { CatalogEntry } from "@/lib/rules/catalog/types";
import { ALIGNMENTS } from "@/lib/rules/dnd2024/sheet/alignments";
import { parsePronouns, pronounsText } from "@/lib/rules/dnd2024/creation/names";
import { ABILITY_NAMES, skillName, toolName } from "@/lib/rules/dnd2024/sheet/labels";
import type { Dnd2024SheetV2 } from "@/lib/rules/dnd2024/sheet/sheet";
import { BACKGROUND_SECTION_CHIPS, parseSection, sectionHref, type BackgroundSection } from "@/lib/rules/dnd2024/sheet/sheetSections";
import type { SheetTextField } from "@/lib/rules/dnd2024/sheet/textFields";
import type { Ability, BackgroundData } from "@/lib/rules/types";
import Bbcode from "@/app/components/ui/Bbcode";
import { SectionBar } from "./statUi";
import { InlineSelect, InlineText } from "./InlineText";
import PanelSearch from "./PanelSearch";
import ShowSelect from "./ShowSelect";

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
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 print:hidden">
        <PanelSearch label="Buscar en el trasfondo" />
        <ShowSelect
          label="Mostrar en el trasfondo"
          value={active}
          options={BACKGROUND_SECTION_CHIPS.map((c) => ({ id: c.id, label: c.label, href: `${base}${sectionHref(query, c.id)}` }))}
        />
      </div>
      <div className="space-y-5">
        <section aria-label="Trasfondo" data-search={`Trasfondo ${background ? entryName(background) : sheet.background.name} ${background ? entryText(background) : ""}`} className={`animate-fade-up space-y-3 ${hide("trasfondo")}`}>
          <SectionBar title="Trasfondo" />
          <p className="px-1 font-heading text-lg font-bold text-white">{background ? entryName(background) : sheet.background.name}</p>
          {background ? (
            entryText(background) ? <div className="rounded-md border border-line p-3"><Bbcode source={entryText(background)} className="text-sm" /></div> : null
          ) : (
            <p className="text-sm text-muted">Contenido no disponible.</p>
          )}
          <dl className="grid px-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
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

        <section aria-label="Características" data-search={`Características alineamiento género ojos tamaño altura fe pelo piel edad peso personalidad ideales vínculos defectos ${[sheet.alignment, sheet.eyes, sheet.height, sheet.faith, sheet.hair, sheet.skin, sheet.age, sheet.weight, sheet.personality, sheet.ideals, sheet.bonds, sheet.flaws].filter(Boolean).join(" ")}`} className={`animate-fade-up space-y-3 ${hide("caracteristicas")}`} style={{ animationDelay: "50ms" }}>
          <SectionBar title="Características" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-md bg-surface/40 p-3 sm:grid-cols-5">
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
          <div className="grid gap-4 px-1 md:grid-cols-2">
            {text("personality", "Rasgos de personalidad", true)}
            {text("ideals", "Ideales", true)}
            {text("bonds", "Vínculos", true)}
            {text("flaws", "Defectos", true)}
          </div>
        </section>

        <section aria-label="Aspecto" data-search={`Aspecto apariencia historia ${sheet.appearance ?? ""} ${backstory}`} className={`animate-fade-up space-y-3 ${hide("aspecto")}`} style={{ animationDelay: "100ms" }}>
          <SectionBar title="Aspecto" />
          <div className={imageUrl ? "grid gap-6 px-1 lg:grid-cols-[1fr_16rem]" : "px-1"}>
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
