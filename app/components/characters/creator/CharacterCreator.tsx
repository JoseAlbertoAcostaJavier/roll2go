"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import Bbcode from "@/app/components/ui/Bbcode";
import { card, cardTitle, errorClass, field, labelClass, primaryButton } from "@/app/components/ui/formStyles";
import type { CatalogEntry, EntryOption } from "@/lib/rules/catalog/types";
import {
  ABILITIES, type Ability, type BackgroundData, type ClassData, type Equipment, type FeatData, type FeatureData,
  type LanguageData, type OptionalFeatureData, type Pack, type Ref, type SpeciesData,
} from "@/lib/rules/types";
import type { AbilityMethod, Dnd2024Sheet } from "@/lib/rules/dnd2024/sheet/sheet";
import { checkBackgroundBonus } from "@/lib/rules/dnd2024/creation/abilities";
import { totalsWithinLimit } from "@/lib/rules/dnd2024/creation/assign";
import { draftWithoutRolls } from "@/lib/rules/dnd2024/creation/drafts";
import { languageTotal, pruneLanguages, prunePicks, choosePacks } from "@/lib/rules/dnd2024/creation/creatorPicks";
import { capSlots, fixedLanguages, languagePool, languageSlots } from "@/lib/rules/dnd2024/creation/languages";
import { bareName, equipmentRefs, refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import { ABILITY_NAMES, sizeName, skillName, toolName } from "@/lib/rules/dnd2024/sheet/labels";
import { crossSourceGranted } from "@/lib/rules/dnd2024/spells/grantedSpells";
import { featNameOfLabel, featSpellPending, featSpellsSource } from "@/lib/rules/dnd2024/spells/featSpells";
import { pendingChoices, withBonusCantrips, type PendingChoice } from "@/lib/rules/dnd2024/levels/pendingChoices";
import { maxSpellLevel, spellListOf } from "@/lib/rules/dnd2024/spells/spellcasting";
import {
  emptySpellPick, featSpellsChoiceOf, featSpellsMissing, parseSpellPick, spellChoiceOf, spellPickMissing, type SpellPick,
} from "@/lib/rules/dnd2024/spells/spellPicks";
import { PRONOUNS, type Pronoun } from "@/lib/rules/dnd2024/creation/names";
import { pendingSpellLists } from "@/lib/rules/catalog/spellRows";
import type { CreationDraft } from "@/lib/rules/dnd2024/creation/recreate";
import { SKILLS_SOURCE } from "@/lib/rules/dnd2024/sheet/upgrade";
import AbilityScores from "./AbilityScores";
import CharacterSummary, { type MissingItem } from "./CharacterSummary";
import SectionIndex, { type SectionLink } from "./SectionIndex";
import RoundIcon from "../../ui/RoundIcon";
import ClassFeaturesSection, { choicesFor, refFromKey, unfinished, type ChoiceValues } from "./ClassFeaturesSection";
import EquipmentPicks from "./EquipmentPicks";
import LanguagesSection from "./LanguagesSection";
import NameGeneratorButton from "./NameGeneratorButton";
import RuleSelect from "./RuleSelect";
import FieldError from "../fields/FieldError";
import ImageFields from "../fields/ImageFields";
import InfoFields from "../fields/InfoFields";
import PronounsField from "../fields/PronounsField";
import SkillPicker from "../fields/SkillPicker";
import FeatSpellsStep from "../levelup/steps/FeatSpellsStep";
import SpellsStep from "../levelup/steps/SpellsStep";
import SpellListsStatus from "../SpellListsStatus";
import useCatalogEntries from "../hooks/useCatalogEntries";
import useSpellLists from "../hooks/useSpellLists";
import StatusField from "../fields/StatusField";
import { LIMITS, STATUSES, type Status } from "../fields/constants";

type Size = "S" | "M" | "L";
type Base = Record<Ability, number | null>;
type Rolls = { values: number[]; token: string; dice?: number[][] };

// Lo que rellena el usuario; se guarda tal cual como borrador (salvo las imágenes)
type FormState = {
  name: string;
  pronouns: Pronoun[];
  status: Status;
  species: Ref | null;
  lineage: Ref | null;
  speciesSkills: string[];
  size: Size | null;
  background: Ref | null;
  bonus: Partial<Record<Ability, number>>;
  bgEquipment: string;
  /** Objeto elegido en cada paquete con `choose` de la opción de equipo, por índice del paquete (en texto). */
  bgEquipmentPicks: Record<string, Ref>;
  klass: Ref | null;
  /** Elecciones de nivel 1 de la clase (habilidades incluidas), por `source` de `pendingChoices`. */
  classChoices: ChoiceValues;
  classEquipment: string;
  classEquipmentPicks: Record<string, Ref>;
  /** Trucos y conjuros iniciales (o libro del Mago). Los preparados se eligen en la ficha, no al crear. */
  spells: SpellPick;
  /**
   * Conjuros de la dote del trasfondo (Iniciado en la magia…) y de las invocaciones elegidas (Pacto del tomo), con la
   * lista elegida, y su característica de lanzamiento, por `source` de la elección.
   */
  featSpells: Record<string, SpellPick>;
  featAbility: Record<string, Ability>;
  method: AbilityMethod;
  base: Base;
  rolls: Rolls | null;
  alignment: string;
  appearance: string;
  age: string;
  backstory: string;
  /** Texto libre de un borrador antiguo; ya no se edita, pero se conserva. */
  languages: string;
  /** Idiomas elegidos, uno por hueco y en su orden (null = sin elegir). */
  languageChoices: (Ref | null)[];
  notes: string;
  xp: string;
};

type Props = {
  systemId: string;
  campaign: { id: string; name: string } | null;
  chosenBooks: string[];
  species: EntryOption[];
  /** Legados por "libro:clave" de la especie. */
  lineages: Record<string, EntryOption[]>;
  classes: EntryOption[];
  backgrounds: EntryOption[];
  /** Dotes (con `data`), para los estilos de combate. */
  feats: EntryOption[];
  /** Rasgos opcionales (con `data`): invocaciones, metamagia, maniobras… */
  optionalFeatures: EntryOption[];
  /** Armas con propiedad de maestría (con `data`). */
  weapons: EntryOption[];
  /** Idiomas (con `data`: estándar o raro). */
  languages: EntryOption[];
  /** Objetos no mágicos que pueden elegirse en el equipo inicial (con `data`). */
  choiceItems: EntryOption[];
  /**
   * Rehacer la creación de un personaje de nivel 1: se precarga con su creación actual (si no hay borrador propio) y
   * se guarda con `PUT /api/characters/[id]/creation`. Sin campaña, imágenes, estado ni información (no cambian).
   */
  recreate?: { characterId: string; initial: CreationDraft };
};

const emptyForm = (): FormState => ({
  name: "", pronouns: [], status: "active",
  species: null, lineage: null, speciesSkills: [], size: null,
  background: null, bonus: {}, bgEquipment: "", bgEquipmentPicks: {},
  klass: null, classChoices: {}, classEquipment: "", classEquipmentPicks: {}, spells: emptySpellPick(),
  featSpells: {}, featAbility: {},
  method: "pointBuy", base: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }, rolls: null,
  alignment: "", appearance: "", age: "", backstory: "", languages: "", languageChoices: [], notes: "", xp: "",
});

/** El formulario es idéntico al de partida (los valores por defecto no cuentan como datos del usuario). */
export const isUntouched = (form: FormState, blank: FormState) => JSON.stringify(form) === JSON.stringify(blank);

/** Formulario vacío de una creación nueva, para comparar. */
export const blankForm = emptyForm;

// En la creación aún no conoce ningún conjuro
const NO_SPELLS = { cantrips: [], spells: [] };

// Valor por defecto de una casilla vacía según el método (las fichas de tiradas y predefinidos no tienen)
const defaultBase = (m: AbilityMethod) => (m === "pointBuy" ? 8 : m === "manual" ? 10 : null);

const sameRef = (a: Ref | null, b: Ref | null) => !!a && !!b && a.book === b.book && a.key === b.key;
const findOption = (list: EntryOption[], ref: Ref | null) => (ref ? list.find((o) => sameRef(o.ref, ref)) ?? null : null);
const nameOf = (e: { nameEs: string | null; name: string }) => e.nameEs ?? e.name;
const letters = (eq: Equipment | undefined) => Object.keys(eq ?? {}).sort();
const fmtGold = (copper: number) => `${(copper / 100).toLocaleString("es-ES", { maximumFractionDigits: 2 })} po`;

// Las secciones del formulario, para los enlaces de "Falta por completar"
const S = {
  details: "#detalles", status: "#estado", background: "#trasfondo",
  klass: "#clase", spells: "#conjuros", languages: "#idiomas", abilities: "#caracteristicas", info: "#informacion",
} as const;

// ---------- borrador ----------

const draftKeyOf = (systemId: string, campaignId?: string) => `roll2go:new-character:${systemId}:${campaignId ?? "none"}`;
// Al rehacer, un borrador por personaje (no pisa el de un personaje nuevo)
const recreateDraftKey = (characterId: string) => `roll2go:recreate-character:${characterId}`;
const noSubscribe = () => () => {};

function readDraft(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : []);

// Recupera el borrador comprobando cada campo; las referencias que ya no están entre las opciones se descartan
export function parseDraft(raw: string | null, props: Props): FormState {
  const form = emptyForm();
  let d: unknown = null;
  try {
    d = raw ? JSON.parse(raw) : null;
  } catch {
    return form;
  }
  if (!isObj(d)) return form;

  for (const k of ["name", "bgEquipment", "classEquipment", "alignment", "appearance", "age", "backstory", "languages", "notes", "xp"] as const)
    if (typeof d[k] === "string") form[k] = d[k] as string;
  if (STATUSES.some((s) => s.id === d.status)) form.status = d.status as Status;
  if (["pointBuy", "roll", "standard", "manual"].includes(d.method as string)) form.method = d.method as AbilityMethod;
  if (isObj(d.base)) {
    const base = d.base;
    if (ABILITIES.every((a) => base[a] === null || typeof base[a] === "number")) form.base = base as Base;
  }
  if (isObj(d.bonus)) {
    for (const a of ABILITIES) if (d.bonus[a] === 1 || d.bonus[a] === 2) form.bonus[a] = d.bonus[a] as number;
  }
  if (isObj(d.rolls) && Array.isArray(d.rolls.values) && d.rolls.values.every((v) => typeof v === "number") && typeof d.rolls.token === "string") {
    const dice = d.rolls.dice;
    const validDice = Array.isArray(dice) && dice.every((x) => Array.isArray(x) && x.every((n) => typeof n === "number"));
    form.rolls = { values: d.rolls.values as number[], token: d.rolls.token, ...(validDice ? { dice: dice as number[][] } : {}) };
  }
  form.pronouns = PRONOUNS.map((p) => p.id).filter((id) => strings(d.pronouns).includes(id));

  const asRef = (v: unknown): Ref | null =>
    isObj(v) && typeof v.book === "string" && typeof v.key === "string" ? { book: v.book, key: v.key } : null;
  form.species = findOption(props.species, asRef(d.species))?.ref ?? null;
  if (form.species)
    form.lineage = findOption(props.lineages[refKey(form.species)] ?? [], asRef(d.lineage))?.ref ?? null;
  form.background = findOption(props.backgrounds, asRef(d.background))?.ref ?? null;
  form.klass = findOption(props.classes, asRef(d.klass))?.ref ?? null;
  form.speciesSkills = form.species ? strings(d.speciesSkills) : [];
  form.size = ["S", "M", "L"].includes(d.size as string) && form.species ? (d.size as Size) : null;
  if (form.klass && isObj(d.classChoices))
    for (const [source, v] of Object.entries(d.classChoices)) form.classChoices[source] = strings(v);
  if (form.klass) form.spells = parseSpellPick(d.spells);
  // Conjuros de dotes e invocaciones por fuente (los borradores anteriores guardaban solo los de la dote del trasfondo)
  const bgFeat = (findOption(props.backgrounds, form.background)?.data as BackgroundData | undefined)?.feat;
  const legacy = bgFeat ? featSpellsSource(bgFeat) : "";
  if (isObj(d.featSpells)) {
    const picks = Array.isArray(d.featSpells.cantrips) ? (legacy ? { [legacy]: d.featSpells } : {}) : d.featSpells;
    for (const [source, v] of Object.entries(picks)) form.featSpells[source] = parseSpellPick(v);
  }
  const abilities = typeof d.featAbility === "string" ? (legacy ? { [legacy]: d.featAbility } : {}) : d.featAbility;
  if (isObj(abilities)) {
    for (const [source, a] of Object.entries(abilities))
      if (ABILITIES.includes(a as Ability)) form.featAbility[source] = a as Ability;
  }
  if (!form.background) form.bgEquipment = "";
  if (!form.klass) form.classEquipment = "";

  // Objetos elegidos: solo los que siguen en el catálogo y en un paquete con `choose` de la opción elegida
  const readPicks = (v: unknown, equipment: Equipment | undefined, letter: string) => {
    const picks: Record<string, Ref> = {};
    if (isObj(v))
      for (const [i, r] of Object.entries(v)) {
        const ref = findOption(props.choiceItems, asRef(r))?.ref;
        if (ref) picks[i] = ref;
      }
    return prunePicks(picks, equipment, letter);
  };
  form.bgEquipmentPicks = readPicks(d.bgEquipmentPicks, bgData0(props, form), form.bgEquipment);
  const classData0 = (findOption(props.classes, form.klass)?.data as ClassData | undefined)?.equipment;
  form.classEquipmentPicks = readPicks(d.classEquipmentPicks, classData0, form.classEquipment);
  // Idiomas elegidos: los de un borrador antiguo no los tienen
  const typeOf = languageTypeOf(props.languages);
  const levels = classLevelsOf(form.klass);
  const slots = languageSlotsFor(levels, props.languages);
  const given = Array.isArray(d.languageChoices) ? d.languageChoices.slice(0, languageTotal(slots)) : [];
  form.languageChoices = pruneLanguages(
    given.map((r) => findOption(props.languages, asRef(r))?.ref ?? null), slots, fixedLanguages(levels), typeOf,
  );
  return form;
}

const bgData0 = (props: Props, form: FormState) =>
  (findOption(props.backgrounds, form.background)?.data as BackgroundData | undefined)?.equipment;

// Niveles por clase para las reglas de idiomas: la clase inicial, a nivel 1
const classLevelsOf = (klass: Ref | null): Record<string, number> => (klass ? { [bareName(klass.key)]: 1 } : {});

// Huecos de idiomas con lo que se pide recortado a los idiomas que hay para elegir en los libros del personaje
const languageSlotsFor = (levels: Record<string, number>, languages: EntryOption[]) =>
  capSlots(languageSlots(levels), languagePool(languages), fixedLanguages(levels));

// Tipo (estándar o raro) de un idioma del listado, o null si no está
const languageTypeOf = (languages: EntryOption[]) => (ref: Ref) =>
  (findOption(languages, ref)?.data as LanguageData | undefined)?.type ?? null;

// Entrada ligera del listado como entrada completa, para `derive` (solo usa `data` y los nombres)
const asEntry = (o: EntryOption): CatalogEntry => ({
  ...o, description: "", descriptionEs: "", identifier: "", page: null, parent: null, foundry: null,
});

// ---------- piezas de la interfaz ----------

function Description({ entry }: { entry: CatalogEntry | null | undefined }) {
  if (entry === undefined)
    return (
      <p className="mt-2 flex items-center gap-2 text-sm text-muted">
        <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> Cargando descripción…
      </p>
    );
  const text = entry ? entry.descriptionEs || entry.description : "";
  return (
    <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-line bg-surface p-3 text-sm text-muted">
      {entry === null ? "Contenido no disponible." : text ? <Bbcode source={text} /> : "Sin descripción."}
    </div>
  );
}

function packText(p: Pack, cache: Record<string, CatalogEntry | null>, pick: EntryOption | null): string {
  const parts: string[] = [];
  if (p.ref || p.displayName) {
    const e = p.ref ? cache[refKey(p.ref)] : null;
    const name = pick ? nameOf(pick) : e ? nameOf(e) : (p.displayName ?? bareName(p.ref!.key));
    parts.push(p.quantity && p.quantity > 1 ? `${p.quantity}× ${name}` : name);
  }
  if (p.value) parts.push(fmtGold(p.value));
  return parts.join(" + ");
}

function EquipmentChoice({
  name, equipment, value, onChange, cache, picks, items,
}: {
  name: string;
  equipment: Equipment | undefined;
  value: string;
  onChange: (letter: string) => void;
  cache: Record<string, CatalogEntry | null>;
  /** Objetos elegidos en la opción marcada, por índice del paquete, y dónde buscar sus nombres. */
  picks: Record<string, Ref>;
  items: EntryOption[];
}) {
  const options = letters(equipment);
  if (options.length === 0) return <p className="text-sm text-muted">Sin equipo inicial.</p>;
  return (
    <div role="radiogroup" aria-label="Equipo inicial" className="space-y-2">
      {options.map((l) => (
        <label
          key={l}
          className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition-colors ${value === l ? "border-brand bg-brand/10" : "border-line hover:border-brand"}`}
        >
          <input type="radio" name={name} value={l} checked={value === l} onChange={() => onChange(l)} className="mt-0.5 accent-brand" />
          <span>
            <span className="font-semibold">Opción {l}:</span>{" "}
            {equipment![l]
              .map((p, i) => packText(p, cache, value === l && p.choose ? findOption(items, picks[String(i)] ?? null) : null))
              .filter(Boolean).join(", ") || "—"}
          </span>
        </label>
      ))}
    </div>
  );
}

// ---------- componente ----------

/* Asistente de creación de personajes de D&D 2024. Se monta en el navegador para poder recuperar el borrador
   de localStorage antes del primer pintado del formulario. */
export default function CharacterCreator(props: Props) {
  const draftKey = props.recreate
    ? recreateDraftKey(props.recreate.characterId)
    : draftKeyOf(props.systemId, props.campaign?.id);
  const draft = useSyncExternalStore(noSubscribe, () => readDraft(draftKey), () => undefined);
  if (draft === undefined)
    return (
      <p className="flex items-center gap-2 text-muted">
        <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> Cargando…
      </p>
    );
  // Al rehacer sin borrador propio, se empieza por la creación actual
  const start = draft ?? (props.recreate ? JSON.stringify(props.recreate.initial) : null);
  return <CreatorForm key={draftKey} {...props} draftKey={draftKey} draft={start} />;
}

function CreatorForm(props: Props & { draftKey: string; draft: string | null }) {
  const { campaign, draftKey, recreate } = props;
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => parseDraft(props.draft, props));
  const [portrait, setPortrait] = useState<File | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [scrollTick, setScrollTick] = useState(0);
  // Al rehacer, el primer envío pide confirmar que se reinicia el inventario
  const [confirming, setConfirming] = useState(false);

  // Tras crear con éxito, el borrador ya no se vuelve a escribir
  const submitted = useRef(false);

  // Estado de partida del formulario: el vacío, o la creación actual al rehacer
  const [blank] = useState<FormState>(() => (recreate ? parseDraft(JSON.stringify(recreate.initial), props) : emptyForm()));

  // Borrador: se guarda en cada cambio (si el navegador no deja, se sigue sin borrador).
  // Un formulario igual al de partida no deja borrador: se quita la clave. El formulario ya viene del borrador
  // recuperado, así que nunca se borra uno con datos antes de leerlo.
  useEffect(() => {
    if (submitted.current) return;
    try {
      if (isUntouched(form, blank)) localStorage.removeItem(draftKey);
      else localStorage.setItem(draftKey, JSON.stringify(form));
    } catch {
      // almacenamiento no disponible
    }
  }, [form, blank, draftKey]);

  // Tras un envío con errores, se lleva la vista al primero
  useEffect(() => {
    if (scrollTick === 0) return;
    document.querySelector("[data-field-error]")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [scrollTick]);

  // Cambia campos y borra los errores del servidor que ya no aplican
  function update(patch: Partial<FormState>, ...errorKeys: string[]) {
    setForm((f) => ({ ...f, ...patch }));
    if (errorKeys.length)
      setErrors((e) => {
        if (!errorKeys.some((k) => e[k])) return e;
        const next = { ...e };
        for (const k of errorKeys) delete next[k];
        return next;
      });
  }

  // ---- opciones elegidas ----
  const speciesOpt = findOption(props.species, form.species);
  const speciesData = speciesOpt?.data as SpeciesData | undefined;
  const lineageOptions = useMemo(
    () => (form.species ? (props.lineages[refKey(form.species)] ?? []) : []),
    [form.species, props.lineages],
  );
  const bgOpt = findOption(props.backgrounds, form.background);
  const bgData = bgOpt?.data as BackgroundData | undefined;
  const classOpt = findOption(props.classes, form.klass);
  const classData = classOpt?.data as ClassData | undefined;
  const hasLineages = !!speciesData?.hasLineages && lineageOptions.length > 0;

  // Habilidades que ya dan otras fuentes: no se pueden volver a elegir
  const { fixedLocked, classLocked } = useMemo(() => {
    const fixed: Record<string, string> = {};
    for (const s of speciesData?.skills.fixed ?? []) fixed[s] = "especie";
    for (const s of bgData?.skills ?? []) fixed[s] = "trasfondo";
    const forClass: Record<string, string> = { ...fixed };
    for (const s of form.speciesSkills.filter(Boolean)) forClass[s] ??= "especie";
    return { fixedLocked: fixed, classLocked: forClass };
  }, [speciesData, bgData, form.speciesSkills]);
  const lockedHint = (locked: Record<string, string>) =>
    Object.entries(locked).map(([s, from]) => `${skillName(s)} (${from})`).join(", ");

  // ---- entradas que se piden al servidor ----
  const [cacheRefs, setCacheRefs] = useState<Ref[]>([]);
  const cache = useCatalogEntries(cacheRefs, campaign?.id ?? null);
  const equipmentNeeded = useMemo(
    () =>
      equipmentRefs(
        [...Object.values(classData?.equipment ?? {}), ...Object.values(bgData?.equipment ?? {})],
        (k) => cache[k],
      ),
    [classData, bgData, cache],
  );
  // Rasgos de nivel 1 de la clase, sus opciones (Orden divina…) y lo elegido de las listas (para la descripción)
  const featureRefs = useMemo(() => {
    const features = (classData?.features ?? []).filter((f) => f.level === 1).map((f) => f.ref);
    const options = features.flatMap((r) => (cache[refKey(r)]?.data as FeatureData | undefined)?.options ?? []);
    const picked = Object.values(form.classChoices).flat()
      .filter((k) => /^[^:]+:(feat|optionalFeature):/.test(k))
      .map(refFromKey);
    return [...features, ...options, ...picked];
  }, [classData, cache, form.classChoices]);
  const wanted = useMemo(() => {
    const list: Ref[] = [];
    for (const r of [form.species, form.lineage, form.background, form.klass, bgData?.feat ?? null]) if (r) list.push(r);
    return [...list, ...equipmentNeeded, ...featureRefs];
  }, [form.species, form.lineage, form.background, form.klass, bgData, equipmentNeeded, featureRefs]);
  // Solo cambia la lista (y se piden entradas) cuando aparece alguna referencia nueva
  const wantedKey = wanted.map(refKey).sort().join("\n");
  const [lastKey, setLastKey] = useState("");
  if (wantedKey !== lastKey) {
    setLastKey(wantedKey);
    setCacheRefs(wanted);
  }

  const equipmentLoading = equipmentNeeded.some((r) => cache[refKey(r)] === undefined);

  // Entradas para `derive`: las del listado (con `data`) y las cargadas
  const entries = useMemo(() => {
    const map = new Map<string, CatalogEntry>();
    for (const o of [...props.species, ...Object.values(props.lineages).flat(), ...props.classes, ...props.backgrounds])
      map.set(refKey(o.ref), asEntry(o));
    for (const [k, e] of Object.entries(cache)) if (e) map.set(k, e);
    return map;
  }, [props.species, props.lineages, props.classes, props.backgrounds, cache]);

  // Elecciones de nivel 1 de la clase (las mismas que exige el servidor); las de los rasgos aparecen al cargarlos.
  // La de conjuros va en su propia sección
  // (con el truco de más de la opción de rasgo elegida: Taumaturgo, Mago del Druida)
  const allPending = useMemo(() => {
    const base = form.klass ? pendingChoices({ levels: [] }, form.klass, 1, entries) : [];
    const options = base.filter((p) => p.type === "featureOption")
      .flatMap((p) => (form.classChoices[p.source] ?? []).filter(Boolean).map((k) => refFromKey(k).key));
    return withBonusCantrips(base, options);
  }, [form.klass, form.classChoices, entries]);
  const pending = useMemo(() => allPending.filter((p) => p.type !== "spells"), [allPending]);
  const spellPending = allPending.find((p) => p.type === "spells") ?? null;

  // Lanzamiento de la clase de nivel 1: lista y nivel máximo
  const casting = useMemo(() => {
    if (!classData?.spellcasting || !form.klass) return null;
    const { mode, progression } = classData.spellcasting;
    return {
      name: classOpt ? nameOf(classOpt) : "",
      mode,
      listId: spellPending?.spells?.list ?? spellListOf(form.klass, entries.get(refKey(form.klass))?.identifier),
      maxLevel: maxSpellLevel(progression, 1),
    };
  }, [classData, classOpt, form.klass, spellPending, entries]);
  const spellsMissing = spellPending ? spellPickMissing(spellPending, form.spells) : null;
  // Conjuros de la dote del trasfondo (Acólito → Iniciado en la magia) y de las invocaciones elegidas (Pacto del tomo)
  const bgFeat = bgData?.feat ? entries.get(refKey(bgData.feat)) : undefined;
  const bgFeatPending = useMemo(() => (bgFeat
    ? featSpellPending([{ ref: bgFeat.ref, name: nameOf(bgFeat), data: bgFeat.data as FeatData | null }], (l) => l <= 1)[0] ?? null
    : null), [bgFeat]);
  const invocationPending = useMemo(() => featSpellPending(
    pending.filter((p) => p.type === "optionalFeature")
      .flatMap((p) => (form.classChoices[p.source] ?? []).filter(Boolean))
      .flatMap((k) => {
        const o = props.optionalFeatures.find((x) => refKey(x.ref) === k);
        return o ? [{ ref: o.ref, name: nameOf(o), data: o.data as OptionalFeatureData | null }] : [];
      }),
    (l) => l <= 1,
  ), [pending, form.classChoices, props.optionalFeatures]);
  const featPendings = [...(bgFeatPending ? [bgFeatPending] : []), ...invocationPending];
  // Listas de conjuros, bajo demanda: la de la clase elegida y las de las dotes e invocaciones (al rehacer, de los libros
  // del personaje)
  const { spells, status: spellStatus, retry: retrySpells } = useSpellLists(
    recreate ? { characterId: recreate.characterId } : { systemId: props.systemId, books: props.chosenBooks, campaignId: campaign?.id ?? null },
    [...(casting ? [casting.listId] : []), ...featPendings.flatMap(pendingSpellLists)],
  );
  const featSpellsLeft = (p: PendingChoice) =>
    featSpellsMissing(p, form.featSpells[p.source], form.featAbility[p.source] ?? "");
  // Conjuros de nivel 1 que ya da otra cosa (especie, legado, dote del trasfondo, clase): no se eligen
  const baseGranted = useMemo(() => [form.species, form.lineage, bgData?.feat ?? null, form.klass].flatMap((r) => {
    const data = r ? (entries.get(refKey(r))?.data as { spells?: { level: number; ref: Ref }[] } | undefined) : undefined;
    return (data?.spells ?? []).filter((g) => g.level <= 1).map((g) => refKey(g.ref));
  }), [form.species, form.lineage, form.klass, bgData, entries]);
  // Y lo que se elige en otra fuente (la clase o una dote): un mismo conjuro no se elige en dos sitios
  const pickSources = [
    { source: "class", label: "la clase", keys: [...form.spells.cantrips, ...form.spells.spells, ...(form.spells.free ?? [])] },
    ...featPendings.map((p) => {
      const v = form.featSpells[p.source];
      return { source: p.source, label: featNameOfLabel(p.label), keys: v ? [...v.cantrips, ...v.spells, v.replace.in].filter(Boolean) : [] };
    }),
  ];
  const grantedFor = (source: string) => crossSourceGranted(baseGranted, pickSources, source);

  // ---- idiomas ----
  const levels = classLevelsOf(form.klass);
  const slots = languageSlotsFor(levels, props.languages);
  const fixed = fixedLanguages(levels);
  const typeOf = languageTypeOf(props.languages);

  // ---- hoja ----
  const filledBase = (): Record<Ability, number | null> => {
    const def = defaultBase(form.method);
    return Object.fromEntries(ABILITIES.map((a) => [a, form.base[a] ?? def])) as Base;
  };

  const previewSheet = useMemo((): Dnd2024Sheet => {
    const none = { ref: { book: "", key: "" }, name: "" };
    const def = defaultBase(form.method) ?? 10;
    return {
      version: 1,
      species: form.species ? { ref: form.species, name: "" } : none,
      lineage: form.lineage ? { ref: form.lineage, name: "" } : null,
      background: {
        ...(form.background ? { ref: form.background, name: "" } : none),
        abilities: form.bonus as Partial<Record<Ability, 1 | 2>>,
        equipment: equipmentLoading ? "" : form.bgEquipment,
      },
      classes: form.klass
        ? [{
          ref: form.klass, name: "", level: 1, subclass: null,
          skills: (form.classChoices[SKILLS_SOURCE] ?? []).filter(Boolean),
          equipment: equipmentLoading ? "" : form.classEquipment,
        }]
        : [],
      abilityMethod: form.method,
      baseAbilities: Object.fromEntries(ABILITIES.map((a) => [a, form.base[a] ?? def])) as Record<Ability, number>,
      rolls: null,
      speciesChoices: { skills: form.speciesSkills, size: form.size },
      alignment: "", appearance: "", age: "", languages: "", notes: "", xp: 0,
      hp: { max: null, current: null, temp: 0 },
    };
  }, [form, equipmentLoading]);

  const abilitiesValid = totalsWithinLimit(form.base, form.bonus);

  // ---- falta por completar ----
  const missing: MissingItem[] = [];
  if (!form.name.trim()) missing.push({ label: "Nombre", href: S.details });
  if (!form.species) missing.push({ label: "Especie", href: S.details, focusId: "species" });
  if (hasLineages && !form.lineage) missing.push({ label: "Legado", href: S.details, focusId: "lineage" });
  if (speciesData?.skills.choose && form.speciesSkills.filter(Boolean).length !== speciesData.skills.choose.count)
    missing.push({ label: "Habilidades de especie", href: S.details, focusId: "species-skills" });
  if (speciesData && speciesData.size.length > 1 && !form.size) missing.push({ label: "Tamaño", href: S.details, focusId: "size" });
  if (!form.klass) missing.push({ label: "Clase", href: S.details, focusId: "class" });
  if (!form.background) missing.push({ label: "Trasfondo", href: S.background });
  else if (!form.bgEquipment && letters(bgData?.equipment).length) missing.push({ label: "Equipo del trasfondo", href: S.background });
  else
    for (const c of choosePacks(bgData?.equipment, form.bgEquipment))
      if (!form.bgEquipmentPicks[c.index]) missing.push({ label: `Trasfondo: ${c.pack.choose!.label}`, href: S.background });
  for (const p of unfinished(pending, form.classChoices)) missing.push({ label: p.label, href: S.klass });
  if (spellsMissing) missing.push({ label: "Conjuros", href: S.spells });
  for (const p of featPendings) {
    if (featSpellsLeft(p)) missing.push({ label: p.label, href: p === bgFeatPending ? S.background : S.klass });
  }
  if (classData && !form.classEquipment && letters(classData.equipment).length) missing.push({ label: "Equipo de clase", href: S.klass });
  else if (classData)
    for (const c of choosePacks(classData.equipment, form.classEquipment))
      if (!form.classEquipmentPicks[c.index]) missing.push({ label: `Clase: ${c.pack.choose!.label}`, href: S.klass });
  if (form.languageChoices.filter(Boolean).length < languageTotal(slots)) missing.push({ label: "Idiomas", href: S.languages });
  if (Object.values(filledBase()).some((v) => v === null) || !abilitiesValid)
    missing.push({ label: "Puntuaciones de característica", href: S.abilities });
  if (bgData && !checkBackgroundBonus(form.bonus, bgData.abilities))
    missing.push({ label: "Bonificación del trasfondo", href: S.abilities });

  // Índice de secciones tal como se pintan; "pendiente" sale de la misma lista que «Falta por completar»
  const sectionLinks: SectionLink[] = [
    { label: "Detalles", href: S.details },
    ...(!recreate ? [{ label: "Estado", href: S.status }] : []),
    { label: "Trasfondo", href: S.background },
    { label: "Rasgos de clase", href: S.klass },
    ...(casting && form.klass ? [{ label: "Conjuros", href: S.spells }] : []),
    { label: "Idiomas", href: S.languages },
    { label: "Puntuaciones de característica", href: S.abilities },
    ...(!recreate ? [{ label: "Información", href: S.info }] : []),
  ].map((s) => ({
    ...s,
    pending: s.href === S.status || s.href === S.info ? null : missing.some((m) => m.href === s.href),
  }));

  // ---- cambios con efectos en cadena ----
  // Errores de las elecciones de clase (se borran juntos al cambiar algo que les afecta)
  const choiceErrorKeys = () => Object.keys(errors).filter((k) => k.startsWith("levels.0.choices"));
  // Las habilidades que pasa a dar otra fuente dejan de estar elegidas en las elecciones de clase
  const withoutSkills = (values: ChoiceValues, skills: string[]): ChoiceValues => {
    const lower = skills.map((s) => s.toLowerCase());
    return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.map((s) => (lower.includes(s.toLowerCase()) ? "" : s))]));
  };

  function chooseSpecies(ref: Ref | null) {
    if (sameRef(ref, form.species)) return;
    const data = findOption(props.species, ref)?.data as SpeciesData | undefined;
    update(
      { species: ref, lineage: null, speciesSkills: [], size: null, classChoices: withoutSkills(form.classChoices, data?.skills.fixed ?? []) },
      "species", "lineage", "speciesChoices.skills", "speciesChoices.size", ...choiceErrorKeys(),
    );
  }
  function chooseBackground(ref: Ref | null) {
    if (sameRef(ref, form.background)) return;
    const data = findOption(props.backgrounds, ref)?.data as BackgroundData | undefined;
    // Las habilidades de especie y de clase no pueden repetir las del nuevo trasfondo
    const skills = data?.skills ?? [];
    const speciesSkills = form.speciesSkills.map((s) => (skills.includes(s) ? "" : s));
    update(
      {
        background: ref, bonus: {}, bgEquipment: "", bgEquipmentPicks: {}, speciesSkills, classChoices: withoutSkills(form.classChoices, skills),
        // (los de la dote del trasfondo anterior dejan de valer)
        ...withoutFeatSpells(bgFeatPending ? [bgFeatPending.source] : []),
      },
      "background", "background.abilities", "background.equipment", "background.equipmentPicks", "speciesChoices.skills",
      ...choiceErrorKeys(),
    );
  }
  function chooseSpeciesSkills(skills: string[]) {
    // Una habilidad elegida para la especie deja de estar disponible como habilidad de clase
    update(
      { speciesSkills: skills, classChoices: withoutSkills(form.classChoices, skills.filter(Boolean)) },
      "speciesChoices.skills", ...choiceErrorKeys(),
    );
  }
  // Quita los conjuros elegidos con unas dotes o invocaciones (por fuente)
  function withoutFeatSpells(sources: string[]): Pick<FormState, "featSpells" | "featAbility"> {
    const drop = <T,>(r: Record<string, T>) => Object.fromEntries(Object.entries(r).filter(([k]) => !sources.includes(k)));
    return { featSpells: drop(form.featSpells), featAbility: drop(form.featAbility) };
  }
  function chooseClass(ref: Ref | null) {
    if (sameRef(ref, form.klass)) return;
    update(
      {
        klass: ref, classChoices: {}, classEquipment: "", classEquipmentPicks: {}, spells: emptySpellPick(),
        ...withoutFeatSpells(invocationPending.map((p) => p.source)),
        // Los idiomas que ya no valen con la nueva clase (huecos de menos, uno que ya da la clase) se quitan
        languageChoices: pruneLanguages(
          form.languageChoices, languageSlotsFor(classLevelsOf(ref), props.languages), fixedLanguages(classLevelsOf(ref)), typeOf,
        ),
      },
      "classes", "classes.0", "classes.0.level", "classes.0.subclass", "classes.0.equipment", "classes.0.equipmentPicks",
      "languageChoices", ...choiceErrorKeys(),
    );
  }
  const spellErrorKeys = () => ["levels.0.choices", ...(spellPending ? [`levels.0.choices.${spellPending.source}`] : [])];
  function chooseClassOption(source: string, value: string[]) {
    update({ classChoices: { ...form.classChoices, [source]: value } }, "levels.0.choices", `levels.0.choices.${source}`);
  }

  async function requestRolls() {
    const res = await fetch("/api/dice/ability-rolls", { method: "POST" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(data?.values) || typeof data?.token !== "string") throw new Error("tiradas");
    const dice = Array.isArray(data.dice) ? (data.dice as number[][]) : undefined;
    update({ rolls: { values: data.values, token: data.token, ...(dice ? { dice } : {}) } }, "rolls", "baseAbilities");
  }

  // ---- envío ----
  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!abilitiesValid || loading) return;
    setFormError("");
    // Con huecos de idioma sin elegir no se envía: las posiciones de lo elegido se desplazarían
    if (form.languageChoices.filter(Boolean).length < languageTotal(slots)) {
      setErrors((e) => ({ ...e, languageChoices: "Faltan idiomas por elegir." }));
      document.getElementById("idiomas")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (recreate && !confirming) {
      setConfirming(true);
      return;
    }

    const xp = form.xp.trim() === "" ? 0 : Number(form.xp); // NaN viaja como null y el servidor lo rechaza
    const sheet = {
      version: 1,
      species: form.species ? { ref: form.species, name: "" } : null,
      lineage: form.lineage ? { ref: form.lineage, name: "" } : null,
      background: form.background
        ? {
          ref: form.background, name: "", abilities: form.bonus, equipment: form.bgEquipment,
          equipmentPicks: prunePicks(form.bgEquipmentPicks, bgData?.equipment, form.bgEquipment),
        }
        : null,
      classes: [form.klass
        ? {
          ref: form.klass, name: "", level: 1, subclass: null, equipment: form.classEquipment,
          equipmentPicks: prunePicks(form.classEquipmentPicks, classData?.equipment, form.classEquipment),
          choices: [
            ...choicesFor(pending, form.classChoices),
            ...(spellPending ? [spellChoiceOf(spellPending, form.spells)].filter((c) => !!c) : []),
            ...featPendings.flatMap((p) => {
              const c = featSpellsChoiceOf(p, form.featSpells[p.source], form.featAbility[p.source] ?? "");
              return c ? [c] : [];
            }),
          ],
        }
        : null],
      abilityMethod: form.method,
      baseAbilities: filledBase(),
      rolls: form.method === "roll" ? form.rolls : null,
      speciesChoices: { skills: form.speciesSkills.filter(Boolean), size: form.size },
      alignment: form.alignment,
      appearance: form.appearance,
      age: form.age,
      languages: form.languages,
      languageChoices: form.languageChoices.filter((r) => !!r),
      notes: form.notes,
      xp,
      hp: { max: null, current: null, temp: 0 },
    };

    const fd = new FormData();
    fd.set("system", props.systemId);
    fd.set("name", form.name.trim());
    fd.set("pronouns", form.pronouns.join(","));
    fd.set("status", form.status);
    fd.set("campaign", campaign?.id ?? "");
    fd.set("books", props.chosenBooks.join(","));
    fd.set("backstory", form.backstory);
    fd.set("sheet", JSON.stringify(sheet));
    if (portrait) fd.set("portrait", portrait);
    if (image) fd.set("image", image);

    setLoading(true);
    try {
      const res = recreate
        ? await fetch(`/api/characters/${recreate.characterId}/creation`, { method: "PUT", body: fd })
        : await fetch("/api/characters", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setConfirming(false);
        if (data?.errors) {
          setErrors(data.errors);
          setScrollTick((t) => t + 1);
        } else setFormError(data?.error ?? `El servidor ha respondido con un error (${res.status}).`);
        return;
      }
      submitted.current = true;
      try {
        localStorage.removeItem(draftKey);
        // Las tiradas son de un solo personaje: los borradores de otras campañas del sistema las pierden
        // (si no, el siguiente personaje empezaría con ellas). Al rehacer no se tocan.
        if (!recreate) {
          const prefix = `roll2go:new-character:${props.systemId}:`;
          for (const key of Object.keys(localStorage).filter((k) => k.startsWith(prefix))) {
            const clean = draftWithoutRolls(localStorage.getItem(key) ?? "");
            if (clean !== null) localStorage.setItem(key, clean);
          }
        }
      } catch {
        // almacenamiento no disponible
      }
      router.push(recreate ? `/characters/${recreate.characterId}?saved=creation` : `/characters/${data.id}`);
      router.refresh();
    } catch {
      setConfirming(false);
      setFormError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  // Conjuros de una dote o invocación (en la sección de la que sale: trasfondo o clase)
  const featSpellsSection = (p: PendingChoice, id: string) => {
    const errorKey = `levels.0.choices.${p.source}`;
    const ready = spellStatus(pendingSpellLists(p));
    return (
      <div key={p.source} className="mt-5 animate-fade-in">
        <h3 className="mb-3 font-heading text-lg font-bold">{p.label}</h3>
        {ready !== "ready" ? <SpellListsStatus error={ready === "error"} onRetry={retrySpells} /> : <FeatSpellsStep
          id={id}
          p={p}
          spells={spells}
          granted={grantedFor(p.source)}
          value={form.featSpells[p.source] ?? emptySpellPick()}
          onChange={(v) => update({ featSpells: { ...form.featSpells, [p.source]: v } }, errorKey)}
          ability={form.featAbility[p.source] ?? ""}
          onAbility={(a) => update({ featAbility: { ...form.featAbility, [p.source]: a } }, errorKey)}
          characterId={recreate?.characterId ?? null}
          campaignId={campaign?.id ?? null}
        />}
        <FieldError errors={errors} keys={[errorKey]} />
      </div>
    );
  };

  // Errores sin un campo propio en el formulario: se muestran junto al botón
  // (el legado solo tiene campo si la especie tiene legados; las elecciones de clase, en su sección)
  // (al rehacer no están las secciones de campaña, imágenes, estado ni información)
  const shown = (k: string) =>
    k === "lineage"
      ? hasLineages
      : (SHOWN_ERRORS.has(k) && !(recreate && NOT_ON_RECREATE.has(k))) || k.startsWith("levels.0.choices");
  const generalErrors = Object.entries(errors).filter(([k]) => !shown(k));
  const errorCount = Object.keys(errors).length;
  const classIdentifier = form.klass ? (cache[refKey(form.klass)]?.identifier || bareName(form.klass.key)) : null;
  const speciesIdentifier = form.species ? (cache[refKey(form.species)]?.identifier || bareName(form.species.key)) : "";
  const section = (i: number) => ({ className: `${card} animate-fade-up scroll-mt-24`, style: { animationDelay: `${i * 50}ms` } });

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-6">
        {/* Índice plegable en móvil; en escritorio va en la columna Resumen */}
        <details className="rounded-lg border border-line bg-panel px-4 py-3 lg:hidden">
          <summary className="cursor-pointer text-sm font-semibold">Secciones</summary>
          <div className="mt-2">
            <SectionIndex sections={sectionLinks} />
          </div>
        </details>

        {/* 1. Detalles */}
        <section id="detalles" {...section(0)}>
          <h2 className={cardTitle}>Detalles</h2>
          <div className="space-y-5">
            <div>
              <label htmlFor="name" className={labelClass}>Nombre *</label>
              <div className="flex flex-wrap items-start gap-2">
                <input
                  id="name"
                  className={`${field} min-w-0 flex-1`}
                  maxLength={LIMITS.name}
                  value={form.name}
                  onChange={(e) => update({ name: e.target.value }, "name")}
                />
                <NameGeneratorButton
                  species={speciesIdentifier}
                  pronouns={form.pronouns}
                  onName={(name) => update({ name }, "name")}
                />
              </div>
              <FieldError errors={errors} keys={["name"]} />
            </div>

            <div>
              <PronounsField value={form.pronouns} onChange={(pronouns) => update({ pronouns }, "pronouns")} />
              <FieldError errors={errors} keys={["pronouns"]} />
            </div>

            <div>
              <RuleSelect id="species" label="Especie" options={props.species} value={form.species} onChange={chooseSpecies} />
              <FieldError errors={errors} keys={["species"]} />
              {form.species && <Description entry={cache[refKey(form.species)]} />}
            </div>

            {hasLineages && (
              <div className="animate-fade-in">
                <RuleSelect
                  id="lineage"
                  label="Legado"
                  options={lineageOptions}
                  value={form.lineage}
                  onChange={(ref) => update({ lineage: ref }, "lineage")}
                />
                <FieldError errors={errors} keys={["lineage"]} />
                {form.lineage && <Description entry={cache[refKey(form.lineage)]} />}
              </div>
            )}

            {speciesData?.skills.choose && (
              <div>
                <SkillPicker
                  id="species-skills"
                  label="Habilidades de especie"
                  count={speciesData.skills.choose.count}
                  options={speciesData.skills.choose.from
                    .filter((s) => fixedLocked[s] === undefined)
                    .map((s) => ({ id: s, label: skillName(s) }))}
                  value={form.speciesSkills}
                  onChange={chooseSpeciesSkills}
                  hint={Object.keys(fixedLocked).length ? `Ya tienes: ${lockedHint(fixedLocked)}.` : undefined}
                />
                <FieldError errors={errors} keys={["speciesChoices.skills"]} />
              </div>
            )}

            {speciesData && speciesData.size.length > 1 && (
              <div>
                <label htmlFor="size" className={labelClass}>Tamaño</label>
                <select
                  id="size"
                  className={field}
                  value={form.size ?? ""}
                  onChange={(e) => update({ size: (e.target.value || null) as Size | null }, "speciesChoices.size")}
                >
                  <option value="">Elige un tamaño…</option>
                  {speciesData.size.map((s) => <option key={s} value={s}>{sizeName(s)}</option>)}
                </select>
                <FieldError errors={errors} keys={["speciesChoices.size"]} />
              </div>
            )}

            <div>
              <div className="flex items-end gap-3">
                <div className="min-w-0 flex-1">
                  <RuleSelect id="class" label="Escoger clase inicial" options={props.classes} value={form.klass} onChange={chooseClass} />
                </div>
                <RoundIcon kind="class" id={classIdentifier} label={classOpt ? (classOpt.nameEs ?? classOpt.name) : ""} size={46} />
              </div>
              <FieldError errors={errors} keys={["classes", "classes.0", "classes.0.level", "classes.0.subclass"]} />
              {form.klass && <Description entry={cache[refKey(form.klass)]} />}
            </div>

            {!recreate && (
              <>
                <div>
                  <label htmlFor="campaign" className={labelClass}>Campaña</label>
                  <input id="campaign" className={field} value={campaign?.name ?? "Sin campaña"} readOnly disabled />
                  <FieldError errors={errors} keys={["campaign"]} />
                </div>

                <ImageFields errors={errors} onPortrait={setPortrait} onImage={setImage} />
              </>
            )}
          </div>
        </section>

        {/* 2. Estado */}
        {!recreate && (
          <section id="estado" {...section(1)}>
            <h2 className={cardTitle}>Estado</h2>
            <StatusField value={form.status} onChange={(status) => update({ status }, "status")} errors={errors} />
          </section>
        )}

        {/* 3. Trasfondo */}
        <section id="trasfondo" {...section(2)}>
          <h2 className={cardTitle}>Trasfondo</h2>
          <RuleSelect id="background" label="Trasfondo" options={props.backgrounds} value={form.background} onChange={chooseBackground} />
          <FieldError errors={errors} keys={["background"]} />
          {form.background && <Description entry={cache[refKey(form.background)]} />}
          {bgData && (
            <>
              <dl className="mt-4 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
                <dt className="font-semibold">Características</dt>
                <dd className="text-muted">{bgData.abilities.map((a) => ABILITY_NAMES[a]).join(", ") || "—"}</dd>
                <dt className="font-semibold">Dote</dt>
                <dd className="text-muted">
                  {(() => {
                    const feat = cache[refKey(bgData.feat)];
                    return feat ? nameOf(feat) : bareName(bgData.feat.key);
                  })()}
                </dd>
                <dt className="font-semibold">Habilidades</dt>
                <dd className="text-muted">{bgData.skills.map(skillName).join(", ") || "—"}</dd>
                <dt className="font-semibold">Herramientas</dt>
                <dd className="text-muted">{bgData.tools.map(toolName).join(", ") || "—"}</dd>
              </dl>
              <h3 className="mb-2 mt-5 text-sm font-semibold">Equipo inicial</h3>
              <EquipmentChoice
                name="bg-equipment"
                equipment={bgData.equipment}
                value={form.bgEquipment}
                onChange={(l) => update({ bgEquipment: l, bgEquipmentPicks: {} }, "background.equipment", "background.equipmentPicks")}
                cache={cache}
                picks={form.bgEquipmentPicks}
                items={props.choiceItems}
              />
              <EquipmentPicks
                idPrefix="bg-pick"
                equipment={bgData.equipment}
                letter={form.bgEquipment}
                picks={form.bgEquipmentPicks}
                onChange={(bgEquipmentPicks) => update({ bgEquipmentPicks }, "background.equipmentPicks")}
                items={props.choiceItems}
              />
            </>
          )}
          <FieldError errors={errors} keys={["background.equipment", "background.equipmentPicks"]} />
          {bgFeatPending && featSpellsSection(bgFeatPending, "creator-feat-spells")}
        </section>

        {/* 4. Clase */}
        <section id="clase" {...section(3)}>
          <h2 className={cardTitle}>Rasgos de clase</h2>
          {!classData ? (
            <p className="text-sm text-muted">
              Elige una clase en <a href={S.details} className="text-brand-soft hover:underline">Detalles</a>.
            </p>
          ) : (
            <div className="space-y-5">
              <ClassFeaturesSection
                classData={classData}
                pending={pending}
                values={form.classChoices}
                onChange={chooseClassOption}
                cache={cache}
                takenSkills={classLocked}
                feats={props.feats}
                optionalFeatures={props.optionalFeatures}
                weapons={props.weapons}
                errors={errors}
              />
              {invocationPending.map((p, i) => featSpellsSection(p, `creator-invocation-spells-${i}`))}
              <div>
                <h3 className="mb-2 text-sm font-semibold">Equipo inicial</h3>
                <EquipmentChoice
                  name="class-equipment"
                  equipment={classData.equipment}
                  value={form.classEquipment}
                  onChange={(l) => update({ classEquipment: l, classEquipmentPicks: {} }, "classes.0.equipment", "classes.0.equipmentPicks")}
                  cache={cache}
                  picks={form.classEquipmentPicks}
                  items={props.choiceItems}
                />
                <EquipmentPicks
                  idPrefix="class-pick"
                  equipment={classData.equipment}
                  letter={form.classEquipment}
                  picks={form.classEquipmentPicks}
                  onChange={(classEquipmentPicks) => update({ classEquipmentPicks }, "classes.0.equipmentPicks")}
                  items={props.choiceItems}
                />
              </div>
            </div>
          )}
          <FieldError errors={errors} keys={["classes.0.equipment", "classes.0.equipmentPicks"]} />
        </section>

        {/* 5. Conjuros */}
        {casting && form.klass && (
          <section id="conjuros" {...section(4)}>
            <h2 className={cardTitle}>Conjuros</h2>
            <p className="mb-3 text-sm text-muted">Prepararás tus conjuros desde la pestaña Conjuros de la ficha.</p>
            {spellPending && (spellStatus([casting.listId]) !== "ready" ? (
              <SpellListsStatus error={spellStatus([casting.listId]) === "error"} onRetry={retrySpells} />
            ) : <SpellsStep
              id="creator-spells"
              casterName={casting.name}
              mode={casting.mode}
              listId={casting.listId}
              maxLevel={casting.maxLevel}
              pending={spellPending}
              spells={spells}
              held={NO_SPELLS}
              granted={grantedFor("class")}
              value={form.spells}
              onChange={(spells) => update({ spells }, ...spellErrorKeys())}
              characterId={recreate?.characterId ?? null}
              campaignId={campaign?.id ?? null}
            />)}
            <FieldError errors={errors} keys={spellPending ? [`levels.0.choices.${spellPending.source}`] : []} />
          </section>
        )}

        {/* 6. Idiomas */}
        <section id="idiomas" {...section(5)}>
          <h2 className={cardTitle}>Idiomas</h2>
          <LanguagesSection
            fixed={fixed}
            slots={slots}
            languages={props.languages}
            choices={form.languageChoices}
            onChange={(languageChoices) => update({ languageChoices }, "languageChoices")}
            legacyText={form.languages}
          />
          <FieldError errors={errors} keys={["languageChoices"]} />
        </section>

        {/* 7. Puntuaciones de característica */}
        <section id="caracteristicas" {...section(6)}>
          <h2 className={cardTitle}>Puntuaciones de característica</h2>
          <AbilityScores
            method={form.method}
            base={form.base}
            rolls={form.rolls?.values ?? null}
            rollDice={form.rolls?.dice ?? null}
            backgroundAbilities={bgData?.abilities ?? []}
            backgroundBonus={form.bonus}
            onChange={(n) =>
              update({ method: n.method, base: n.base, bonus: n.backgroundBonus }, "abilityMethod", "baseAbilities", "rolls", "background.abilities")
            }
            onRequestRolls={requestRolls}
          />
          {!bgData && <p className="mt-2 text-xs text-muted">Elige un trasfondo para repartir su bonificación.</p>}
          <FieldError errors={errors} keys={["abilityMethod", "baseAbilities", "rolls", "background.abilities"]} />
        </section>

        {/* 8. Información */}
        {!recreate && (
          <section id="informacion" {...section(7)}>
            <h2 className={cardTitle}>Información</h2>
            <InfoFields values={form} errors={errors} onChange={update} hideLanguages />
          </section>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3">
          {generalErrors.map(([k, msg]) => (
            <p key={k} className={errorClass} role="alert" data-field-error>{msg}</p>
          ))}
          {formError && <p className={errorClass} role="alert">{formError}</p>}
          {!abilitiesValid && <p className="text-sm text-danger">Ninguna característica puede superar 20.</p>}
          {confirming && (
            <p role="alert" className="flex animate-fade-in items-center gap-2 text-sm text-danger">
              <TriangleAlert size={16} aria-hidden="true" /> Se reiniciará el inventario con el equipo inicial elegido y se vaciarán los conjuros preparados.
            </p>
          )}
          {confirming && (
            <button type="button" onClick={() => setConfirming(false)} disabled={loading} className="text-sm text-muted hover:text-white disabled:opacity-50">
              Cancelar
            </button>
          )}
          <button type="submit" disabled={loading || !abilitiesValid} className={primaryButton}>
            {loading && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
            {!recreate ? "Crear personaje" : confirming ? "Sí, rehacer" : "Rehacer creación"}
            {errorCount > 0 && (
              <span className="rounded-full bg-white/20 px-2 text-xs">
                {errorCount} {errorCount === 1 ? "problema" : "problemas"}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Si índice y resumen no caben en la altura de la ventana, la columna se desplaza por dentro */}
      <div className="lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto">
        <CharacterSummary
          sections={sectionLinks}
          sheet={previewSheet}
          entries={entries}
          hasSpecies={!!form.species}
          hasClass={!!form.klass}
          equipmentLoading={equipmentLoading && !!(form.bgEquipment || form.classEquipment)}
          missing={missing}
        />
      </div>
    </form>
  );
}

// Errores que se muestran junto a su campo; el resto va junto al botón de crear
const SHOWN_ERRORS = new Set([
  "name", "species", "lineage", "speciesChoices.skills", "speciesChoices.size",
  "classes", "classes.0", "classes.0.level", "classes.0.subclass", "campaign", "portrait", "image",
  "status", "pronouns", "background", "background.equipment", "classes.0.equipment",
  "abilityMethod", "baseAbilities", "rolls", "background.abilities",
  "background.equipmentPicks", "classes.0.equipmentPicks", "languageChoices",
  "alignment", "age", "xp", "appearance", "backstory", "notes",
]);

// Campos que no aparecen al rehacer la creación
const NOT_ON_RECREATE = new Set([
  "campaign", "portrait", "image", "status", "alignment", "age", "xp", "appearance", "backstory", "notes",
]);
