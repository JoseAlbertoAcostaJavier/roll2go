"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import BbcodeEditor from "@/app/components/BbcodeEditor";
import Bbcode from "@/app/components/Bbcode";
import { ImagePicker } from "@/app/components/CampaignForm";
import { CLASS_ICONS } from "@/app/components/icons/classes";
import { card, cardTitle, errorClass, field, labelClass, primaryButton } from "@/app/components/formStyles";
import type { CatalogEntry, EntryOption } from "@/lib/rules/catalog";
import { ABILITIES, type Ability, type BackgroundData, type ClassData, type Equipment, type Pack, type Ref, type SpeciesData } from "@/lib/rules/types";
import type { AbilityMethod, Dnd2024Sheet } from "@/lib/rules/dnd2024/sheet";
import { checkBackgroundBonus } from "@/lib/rules/dnd2024/abilities";
import { totalsWithinLimit } from "@/lib/rules/dnd2024/assign";
import { ALIGNMENTS } from "@/lib/rules/dnd2024/alignments";
import { equipmentRefs, refKey } from "@/lib/rules/dnd2024/equipmentRefs";
import { ABILITY_NAMES, sizeName, skillName, toolName } from "@/lib/rules/dnd2024/labels";
import AbilityScores from "./AbilityScores";
import CharacterSummary, { type MissingItem } from "./CharacterSummary";
import RuleSelect from "./RuleSelect";

type Status = "active" | "retired" | "dead";
type Size = "S" | "M" | "L";
type Base = Record<Ability, number | null>;

// Lo que rellena el usuario; se guarda tal cual como borrador (salvo las imágenes)
type FormState = {
  name: string;
  status: Status;
  species: Ref | null;
  lineage: Ref | null;
  speciesSkills: string[];
  size: Size | null;
  background: Ref | null;
  bonus: Partial<Record<Ability, number>>;
  bgEquipment: string;
  klass: Ref | null;
  classSkills: string[];
  classEquipment: string;
  method: AbilityMethod;
  base: Base;
  rolls: { values: number[]; token: string } | null;
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
};

const STATUSES: { id: Status; label: string; description: string }[] = [
  { id: "active", label: "En activo", description: "¡En plena forma! Aparecerás en el listado principal de personajes. ¡Todo listo para la aventura!" },
  { id: "retired", label: "Retirado", description: "Ha colgado las armas. No aparecerá en el listado principal." },
  { id: "dead", label: "Fallecido", description: "Descanse en paz. No aparecerá en el listado principal." },
];

const LIMITS = { name: 80, alignment: 40, appearance: 500, age: 500, languages: 500, notes: 10000 };
const MAX_XP = 355000;
const IMAGE_MB = 2;

const emptyForm = (): FormState => ({
  name: "", status: "active",
  species: null, lineage: null, speciesSkills: [], size: null,
  background: null, bonus: {}, bgEquipment: "",
  klass: null, classSkills: [], classEquipment: "",
  method: "pointBuy", base: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }, rolls: null,
  alignment: "", appearance: "", age: "", backstory: "", languages: "", notes: "", xp: "",
});

// Valor por defecto de una casilla vacía según el método (las fichas de tiradas y predefinidos no tienen)
const defaultBase = (m: AbilityMethod) => (m === "pointBuy" ? 8 : m === "manual" ? 10 : null);

const sameRef = (a: Ref | null, b: Ref | null) => !!a && !!b && a.book === b.book && a.key === b.key;
const findOption = (list: EntryOption[], ref: Ref | null) => (ref ? list.find((o) => sameRef(o.ref, ref)) ?? null : null);
const nameOf = (e: { nameEs: string | null; name: string }) => e.nameEs ?? e.name;
// "item:explorer's pack|xphb" → "explorer's pack"
const bareName = (key: string) => key.replace(/^[^:]*:/, "").split("|")[0];
const letters = (eq: Equipment | undefined) => Object.keys(eq ?? {}).sort();
const fmtGold = (copper: number) => `${(copper / 100).toLocaleString("es-ES", { maximumFractionDigits: 2 })} po`;

// Las secciones del formulario, para los enlaces de "Falta por completar"
const S = {
  details: "#detalles", status: "#estado", background: "#trasfondo",
  klass: "#clase", abilities: "#caracteristicas", info: "#informacion",
} as const;

// ---------- borrador ----------

const draftKeyOf = (systemId: string, campaignId?: string) => `roll2go:new-character:${systemId}:${campaignId ?? "none"}`;
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
  if (isObj(d.rolls) && Array.isArray(d.rolls.values) && d.rolls.values.every((v) => typeof v === "number") && typeof d.rolls.token === "string")
    form.rolls = { values: d.rolls.values as number[], token: d.rolls.token };

  const asRef = (v: unknown): Ref | null =>
    isObj(v) && typeof v.book === "string" && typeof v.key === "string" ? { book: v.book, key: v.key } : null;
  form.species = findOption(props.species, asRef(d.species))?.ref ?? null;
  if (form.species)
    form.lineage = findOption(props.lineages[refKey(form.species)] ?? [], asRef(d.lineage))?.ref ?? null;
  form.background = findOption(props.backgrounds, asRef(d.background))?.ref ?? null;
  form.klass = findOption(props.classes, asRef(d.klass))?.ref ?? null;
  form.speciesSkills = form.species ? strings(d.speciesSkills) : [];
  form.size = ["S", "M", "L"].includes(d.size as string) && form.species ? (d.size as Size) : null;
  form.classSkills = form.klass ? strings(d.classSkills) : [];
  if (!form.background) form.bgEquipment = "";
  if (!form.klass) form.classEquipment = "";
  return form;
}

// ---------- entradas del catálogo pedidas al servidor (descripciones y objetos del equipo) ----------

function useCatalogEntries(refs: Ref[], campaignId: string | null) {
  // undefined = cargando; null = no disponible
  const [cache, setCache] = useState<Record<string, CatalogEntry | null>>({});
  const requested = useRef(new Set<string>());
  useEffect(() => {
    const qs = campaignId ? `?campaign=${encodeURIComponent(campaignId)}` : "";
    for (const ref of refs) {
      const k = refKey(ref);
      if (requested.current.has(k)) continue;
      requested.current.add(k);
      // Las claves llevan ":" y "|": van codificadas en la dirección
      fetch(`/api/rules/entries/${encodeURIComponent(ref.book)}/${encodeURIComponent(ref.key)}${qs}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => setCache((c) => ({ ...c, [k]: (data?.entry as CatalogEntry | undefined) ?? null })))
        .catch(() => setCache((c) => ({ ...c, [k]: null })));
    }
  }, [refs, campaignId]);
  return cache;
}

// Entrada ligera del listado como entrada completa, para `derive` (solo usa `data` y los nombres)
const asEntry = (o: EntryOption): CatalogEntry => ({
  ...o, description: "", descriptionEs: "", identifier: "", parent: null, foundry: null,
});

// ---------- piezas de la interfaz ----------

function FieldError({ errors, keys }: { errors: Record<string, string>; keys: string[] }) {
  const k = keys.find((x) => errors[x]);
  if (!k) return null;
  return <p className={errorClass} role="alert" data-field-error>{errors[k]}</p>;
}

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

function SkillChecks({
  name, from, count, value, onChange, locked = {},
}: {
  name: string;
  from: string[];
  count: number;
  value: string[];
  onChange: (skills: string[]) => void;
  /** Habilidades que ya da otra fuente, con el texto de esa fuente: se muestran desactivadas. */
  locked?: Record<string, string>;
}) {
  const full = value.length >= count;
  return (
    <fieldset>
      <legend className={labelClass}>
        {name} <span className="font-normal text-muted">· elige {count} ({value.length}/{count})</span>
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {from.map((s) => {
          const lockedBy = locked[s];
          const isLocked = lockedBy !== undefined;
          const checked = value.includes(s);
          return (
            <label key={s} className="flex cursor-pointer items-center gap-2 text-sm has-disabled:cursor-not-allowed has-disabled:opacity-50">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand"
                checked={checked}
                disabled={isLocked || (!checked && full)}
                onChange={() => onChange(checked ? value.filter((x) => x !== s) : [...value, s])}
              />
              {skillName(s)}
              {isLocked && <span className="text-xs text-muted">({lockedBy})</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// ---------- componente ----------

/* Asistente de creación de personajes de D&D 2024. Se monta en el navegador para poder recuperar el borrador
   de localStorage antes del primer pintado del formulario. */
export default function CharacterCreator(props: Props) {
  const draftKey = draftKeyOf(props.systemId, props.campaign?.id);
  const draft = useSyncExternalStore(noSubscribe, () => readDraft(draftKey), () => undefined);
  if (draft === undefined)
    return (
      <p className="flex items-center gap-2 text-muted">
        <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> Cargando…
      </p>
    );
  return <CreatorForm {...props} draftKey={draftKey} draft={draft} />;
}

function CreatorForm(props: Props & { draftKey: string; draft: string | null }) {
  const { campaign, draftKey } = props;
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => parseDraft(props.draft, props));
  const [portrait, setPortrait] = useState<File | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [scrollTick, setScrollTick] = useState(0);

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
    for (const s of speciesData?.skills.fixed ?? []) fixed[s] = "de la especie";
    for (const s of bgData?.skills ?? []) fixed[s] = "del trasfondo";
    const forClass: Record<string, string> = { ...fixed };
    for (const s of form.speciesSkills) forClass[s] ??= "de la especie";
    return { fixedLocked: fixed, classLocked: forClass };
  }, [speciesData, bgData, form.speciesSkills]);

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
  const wanted = useMemo(() => {
    const list: Ref[] = [];
    for (const r of [form.species, form.lineage, form.background, form.klass, bgData?.feat ?? null]) if (r) list.push(r);
    return [...list, ...equipmentNeeded];
  }, [form.species, form.lineage, form.background, form.klass, bgData, equipmentNeeded]);
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
        ? [{ ref: form.klass, name: "", level: 1, subclass: null, skills: form.classSkills, equipment: equipmentLoading ? "" : form.classEquipment }]
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
  if (speciesData?.skills.choose && form.speciesSkills.length !== speciesData.skills.choose.count)
    missing.push({ label: "Habilidades de especie", href: S.details });
  if (speciesData && speciesData.size.length > 1 && !form.size) missing.push({ label: "Tamaño", href: S.details });
  if (!form.klass) missing.push({ label: "Clase", href: S.details });
  if (!form.background) missing.push({ label: "Trasfondo", href: S.background });
  else if (!form.bgEquipment && letters(bgData?.equipment).length) missing.push({ label: "Equipo del trasfondo", href: S.background });
  if (classData && form.classSkills.length !== classData.skills.count) missing.push({ label: "Habilidades de clase", href: S.klass });
  if (classData && !form.classEquipment && letters(classData.equipment).length) missing.push({ label: "Equipo de clase", href: S.klass });
  if (Object.values(filledBase()).some((v) => v === null) || !abilitiesValid)
    missing.push({ label: "Puntuaciones de característica", href: S.abilities });
  if (bgData && !checkBackgroundBonus(form.bonus, bgData.abilities))
    missing.push({ label: "Bonificación del trasfondo", href: S.abilities });

  // ---- cambios con efectos en cadena ----
  function chooseSpecies(ref: Ref | null) {
    if (sameRef(ref, form.species)) return;
    const data = findOption(props.species, ref)?.data as SpeciesData | undefined;
    // Las habilidades de clase no pueden repetir las fijas de la nueva especie
    const classSkills = form.classSkills.filter((s) => !data?.skills.fixed.includes(s));
    update(
      { species: ref, lineage: null, speciesSkills: [], size: null, classSkills },
      "species", "lineage", "speciesChoices.skills", "speciesChoices.size", "classes.0.skills",
    );
  }
  function chooseBackground(ref: Ref | null) {
    if (sameRef(ref, form.background)) return;
    const data = findOption(props.backgrounds, ref)?.data as BackgroundData | undefined;
    // Las habilidades de especie y de clase no pueden repetir las del nuevo trasfondo
    const speciesSkills = form.speciesSkills.filter((s) => !data?.skills.includes(s));
    const classSkills = form.classSkills.filter((s) => !data?.skills.includes(s));
    update(
      { background: ref, bonus: {}, bgEquipment: "", speciesSkills, classSkills },
      "background", "background.abilities", "background.equipment", "speciesChoices.skills", "classes.0.skills",
    );
  }
  function chooseSpeciesSkills(skills: string[]) {
    // Una habilidad elegida para la especie deja de estar disponible como habilidad de clase
    const classSkills = form.classSkills.filter((s) => !skills.includes(s));
    update({ speciesSkills: skills, classSkills }, "speciesChoices.skills", "classes.0.skills");
  }
  function chooseClass(ref: Ref | null) {
    if (sameRef(ref, form.klass)) return;
    update({ klass: ref, classSkills: [], classEquipment: "" }, "classes", "classes.0", "classes.0.level", "classes.0.subclass", "classes.0.skills", "classes.0.equipment");
  }

  async function requestRolls() {
    const res = await fetch("/api/dice/ability-rolls", { method: "POST" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(data?.values) || typeof data?.token !== "string") throw new Error("tiradas");
    update({ rolls: { values: data.values, token: data.token } }, "rolls", "baseAbilities");
  }

  // ---- envío ----
  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!abilitiesValid || loading) return;
    setFormError("");

    const xp = form.xp.trim() === "" ? 0 : Number(form.xp); // NaN viaja como null y el servidor lo rechaza
    const sheet = {
      version: 1,
      species: form.species ? { ref: form.species, name: "" } : null,
      lineage: form.lineage ? { ref: form.lineage, name: "" } : null,
      background: form.background ? { ref: form.background, name: "", abilities: form.bonus, equipment: form.bgEquipment } : null,
      classes: [form.klass ? { ref: form.klass, name: "", level: 1, subclass: null, skills: form.classSkills, equipment: form.classEquipment } : null],
      abilityMethod: form.method,
      baseAbilities: filledBase(),
      rolls: form.method === "roll" ? form.rolls : null,
      speciesChoices: { skills: form.speciesSkills, size: form.size },
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
    fd.set("status", form.status);
    fd.set("campaign", campaign?.id ?? "");
    fd.set("books", props.chosenBooks.join(","));
    fd.set("backstory", form.backstory);
    fd.set("sheet", JSON.stringify(sheet));
    if (portrait) fd.set("portrait", portrait);
    if (image) fd.set("image", image);

    setLoading(true);
    try {
      const res = await fetch("/api/characters", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
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
      router.push(`/characters/${data.id}`);
      router.refresh();
    } catch {
      setFormError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  // Errores sin un campo propio en el formulario: se muestran junto al botón
  const generalErrors = Object.entries(errors).filter(([k]) => !SHOWN_ERRORS.has(k));
  const errorCount = Object.keys(errors).length;
  const ClassIcon = form.klass ? CLASS_ICONS[bareName(form.klass.key)] : undefined;
  const section = (i: number) => ({ className: `${card} animate-fade-up scroll-mt-24`, style: { animationDelay: `${i * 50}ms` } });

  return (
    <form onSubmit={submit} noValidate className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-6">
        {/* 1. Detalles */}
        <section id="detalles" {...section(0)}>
          <h2 className={cardTitle}>Detalles</h2>
          <div className="space-y-5">
            <div>
              <label htmlFor="name" className={labelClass}>Nombre *</label>
              <input
                id="name"
                className={field}
                maxLength={LIMITS.name}
                value={form.name}
                onChange={(e) => update({ name: e.target.value }, "name")}
              />
              <FieldError errors={errors} keys={["name"]} />
            </div>

            <div>
              <RuleSelect id="species" label="Especie" options={props.species} value={form.species} onChange={chooseSpecies} />
              <FieldError errors={errors} keys={["species"]} />
              {form.species && <Description entry={cache[refKey(form.species)]} />}
            </div>

            <div>
              <RuleSelect
                id="lineage"
                label="Legado"
                options={lineageOptions}
                value={form.lineage}
                onChange={(ref) => update({ lineage: ref }, "lineage")}
                disabled={!hasLineages}
                placeholder={
                  !form.species || hasLineages
                    ? "Selecciona una opción"
                    : speciesData?.hasLineages
                      ? "No hay legados disponibles con los libros elegidos"
                      : "Esta especie no tiene legados"
                }
              />
              <FieldError errors={errors} keys={["lineage"]} />
              {form.lineage && <Description entry={cache[refKey(form.lineage)]} />}
            </div>

            {speciesData?.skills.choose && (
              <div>
                <SkillChecks
                  name="Habilidades de especie"
                  from={speciesData.skills.choose.from}
                  count={speciesData.skills.choose.count}
                  value={form.speciesSkills}
                  onChange={chooseSpeciesSkills}
                  locked={fixedLocked}
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
                  <RuleSelect id="class" label="Clase de nivel 1" options={props.classes} value={form.klass} onChange={chooseClass} />
                </div>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-brand-soft" aria-hidden="true">
                  {ClassIcon ? <ClassIcon size={26} /> : null}
                </span>
              </div>
              <FieldError errors={errors} keys={["classes", "classes.0", "classes.0.level", "classes.0.subclass"]} />
              {form.klass && <Description entry={cache[refKey(form.klass)]} />}
            </div>

            <div>
              <label htmlFor="campaign" className={labelClass}>Campaña</label>
              <input id="campaign" className={field} value={campaign?.name ?? "Sin campaña"} readOnly disabled />
              <FieldError errors={errors} keys={["campaign"]} />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <ImagePicker
                id="portrait"
                label="Retrato"
                hint={`PNG, JPG o WebP. Máximo ${IMAGE_MB} MB.`}
                maxMB={IMAGE_MB}
                previewClass="h-24 w-24"
                onFile={setPortrait}
                onRemove={() => {}}
                error={errors.portrait}
              />
              <ImagePicker
                id="image"
                label="Imagen"
                hint={`PNG, JPG o WebP. Máximo ${IMAGE_MB} MB.`}
                maxMB={IMAGE_MB}
                previewClass="h-24 w-32"
                onFile={setImage}
                onRemove={() => {}}
                error={errors.image}
              />
            </div>
          </div>
        </section>

        {/* 2. Estado */}
        <section id="estado" {...section(1)}>
          <h2 className={cardTitle}>Estado</h2>
          <div role="radiogroup" aria-label="Estado" className="grid gap-3 sm:grid-cols-3">
            {STATUSES.map((s) => (
              <label
                key={s.id}
                className={`flex cursor-pointer flex-col gap-1 rounded-md border p-3 text-sm transition-colors ${form.status === s.id ? "border-brand bg-brand/10" : "border-line hover:border-brand"}`}
              >
                <span className="flex items-center gap-2 font-semibold">
                  <input
                    type="radio"
                    name="status"
                    value={s.id}
                    checked={form.status === s.id}
                    onChange={() => update({ status: s.id }, "status")}
                    className="accent-brand"
                  />
                  {s.label}
                </span>
                <span className="text-muted">{s.description}</span>
              </label>
            ))}
          </div>
          <FieldError errors={errors} keys={["status"]} />
        </section>

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
        </section>

        {/* 4. Clase */}
        <section id="clase" {...section(3)}>
          <h2 className={cardTitle}>Clase</h2>
          {!classData ? (
            <p className="text-sm text-muted">
              Elige una clase en <a href={S.details} className="text-brand-soft hover:underline">Detalles</a>.
            </p>
          ) : (
            <div className="space-y-5">
              <SkillChecks
                name="Habilidades de clase"
                from={classData.skills.from}
                count={classData.skills.count}
                value={form.classSkills}
                onChange={(skills) => update({ classSkills: skills }, "classes.0.skills")}
                locked={classLocked}
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
          <FieldError errors={errors} keys={["classes.0.skills", "classes.0.equipment"]} />
        </section>

        {/* 5. Puntuaciones de característica */}
        <section id="caracteristicas" {...section(4)}>
          <h2 className={cardTitle}>Puntuaciones de característica</h2>
          <AbilityScores
            method={form.method}
            base={form.base}
            rolls={form.rolls?.values ?? null}
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

        {/* 6. Información */}
        <section id="informacion" {...section(5)}>
          <h2 className={cardTitle}>Información</h2>
          <div className="space-y-5">
            <div>
              <label htmlFor="alignment" className={labelClass}>Alineamiento</label>
              <select id="alignment" className={field} value={form.alignment} onChange={(e) => update({ alignment: e.target.value }, "alignment")}>
                <option value="">Sin alineamiento</option>
                {ALIGNMENTS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              {form.alignment && (
                <p className="mt-1 text-sm text-muted">{ALIGNMENTS.find((a) => a.id === form.alignment)?.description}</p>
              )}
              <FieldError errors={errors} keys={["alignment"]} />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="age" className={labelClass}>Edad</label>
                <input id="age" className={field} maxLength={LIMITS.age} value={form.age} onChange={(e) => update({ age: e.target.value }, "age")} />
                <FieldError errors={errors} keys={["age"]} />
              </div>
              <div>
                <label htmlFor="xp" className={labelClass}>Puntos de experiencia</label>
                <input
                  id="xp"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={MAX_XP}
                  step={1}
                  className={field}
                  value={form.xp}
                  placeholder="0"
                  onChange={(e) => update({ xp: e.target.value }, "xp")}
                />
                <FieldError errors={errors} keys={["xp"]} />
              </div>
            </div>
            <div>
              <label htmlFor="appearance" className={labelClass}>Apariencia</label>
              <textarea id="appearance" rows={3} className={field} maxLength={LIMITS.appearance} value={form.appearance} onChange={(e) => update({ appearance: e.target.value }, "appearance")} />
              <FieldError errors={errors} keys={["appearance"]} />
            </div>
            <div>
              <label htmlFor="backstory" className={labelClass}>Historia</label>
              <BbcodeEditor id="backstory" value={form.backstory} onChange={(v) => update({ backstory: v }, "backstory")} />
              <FieldError errors={errors} keys={["backstory"]} />
            </div>
            <div>
              <label htmlFor="languages" className={labelClass}>Idiomas</label>
              <input id="languages" className={field} maxLength={LIMITS.languages} value={form.languages} onChange={(e) => update({ languages: e.target.value }, "languages")} />
              <FieldError errors={errors} keys={["languages"]} />
            </div>
            <div>
              <label htmlFor="notes" className={labelClass}>Notas</label>
              <textarea id="notes" rows={4} className={field} maxLength={LIMITS.notes} value={form.notes} onChange={(e) => update({ notes: e.target.value }, "notes")} />
              <FieldError errors={errors} keys={["notes"]} />
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {generalErrors.map(([k, msg]) => (
            <p key={k} className={errorClass} role="alert" data-field-error>{msg}</p>
          ))}
          {formError && <p className={errorClass} role="alert">{formError}</p>}
          {!abilitiesValid && <p className="text-sm text-brand-soft">Ninguna característica puede superar 20.</p>}
          <button type="submit" disabled={loading || !abilitiesValid} className={primaryButton}>
            {loading && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
            Crear personaje
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
  "status", "background", "background.equipment", "classes.0.skills", "classes.0.equipment",
  "abilityMethod", "baseAbilities", "rolls", "background.abilities",
  "alignment", "age", "xp", "appearance", "backstory", "languages", "notes",
]);
