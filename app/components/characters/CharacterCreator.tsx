"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import Bbcode from "@/app/components/Bbcode";
import { card, cardTitle, errorClass, field, labelClass, primaryButton } from "@/app/components/formStyles";
import type { CatalogEntry, EntryOption, SpellOption } from "@/lib/rules/catalog";
import {
  ABILITIES, type Ability, type BackgroundData, type ClassData, type Equipment, type FeatData, type FeatureData, type Pack,
  type Ref, type SpeciesData,
} from "@/lib/rules/types";
import type { AbilityMethod, Dnd2024Sheet } from "@/lib/rules/dnd2024/sheet";
import { checkBackgroundBonus } from "@/lib/rules/dnd2024/abilities";
import { totalsWithinLimit } from "@/lib/rules/dnd2024/assign";
import { bareName, equipmentRefs, refKey } from "@/lib/rules/dnd2024/equipmentRefs";
import { ABILITY_NAMES, sizeName, skillName, toolName } from "@/lib/rules/dnd2024/labels";
import { featSpellPending } from "@/lib/rules/dnd2024/featSpells";
import { pendingChoices, withBonusCantrips } from "@/lib/rules/dnd2024/levels";
import { maxSpellLevel, preparedKey, spellListOf } from "@/lib/rules/dnd2024/spellcasting";
import {
  emptySpellPick, featSpellsChoiceOf, featSpellsMissing, parseSpellPick, spellChoiceOf, spellPickMissing, type SpellPick,
} from "@/lib/rules/dnd2024/spellPicks";
import { PRONOUNS, type Pronoun } from "@/lib/rules/dnd2024/names";
import type { CreationDraft } from "@/lib/rules/dnd2024/recreate";
import { SKILLS_SOURCE } from "@/lib/rules/dnd2024/upgrade";
import AbilityScores from "./AbilityScores";
import CharacterSummary, { type MissingItem } from "./CharacterSummary";
import RoundIcon from "../RoundIcon";
import ClassFeaturesSection, { choicesFor, refFromKey, unfinished, type ChoiceValues } from "./ClassFeaturesSection";
import NameGeneratorButton from "./NameGeneratorButton";
import RuleSelect from "./RuleSelect";
import FieldError from "./fields/FieldError";
import ImageFields from "./fields/ImageFields";
import InfoFields from "./fields/InfoFields";
import PronounsField from "./fields/PronounsField";
import SkillPicker from "./fields/SkillPicker";
import FeatSpellsStep from "./levelup/steps/FeatSpellsStep";
import SpellsStep from "./levelup/steps/SpellsStep";
import useCatalogEntries from "./useCatalogEntries";
import StatusField from "./fields/StatusField";
import { LIMITS, STATUSES, type Status } from "./fields/constants";

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
  klass: Ref | null;
  /** Elecciones de nivel 1 de la clase (habilidades incluidas), por `source` de `pendingChoices`. */
  classChoices: ChoiceValues;
  classEquipment: string;
  /** Trucos y conjuros iniciales (o libro del Mago) y preparados iniciales (`libro:clave`). */
  spells: SpellPick;
  prepared: string[];
  /** Conjuros de la dote del trasfondo (Iniciado en la magia…) y su característica de lanzamiento. */
  featSpells: SpellPick;
  featAbility: Ability | "";
  method: AbilityMethod;
  base: Base;
  rolls: Rolls | null;
  alignment: string;
  appearance: string;
  age: string;
  backstory: string;
  languages: string;
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
  /** Conjuros de los libros (sin descripción), para la sección Conjuros. */
  spells: SpellOption[];
  /**
   * Rehacer la creación de un personaje de nivel 1: se precarga con su creación actual (si no hay borrador propio) y
   * se guarda con `PUT /api/characters/[id]/creation`. Sin campaña, imágenes, estado ni información (no cambian).
   */
  recreate?: { characterId: string; initial: CreationDraft };
};

const emptyForm = (): FormState => ({
  name: "", pronouns: [], status: "active",
  species: null, lineage: null, speciesSkills: [], size: null,
  background: null, bonus: {}, bgEquipment: "",
  klass: null, classChoices: {}, classEquipment: "", spells: emptySpellPick(), prepared: [],
  featSpells: emptySpellPick(), featAbility: "",
  method: "pointBuy", base: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }, rolls: null,
  alignment: "", appearance: "", age: "", backstory: "", languages: "", notes: "", xp: "",
});

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
  klass: "#clase", spells: "#conjuros", abilities: "#caracteristicas", info: "#informacion",
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
function parseDraft(raw: string | null, props: Props): FormState {
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
  if (form.klass) {
    form.spells = parseSpellPick(d.spells);
    form.prepared = [...new Set(strings(d.prepared).filter(Boolean))];
  }
  if (form.background) {
    form.featSpells = parseSpellPick(d.featSpells);
    form.featAbility = ABILITIES.includes(d.featAbility as Ability) ? (d.featAbility as Ability) : "";
  }
  if (!form.background) form.bgEquipment = "";
  if (!form.klass) form.classEquipment = "";
  return form;
}

// Entrada ligera del listado como entrada completa, para `derive` (solo usa `data` y los nombres)
const asEntry = (o: EntryOption): CatalogEntry => ({
  ...o, description: "", descriptionEs: "", identifier: "", parent: null, foundry: null,
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

function packText(p: Pack, cache: Record<string, CatalogEntry | null>): string {
  const parts: string[] = [];
  if (p.ref || p.displayName) {
    const e = p.ref ? cache[refKey(p.ref)] : null;
    const name = e ? nameOf(e) : (p.displayName ?? bareName(p.ref!.key));
    parts.push(p.quantity && p.quantity > 1 ? `${p.quantity}× ${name}` : name);
  }
  if (p.value) parts.push(fmtGold(p.value));
  return parts.join(" + ");
}

function EquipmentChoice({
  name, equipment, value, onChange, cache,
}: {
  name: string;
  equipment: Equipment | undefined;
  value: string;
  onChange: (letter: string) => void;
  cache: Record<string, CatalogEntry | null>;
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
            {equipment![l].map((p) => packText(p, cache)).filter(Boolean).join(", ") || "—"}
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
  return <CreatorForm {...props} draftKey={draftKey} draft={start} />;
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

  // Borrador: se guarda en cada cambio (si el navegador no deja, se sigue sin borrador)
  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(form));
    } catch {
      // almacenamiento no disponible
    }
  }, [form, draftKey]);

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
  const pending = allPending.filter((p) => p.type !== "spells");
  const spellPending = allPending.find((p) => p.type === "spells") ?? null;

  // Lanzamiento de la clase de nivel 1: lista, nivel máximo y preparados iniciales (modos `list` y `spellbook`)
  const casting = useMemo(() => {
    if (!classData?.spellcasting || !form.klass) return null;
    const { mode, progression } = classData.spellcasting;
    return {
      name: classOpt ? nameOf(classOpt) : "",
      mode,
      listId: spellPending?.spells?.list ?? spellListOf(form.klass, entries.get(refKey(form.klass))?.identifier),
      maxLevel: maxSpellLevel(progression, 1),
      preparedLimit: mode === "levelUp" ? 0 : (classData.progressions.prepared?.[0] ?? 0),
      always: (classData.spells ?? []).filter((s) => s.level <= 1).map((s) => refKey(s.ref)),
    };
  }, [classData, classOpt, form.klass, spellPending, entries]);
  const spellsMissing = spellPending ? spellPickMissing(spellPending, form.spells) : null;
  // Conjuros de la dote del trasfondo (Acólito → Iniciado en la magia)
  const bgFeat = bgData?.feat ? entries.get(refKey(bgData.feat)) : undefined;
  const featPending = useMemo(() => (bgFeat
    ? featSpellPending([{ ref: bgFeat.ref, name: nameOf(bgFeat), data: bgFeat.data as FeatData | null }], (l) => l <= 1)[0] ?? null
    : null), [bgFeat]);
  const featSpellsLeft = featPending ? featSpellsMissing(featPending, form.featSpells, form.featAbility) : null;
  // Conjuros de nivel 1 que ya da otra cosa (especie, legado, dote del trasfondo, clase): no se eligen
  const grantedSpells = useMemo(() => [form.species, form.lineage, bgData?.feat ?? null, form.klass].flatMap((r) => {
    const data = r ? (entries.get(refKey(r))?.data as { spells?: { level: number; ref: Ref }[] } | undefined) : undefined;
    return (data?.spells ?? []).filter((g) => g.level <= 1).map((g) => refKey(g.ref));
  }), [form.species, form.lineage, form.klass, bgData, entries]);

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
  if (!form.species) missing.push({ label: "Especie", href: S.details });
  if (hasLineages && !form.lineage) missing.push({ label: "Legado", href: S.details });
  if (speciesData?.skills.choose && form.speciesSkills.filter(Boolean).length !== speciesData.skills.choose.count)
    missing.push({ label: "Habilidades de especie", href: S.details });
  if (speciesData && speciesData.size.length > 1 && !form.size) missing.push({ label: "Tamaño", href: S.details });
  if (!form.klass) missing.push({ label: "Clase", href: S.details });
  if (!form.background) missing.push({ label: "Trasfondo", href: S.background });
  else if (!form.bgEquipment && letters(bgData?.equipment).length) missing.push({ label: "Equipo del trasfondo", href: S.background });
  for (const p of unfinished(pending, form.classChoices)) missing.push({ label: p.label, href: S.klass });
  if (spellsMissing) missing.push({ label: "Conjuros", href: S.spells });
  if (featPending && featSpellsLeft) missing.push({ label: featPending.label, href: S.background });
  if (classData && !form.classEquipment && letters(classData.equipment).length) missing.push({ label: "Equipo de clase", href: S.klass });
  if (Object.values(filledBase()).some((v) => v === null) || !abilitiesValid)
    missing.push({ label: "Puntuaciones de característica", href: S.abilities });
  if (bgData && !checkBackgroundBonus(form.bonus, bgData.abilities))
    missing.push({ label: "Bonificación del trasfondo", href: S.abilities });

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
        background: ref, bonus: {}, bgEquipment: "", speciesSkills, classChoices: withoutSkills(form.classChoices, skills),
        featSpells: emptySpellPick(), featAbility: "",
      },
      "background", "background.abilities", "background.equipment", "speciesChoices.skills", ...choiceErrorKeys(),
    );
  }
  function chooseSpeciesSkills(skills: string[]) {
    // Una habilidad elegida para la especie deja de estar disponible como habilidad de clase
    update(
      { speciesSkills: skills, classChoices: withoutSkills(form.classChoices, skills.filter(Boolean)) },
      "speciesChoices.skills", ...choiceErrorKeys(),
    );
  }
  function chooseClass(ref: Ref | null) {
    if (sameRef(ref, form.klass)) return;
    update(
      { klass: ref, classChoices: {}, classEquipment: "", spells: emptySpellPick(), prepared: [] },
      "classes", "classes.0", "classes.0.level", "classes.0.subclass", "classes.0.equipment", "prepared", ...choiceErrorKeys(),
    );
  }
  const spellErrorKeys = () => ["levels.0.choices", ...(spellPending ? [`levels.0.choices.${spellPending.source}`] : []), "prepared"];
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
    if (recreate && !confirming) {
      setConfirming(true);
      return;
    }

    const xp = form.xp.trim() === "" ? 0 : Number(form.xp); // NaN viaja como null y el servidor lo rechaza
    const sheet = {
      version: 1,
      species: form.species ? { ref: form.species, name: "" } : null,
      lineage: form.lineage ? { ref: form.lineage, name: "" } : null,
      background: form.background ? { ref: form.background, name: "", abilities: form.bonus, equipment: form.bgEquipment } : null,
      classes: [form.klass
        ? {
          ref: form.klass, name: "", level: 1, subclass: null, equipment: form.classEquipment,
          choices: [
            ...choicesFor(pending, form.classChoices),
            ...(spellPending ? [spellChoiceOf(spellPending, form.spells)].filter((c) => !!c) : []),
            ...(featPending ? [featSpellsChoiceOf(featPending, form.featSpells, form.featAbility)] : []),
          ],
        }
        : null],
      // Preparados iniciales de la clase (solo los modos que preparan)
      prepared: form.klass && casting && casting.preparedLimit > 0 && form.prepared.length
        ? { [preparedKey(form.klass)]: form.prepared.map(refFromKey) }
        : null,
      abilityMethod: form.method,
      baseAbilities: filledBase(),
      rolls: form.method === "roll" ? form.rolls : null,
      speciesChoices: { skills: form.speciesSkills.filter(Boolean), size: form.size },
      alignment: form.alignment,
      appearance: form.appearance,
      age: form.age,
      languages: form.languages,
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
      try {
        localStorage.removeItem(draftKey);
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
                onChange={(l) => update({ bgEquipment: l }, "background.equipment")}
                cache={cache}
              />
            </>
          )}
          <FieldError errors={errors} keys={["background.equipment"]} />
          {featPending && (
            <div className="mt-5 animate-fade-in">
              <h3 className="mb-3 font-heading text-lg font-bold">{featPending.label}</h3>
              <FeatSpellsStep
                id="creator-feat-spells"
                p={featPending}
                spells={props.spells}
                granted={grantedSpells}
                value={form.featSpells}
                onChange={(featSpells) => update({ featSpells }, `levels.0.choices.${featPending.source}`)}
                ability={form.featAbility}
                onAbility={(featAbility) => update({ featAbility }, `levels.0.choices.${featPending.source}`)}
                characterId={recreate?.characterId ?? null}
                campaignId={campaign?.id ?? null}
              />
              <FieldError errors={errors} keys={[`levels.0.choices.${featPending.source}`]} />
            </div>
          )}
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
              <div>
                <h3 className="mb-2 text-sm font-semibold">Equipo inicial</h3>
                <EquipmentChoice
                  name="class-equipment"
                  equipment={classData.equipment}
                  value={form.classEquipment}
                  onChange={(l) => update({ classEquipment: l }, "classes.0.equipment")}
                  cache={cache}
                />
              </div>
            </div>
          )}
          <FieldError errors={errors} keys={["classes.0.equipment"]} />
        </section>

        {/* 5. Conjuros */}
        {casting && form.klass && (
          <section id="conjuros" {...section(4)}>
            <h2 className={cardTitle}>Conjuros</h2>
            <SpellsStep
              id="creator-spells"
              casterName={casting.name}
              mode={casting.mode}
              listId={casting.listId}
              maxLevel={casting.maxLevel}
              pending={spellPending}
              spells={props.spells}
              held={NO_SPELLS}
              granted={grantedSpells}
              value={form.spells}
              onChange={(spells) => update({ spells }, ...spellErrorKeys())}
              prepared={casting.preparedLimit > 0
                ? {
                  limit: casting.preparedLimit,
                  value: form.prepared,
                  always: casting.always,
                  onChange: (prepared) => update({ prepared }, ...spellErrorKeys()),
                }
                : undefined}
              characterId={recreate?.characterId ?? null}
              campaignId={campaign?.id ?? null}
            />
            <FieldError errors={errors} keys={[...(spellPending ? [`levels.0.choices.${spellPending.source}`] : []), "prepared"]} />
          </section>
        )}

        {/* 6. Puntuaciones de característica */}
        <section id="caracteristicas" {...section(5)}>
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

        {/* 7. Información */}
        {!recreate && (
          <section id="informacion" {...section(6)}>
            <h2 className={cardTitle}>Información</h2>
            <InfoFields values={form} errors={errors} onChange={update} />
          </section>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3">
          {generalErrors.map(([k, msg]) => (
            <p key={k} className={errorClass} role="alert" data-field-error>{msg}</p>
          ))}
          {formError && <p className={errorClass} role="alert">{formError}</p>}
          {!abilitiesValid && <p className="text-sm text-brand-soft">Ninguna característica puede superar 20.</p>}
          {confirming && (
            <p role="alert" className="flex animate-fade-in items-center gap-2 text-sm text-brand-soft">
              <TriangleAlert size={16} aria-hidden="true" /> Se reiniciará el inventario con el equipo inicial elegido.
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

      <div className="lg:sticky lg:top-20">
        <CharacterSummary
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
  "alignment", "age", "xp", "appearance", "backstory", "languages", "notes", "prepared",
]);

// Campos que no aparecen al rehacer la creación
const NOT_ON_RECREATE = new Set([
  "campaign", "portrait", "image", "status", "alignment", "age", "xp", "appearance", "backstory", "languages", "notes",
]);
