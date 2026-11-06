"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import { card, primaryButton } from "@/app/components/ui/formStyles";
import type { CatalogEntry, EntryOption } from "@/lib/rules/catalog/types";
import { derive } from "@/lib/rules/dnd2024/derive";
import { characterFeats } from "@/lib/rules/dnd2024/derive/features";
import { chosenFeatSpells, featNameOfLabel, levelFeatSpellPending, type FeatWithData } from "@/lib/rules/dnd2024/spells/featSpells";
import { chosenSpells, knownSpellRefs } from "@/lib/rules/dnd2024/derive/spells";
import { knownLanguagesAt, languagePool } from "@/lib/rules/dnd2024/creation/languages";
import { bareName, refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import { FEATURE_OPTION_LABELS } from "@/lib/rules/dnd2024/levels/featureChoices";
import { ABILITY_NAMES, skillName } from "@/lib/rules/dnd2024/sheet/labels";
import { heldArcana, heldBonusSpells, heldOptionalFeatures, heldPicks } from "@/lib/rules/dnd2024/levels/held";
import {
  meetsFeatPrerequisite, meetsMulticlass, pendingChoices, withBonusCantrips, type PendingChoice,
} from "@/lib/rules/dnd2024/levels/pendingChoices";
import { crossSourceGranted, type GrantedSpell } from "@/lib/rules/dnd2024/spells/grantedSpells";
import { spellsSource } from "@/lib/rules/dnd2024/levels/spellPending";
import { LEVEL_CHANGED } from "@/lib/rules/dnd2024/levels/levelOps";
import { currentMasteries, masteryLabel } from "@/lib/rules/dnd2024/levels/masteries";
import type { Dnd2024SheetV2, LevelEntry } from "@/lib/rules/dnd2024/sheet/sheet";
import { emptySpellPick } from "@/lib/rules/dnd2024/spells/spellPicks";
import { pendingSpellLists } from "@/lib/rules/catalog/spellRows";
import { summarizeClasses } from "@/lib/rules/dnd2024/sheet/upgrade";
import {
  ABILITIES, type Ability, type BackgroundData, type ClassData, type FeatData, type ItemData, type Ref, type SubclassData,
} from "@/lib/rules/types";
import { nameFromKey, refFromKey, type ChoiceCtx } from "../creator/ClassFeaturesSection";
import useCatalogEntries from "../hooks/useCatalogEntries";
import ClassCard from "./ClassCard";
import DeleteLevel from "./DeleteLevel";
import {
  buildChoices, draftKeyOf, emptyAsi, featAbilityKey, missingChoice, parseDraft, slotsFor,
  type ChoiceEnv, type LevelUpState,
} from "./state";
import AsiStep from "./steps/AsiStep";
import BonusSpellsStep from "./steps/BonusSpellsStep";
import ChoiceRowsStep from "./steps/ChoiceRowsStep";
import ClassStep, { type ClassChoice } from "./steps/ClassStep";
import ConfirmStep from "./steps/ConfirmStep";
import FeaturesStep from "./steps/FeaturesStep";
import HpStep from "./steps/HpStep";
import PickStep from "./steps/PickStep";
import FeatSpellsStep from "./steps/FeatSpellsStep";
import SpellsStep from "./steps/SpellsStep";
import SubclassStep from "./steps/SubclassStep";
import SpellListsStatus from "../SpellListsStatus";
import useSpellLists from "../hooks/useSpellLists";

type Props = {
  characterId: string;
  characterName: string;
  campaignId: string | null;
  sheet: Dnd2024SheetV2;
  /** Entradas de la hoja y de lo que puede ganar en este nivel (clases, rasgos nuevos, opciones, subclases). */
  entries: CatalogEntry[];
  classes: Ref[];
  /** Subclases de las clases que la ganan en su siguiente nivel. */
  subclasses: Ref[];
  feats: EntryOption[];
  optionalFeatures: EntryOption[];
  weapons: EntryOption[];
  /** Idiomas del catálogo (Explorador hábil). */
  languages: EntryOption[];
};

type Step = { id: string; title: string; p?: PendingChoice };

const ROW_TYPES: PendingChoice["type"][] = ["skills", "expertise", "weaponMastery", "languages"];
const uniq = <T,>(list: T[]) => [...new Set(list)];
const nameOf = (e: { nameEs: string | null; name: string }) => e.nameEs ?? e.name;
// Entrada ligera del listado como entrada completa, para `derive` (solo usa `data` y los nombres)
const asEntry = (o: EntryOption): CatalogEntry => ({
  ...o, description: "", descriptionEs: "", identifier: "", page: null, parent: null, foundry: null,
});

const noSubscribe = () => () => {};
function readDraft(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/* Asistente para subir de nivel. Se monta en el navegador para recuperar el borrador de localStorage antes del primer
   pintado; cada nivel tiene su propio borrador. */
export default function LevelUpWizard(props: Props) {
  const draftKey = draftKeyOf(props.characterId, props.sheet.levels.length + 1);
  const draft = useSyncExternalStore(noSubscribe, () => readDraft(draftKey), () => undefined);
  if (draft === undefined)
    return (
      <p className="flex items-center gap-2 text-muted">
        <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> Cargando…
      </p>
    );
  return <Wizard key={draftKey} {...props} draftKey={draftKey} draft={draft} />;
}

function Wizard(props: Props & { draftKey: string; draft: string | null }) {
  const { sheet, characterId, draftKey } = props;
  const router = useRouter();
  const n = sheet.levels.length + 1;
  const top = useRef<HTMLDivElement>(null);

  // ---- personaje antes de subir ----
  const entries = useMemo(() => new Map(props.entries.map((e) => [refKey(e.ref), e])), [props.entries]);
  const derived = useMemo(() => derive(sheet, entries), [sheet, entries]);
  const summary = useMemo(() => summarizeClasses(sheet.levels), [sheet]);
  const scores = useMemo(
    () => Object.fromEntries(ABILITIES.map((a) => [a, derived.abilities[a].score])) as Record<Ability, number>,
    [derived],
  );

  // ---- clases: las suyas suben de nivel; las demás, con el requisito de multiclase ----
  const classChoices = useMemo((): ClassChoice[] => props.classes.flatMap((r) => {
    const e = entries.get(refKey(r));
    if (!e) return [];
    const owned = summary.find((s) => refKey(s.class.ref) === refKey(r));
    const ok = meetsMulticlass(sheet, derived, e, entries);
    return [{ key: refKey(r), entry: e, nextLevel: (owned?.level ?? 0) + 1, blocked: ok.ok ? null : ok.reason }];
  }), [props.classes, entries, summary, sheet, derived]);
  const lastClass = refKey(sheet.levels[sheet.levels.length - 1].class.ref);
  const defaultClass = (classChoices.find((c) => c.key === lastClass && !c.blocked) ?? classChoices.find((c) => !c.blocked))?.key ?? "";

  const [state, setState] = useState<LevelUpState>(() => parseDraft(props.draft, {
    classKey: defaultClass, subclassKey: "", values: {}, replaced: {}, featAbility: {}, featResist: {}, asi: {}, spells: {}, hp: null,
    step: "class",
  }));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [conflict, setConflict] = useState<string | null>(null);

  // Borrador: se guarda en cada cambio (si el navegador no deja, se sigue sin borrador)
  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(state));
    } catch {
      // almacenamiento no disponible
    }
  }, [state, draftKey]);

  const choice = classChoices.find((c) => c.key === state.classKey && !c.blocked)
    ?? classChoices.find((c) => c.key === defaultClass) ?? null;

  // ---- lo que gana en la clase elegida ----
  const classEntry = choice?.entry ?? null;
  const classData = classEntry?.data as ClassData | undefined;
  const classLevel = choice?.nextLevel ?? 1;
  const owned = choice ? summary.find((s) => refKey(s.class.ref) === choice.key) : undefined;
  const subclassOptions = props.subclasses.map((r) => entries.get(refKey(r)))
    .filter((e): e is CatalogEntry => !!e?.parent && !!choice && refKey(e.parent) === choice.key);
  const chosenSub = !owned?.subclass && classLevel === classData?.subclassLevel
    ? subclassOptions.find((s) => refKey(s.ref) === state.subclassKey) ?? null
    : null;
  const subclassEntry = chosenSub ?? (owned?.subclass ? entries.get(refKey(owned.subclass.ref)) ?? null : null);

  const knownLanguages = classEntry
    ? knownLanguagesAt(sheet, Object.fromEntries(summary.map((s) => [bareName(s.class.ref.key), s.level])), classEntry.ref, classLevel)
    : [];
  const basePending = classEntry
    ? pendingChoices(sheet, classEntry.ref, classLevel, entries, {
      ...(chosenSub ? { subclass: chosenSub.ref } : {}), known: knownSpellRefs(derived.spells),
      languages: { pool: languagePool(props.languages), known: knownLanguages },
    })
    : [];
  // Conjuros de dotes e invocaciones (Pacto del tomo): los de las que elige ahora (hasta este nivel), los que dan más
  // en este nivel las que tenía y el cambio opcional de Iniciado en la magia (`count: 0` si no pide nada más)
  const featOf = (ref: Ref, name: string | null): FeatWithData => {
    const e = [...props.feats, ...props.optionalFeatures].find((f) => refKey(f.ref) === refKey(ref))
      ?? entries.get(refKey(ref));
    return { ref, name: name ?? (e ? nameOf(e) : nameFromKey(ref.key)), data: e?.data as FeatData | undefined };
  };
  const gainedFeats = [
    ...basePending.filter((p) => p.type === "asi").map((p) => state.asi[p.source])
      .flatMap((a) => (a?.mode === "feat" && a.feat ? [a.feat] : [])),
    ...basePending.filter((p) => p.type === "feat" || p.type === "optionalFeature")
      .flatMap((p) => (state.values[p.source] ?? []).slice(0, slotsFor(p, state)).filter(Boolean)),
  ].map((k) => featOf(refFromKey(k), null));
  const bgData = entries.get(refKey(sheet.background.ref))?.data as BackgroundData | undefined;
  const replacedNow = new Set(basePending
    .flatMap((p) => (p.optionalReplace && state.replaced[p.source] ? [state.replaced[p.source]] : [])));
  const ownedFeats = [...characterFeats(sheet, bgData), ...heldOptionalFeatures(sheet.levels)]
    .filter((f) => !replacedNow.has(refKey(f.ref))).map((f) => featOf(f.ref, f.name));
  // Las opciones de rasgo elegidas ahora pueden dar un truco más (Taumaturgo, Mago del Druida)
  const pending = [
    ...withBonusCantrips(basePending, basePending.filter((p) => p.type === "featureOption")
      .flatMap((p) => (state.values[p.source] ?? []).filter(Boolean).map((k) => refFromKey(k).key))),
    ...(classEntry ? levelFeatSpellPending(gainedFeats, ownedFeats, sheet.levels, n) : []),
  ];

  // Estado efectivo: la subclase solo si es de la clase elegida; los PG solo si son del dado de esta clase
  const hp = state.hp && classData && state.hp.die === classData.hitDie ? state.hp : null;
  const effective: LevelUpState = { ...state, subclassKey: chosenSub ? refKey(chosenSub.ref) : "", hp };
  const env: ChoiceEnv = { pending, state: effective, feats: props.feats, scores };

  // ---- descripciones de las dotes y rasgos opcionales elegidos (se piden al servidor) ----
  const lazyRefs = uniq([
    ...pending.filter((p) => p.type === "feat" || p.type === "optionalFeature").flatMap((p) => state.values[p.source] ?? []),
    ...Object.values(state.asi).map((a) => a.feat),
  ].filter((k) => k && !entries.has(k))).sort().map(refFromKey);
  const lazyKey = lazyRefs.map(refKey).join("\n");
  const [cacheRefs, setCacheRefs] = useState<{ key: string; refs: Ref[] }>({ key: "", refs: [] });
  if (lazyKey !== cacheRefs.key) setCacheRefs({ key: lazyKey, refs: lazyRefs });
  const cache = useCatalogEntries(cacheRefs.refs, props.campaignId);
  const entry = (r: Ref): CatalogEntry | null | undefined => {
    const k = refKey(r);
    if (entries.has(k)) return entries.get(k);
    return k in cache ? cache[k] : lazyRefs.some((x) => refKey(x) === k) ? undefined : null;
  };

  // ---- opciones de las elecciones ----
  const gained = classLevel === 1 ? classData?.multiclass?.proficiencies : null;
  const heldFeats = derived.features.filter((g) => g.source === "feat").flatMap((g) => g.features.map((f) => f.ref.key));
  const prerequisites = {
    level: n,
    abilities: scores,
    armor: uniq([...derived.armor, ...(gained?.armor ?? [])]),
    spellcasting: [...summary.map((s) => entries.get(refKey(s.class.ref))?.data as ClassData | undefined), classData]
      .some((d) => !!d?.spellcasting),
  };
  const featBlocked = (f: EntryOption) => {
    const d = f.data as FeatData | null;
    if (!d?.repeatable && heldFeats.includes(f.ref.key)) return "ya la tienes";
    return meetsFeatPrerequisite(d?.prerequisite, prerequisites) ? null : "no cumples los requisitos";
  };
  const held = useMemo(() => heldPicks(sheet.levels), [sheet]);
  const ctx: ChoiceCtx = {
    pending,
    values: state.values,
    entry,
    takenSkills: derived.skills.filter((s) => s.proficiency > 0).map((s) => s.id),
    expertSkills: derived.skills.filter((s) => s.proficiency === 2).map((s) => s.id),
    feats: props.feats,
    optionalFeatures: props.optionalFeatures,
    weapons: props.weapons,
    weaponProficiencies: uniq([...derived.weapons, ...(gained?.weapons ?? [])]),
    classLevel,
    held,
    masteries: currentMasteries(sheet).map(refKey),
    languages: props.languages,
    knownLanguages,
    featBlocked,
  };
  // Dotes generales para la mejora de característica: sin la propia mejora, con requisitos y sin las que ya tiene
  const generalFeats = props.feats.filter((f) => (f.data as FeatData | null)?.category === "general"
    && !f.ref.key.startsWith("feat:ability score improvement|") && !featBlocked(f));

  // ---- PG: máximo antes y después con lo elegido ----
  const preview = (() => {
    if (!hp || !classEntry) return null;
    const level: LevelEntry = {
      n, class: { ref: classEntry.ref, name: nameOf(classEntry) }, classLevel,
      hp: { method: hp.method, value: hp.value }, choices: buildChoices(env),
    };
    const withFeats = new Map(entries);
    for (const f of props.feats) if (!withFeats.has(refKey(f.ref))) withFeats.set(refKey(f.ref), asEntry(f));
    if (chosenSub) withFeats.set(refKey(chosenSub.ref), chosenSub);
    const after = derive({ ...sheet, levels: [...sheet.levels, level] }, withFeats);
    return { before: derived.hp.max, after: after.hp.max, conMod: after.abilities.con.mod };
  })();

  // ---- pasos ----
  const steps: Step[] = [
    { id: "class", title: "Clase" },
    { id: "features", title: "Rasgos de clase" },
    ...pending.map((p) => ({ id: p.type === "subclass" ? "subclass" : `choice:${p.type}:${p.source}`, title: p.label, p })),
    { id: "hp", title: "Puntos de golpe" },
    { id: "confirm", title: "Confirmar" },
  ];
  const missingOf = (s: Step): string | null => {
    if (s.id === "class") return choice ? null : "elegir una clase";
    if (s.id === "hp") return hp ? null : "elegir cómo ganar los puntos de golpe";
    return s.p ? missingChoice(s.p, env) : null;
  };
  const firstMissing = steps.findIndex((s) => missingOf(s));
  const wanted = Math.max(0, steps.findIndex((s) => s.id === state.step));
  const index = firstMissing >= 0 ? Math.min(wanted, firstMissing) : wanted;
  const step = steps[index];
  const missing = missingOf(step);
  const isLast = index === steps.length - 1;

  // Listas de conjuros, bajo demanda: las del paso de conjuros al llegar a él (y en el resumen, las de todos, para los
  // nombres); las ya cargadas se conservan
  const stepLists = (s: Step) => (s.p ? pendingSpellLists(s.p) : []);
  const { spells, status: spellStatus, retry: retrySpells } = useSpellLists(
    { characterId },
    step.id === "confirm" ? steps.flatMap(stepLists) : stepLists(step),
  );

  const update = (patch: Partial<LevelUpState>) => {
    setState((s) => ({ ...s, ...patch }));
    setErrors([]);
  };
  const go = (i: number) => {
    update({ step: steps[i].id });
    // Al cambiar de paso, el principio del asistente queda a la vista
    const box = top.current;
    if (box && box.getBoundingClientRect().top < 0) box.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ---- conjuros: los que ya tiene la clase (en el Mago, su libro con los copiados) ----
  const heldSpells = (p: PendingChoice) => {
    if (!p.spells) return { cantrips: [], spells: [] };
    const held = chosenSpells(sheet, p.spells.class);
    return p.spells.mode === "spellbook" ? { ...held, spells: [...held.spells, ...sheet.spellbookExtra] } : held;
  };
  // Los que ya tiene por otras vías (como en el servidor, `validateLevel`): siempre preparados de esta clase o su
  // subclase (también los que da este nivel), especie, legado y dotes; los de otra clase sí se pueden aprender
  const grantedSpells = [
    ...derived.spells.blocks
      .filter((b) => [classEntry?.ref, subclassEntry?.ref].some((r) => r && refKey(r) === refKey(b.class)))
      .flatMap((b) => b.always.map((a) => a.spell.ref)),
    ...derived.spells.other.map((o) => o.spell.ref),
    ...[...(classData?.spells ?? []), ...((subclassEntry?.data as SubclassData | undefined)?.spells ?? [])]
      .filter((g) => g.level <= classLevel).map((g) => g.ref),
  ].map(refKey);
  // Y lo que se elige en este nivel en la clase o en una dote: un mismo conjuro no se elige en dos sitios
  const levelPicks = pending.filter((p) => p.type === "spells" || p.type === "featSpells").map((p) => {
    const v = state.spells[p.source];
    return {
      source: p.source, label: p.type === "spells" ? "la clase" : featNameOfLabel(p.label),
      keys: v ? [...v.cantrips, ...v.spells, ...(v.free ?? []), v.replace.in, v.replaceCantrip.in].filter(Boolean) : [],
    };
  });
  const grantedFor = (source: string): GrantedSpell[] => crossSourceGranted(grantedSpells, levelPicks, source);
  const spellNames = useMemo(() => new Map(spells.map((s) => [refKey(s.ref), nameOf(s)])), [spells]);
  const featSpellsHeld = useMemo(() => chosenFeatSpells(sheet.levels), [sheet]);
  // Arcano místico y conjuros de rasgos: los que ya da la elección, el libro de la clase con lo elegido en este nivel
  // (Conjuros distintivos) y los que ya tiene (no se repiten)
  const bonusContext = (p: PendingChoice) => {
    const cls = p.bonusSpells?.class ?? classEntry?.ref;
    if (!cls) return { held: [], spellbook: [], taken: [] };
    const held = p.type === "arcanum" ? heldArcana(sheet.levels, cls) : (heldBonusSpells(sheet.levels, cls).get(p.source) ?? []);
    const levelPick = state.spells[spellsSource(cls)];
    const levelSpells = levelPick ? [...levelPick.cantrips, ...levelPick.spells, ...(levelPick.free ?? [])] : [];
    const book = [...chosenSpells(sheet, cls).spells, ...sheet.spellbookExtra].map((s) => refKey(s.ref));
    return {
      held,
      spellbook: [...book, ...(levelPick?.spells ?? []), ...(levelPick?.free ?? [])],
      taken: [...knownSpellRefs(derived.spells).map(refKey), ...grantedSpells, ...levelSpells],
    };
  };

  // ---- resumen ----
  const keyLabel = (k: string): string => {
    const spell = spellNames.get(k);
    if (spell) return spell;
    if (k.startsWith("builtin:")) return FEATURE_OPTION_LABELS[k.slice(8)] ?? k.slice(8);
    const lang = props.languages.find((x) => refKey(x.ref) === k);
    if (lang) return nameOf(lang);
    const w = props.weapons.find((x) => refKey(x.ref) === k);
    if (w) return masteryLabel(nameOf(w), (w.data as ItemData).weapon?.mastery);
    const listed = [...props.feats, ...props.optionalFeatures].find((x) => refKey(x.ref) === k) ?? entries.get(k);
    return listed ? nameOf(listed) : nameFromKey(refFromKey(k).key);
  };
  const summaryRows = (): { label: string; value: string }[] => {
    const rows = [{
      label: "Clase",
      value: classEntry ? `${nameOf(classEntry)} ${classLevel}${classLevel === 1 ? " (nueva clase)" : ""} · nivel ${n}` : "",
    }];
    for (const p of pending) {
      let value = "";
      if (p.type === "subclass") value = chosenSub ? nameOf(chosenSub) : "";
      else if (p.type === "asi") {
        const a = state.asi[p.source] ?? emptyAsi();
        value = a.mode === "abilities"
          ? Object.entries(a.abilities).filter(([, v]) => v).map(([k, v]) => `${ABILITY_NAMES[k as Ability]} +${v}`).join(", ")
          : a.feat ? `${keyLabel(a.feat)}${a.ability ? ` (${ABILITY_NAMES[a.ability]} +1)` : ""}` : "";
      } else if (p.type === "featSpells") {
        const c = buildChoices({ ...env, pending: [p] })[0];
        const v = c?.type === "featSpells" ? c.value : null;
        value = [
          ...(v ? [...v.cantrips, ...v.spells].map((x) => keyLabel(refKey(x.ref))) : []),
          ...(v?.replace ? [`${keyLabel(refKey(v.replace.in.ref))} sustituye a ${keyLabel(refKey(v.replace.out.ref))}`] : []),
          ...(v?.ability ? [`(${ABILITY_NAMES[v.ability]})`] : []),
        ].join(", ") || "Sin cambios";
      } else if (p.type === "arcanum" || p.type === "bonusSpells") {
        const c = buildChoices({ ...env, pending: [p] })[0];
        const v = c?.type === "arcanum" ? { spells: c.value ? [c.value] : [], replace: c.replace }
          : c?.type === "bonusSpells" ? c.value : null;
        value = [
          ...(v ? v.spells.map((x) => keyLabel(refKey(x.ref))) : []),
          ...(v?.replace ? [`${keyLabel(refKey(v.replace.in.ref))} sustituye a ${keyLabel(refKey(v.replace.out.ref))}`] : []),
        ].join(", ") || "Sin cambios";
      } else if (p.type === "spells") {
        const c = buildChoices({ ...env, pending: [p] })[0];
        const v = c?.type === "spells" ? c.value : null;
        const swaps = [v?.replaceCantrip, v?.replace].filter((x) => !!x)
          .map((x) => `${keyLabel(refKey(x.in.ref))} sustituye a ${keyLabel(refKey(x.out.ref))}`);
        const free = (v?.free ?? []).map((x) => `${keyLabel(refKey(x.ref))} (gratis)`);
        value = [...(v ? [...v.cantrips, ...v.spells].map((x) => keyLabel(refKey(x.ref))) : []), ...free, ...swaps].join(", ")
          || "Sin cambios";
      } else {
        const picked = (state.values[p.source] ?? []).slice(0, slotsFor(p, effective)).filter(Boolean);
        value = picked.map((k) => (p.type === "skills" || p.type === "expertise" ? skillName(k) : keyLabel(k))).join(", ");
        if (p.optionalReplace && state.replaced[p.source]) value += ` (sustituye a ${keyLabel(state.replaced[p.source])})`;
        if (!picked.length && p.count === 0) value = "Sin cambios";
      }
      rows.push({ label: p.label, value });
    }
    if (hp && preview) {
      rows.push({
        label: "Puntos de golpe",
        value: `+${preview.after - preview.before} (${hp.method === "roll" ? "tirada" : "media"} ${hp.value}) → ${preview.after} PG`,
      });
    }
    return rows;
  };

  async function confirm() {
    if (!classEntry || !hp || firstMissing >= 0) return;
    setSaving(true);
    setErrors([]);
    setConflict(null);
    try {
      const res = await fetch(`/api/characters/${characterId}/levels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedLevel: n,
          class: { ref: classEntry.ref },
          choices: buildChoices(env),
          hp: { method: hp.method, value: hp.value, ...(hp.token ? { token: hp.token } : {}) },
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        try {
          localStorage.removeItem(draftKey);
        } catch {
          // almacenamiento no disponible
        }
        router.push(`/characters/${characterId}?saved=level`);
        router.refresh();
        return;
      }
      if (res.status === 409) setConflict(data?.error ?? LEVEL_CHANGED);
      else if (data?.errors) setErrors(uniq(Object.values(data.errors as Record<string, string>)));
      else setErrors([data?.error ?? `El servidor ha respondido con un error (${res.status}).`]);
    } catch {
      setErrors(["No se pudo conectar con el servidor."]);
    }
    setSaving(false);
  }

  // ---- contenido del paso ----
  function content() {
    if (step.id === "class") {
      return (
        <ClassStep
          options={classChoices}
          value={choice?.key ?? ""}
          onChange={(classKey) => update({ classKey })}
        />
      );
    }
    if (!classEntry || !classData) return null;
    const className = nameOf(classEntry);
    if (step.id === "features") {
      const subFeatures = subclassEntry
        ? (subclassEntry.data as SubclassData).features.filter((f) => f.level === classLevel).map((f) => f.ref)
        : [];
      return (
        <FeaturesStep
          level={n}
          classLevel={classLevel}
          className={className}
          features={classData.features.filter((f) => f.level === classLevel).map((f) => f.ref)}
          subclass={subclassEntry && !chosenSub ? { name: nameOf(subclassEntry), features: subFeatures } : null}
          entry={entry}
        />
      );
    }
    if (step.id === "subclass" && step.p) {
      return (
        <SubclassStep
          label={step.p.label}
          className={className}
          classLevel={classLevel}
          options={subclassOptions}
          value={effective.subclassKey}
          onChange={(subclassKey) => update({ subclassKey })}
          entry={entry}
        />
      );
    }
    if (step.id === "hp") {
      return (
        <HpStep
          characterId={characterId}
          die={classData.hitDie}
          value={hp}
          onChange={(v) => update({ hp: v })}
          conMod={preview?.conMod ?? derived.abilities.con.mod}
          preview={preview}
        />
      );
    }
    if (step.id === "confirm") {
      return <ConfirmStep level={n} rows={summaryRows()} errors={errors} conflict={conflict} />;
    }
    const p = step.p;
    if (!p) return null;
    const lists = spellStatus(stepLists(step));
    if (lists !== "ready") return <SpellListsStatus error={lists === "error"} onRetry={retrySpells} />;
    const setValues = (v: string[]) => update({ values: { ...state.values, [p.source]: v } });
    if (p.type === "asi") {
      return (
        <AsiStep
          value={state.asi[p.source] ?? emptyAsi()}
          onChange={(v) => update({ asi: { ...state.asi, [p.source]: v } })}
          scores={scores}
          feats={generalFeats}
          entry={entry}
        />
      );
    }
    if (p.type === "featSpells") {
      return (
        <FeatSpellsStep
          id={`feat-spells-${n}`}
          p={p}
          spells={spells}
          granted={grantedFor(p.source)}
          held={p.featSpells ? (featSpellsHeld.get(refKey(p.featSpells.feat)) ?? []) : []}
          value={state.spells[p.source] ?? emptySpellPick()}
          onChange={(v) => update({ spells: { ...state.spells, [p.source]: v } })}
          ability={state.featAbility[p.source] ?? ""}
          onAbility={(a) => update({ featAbility: { ...state.featAbility, [p.source]: a } })}
          characterId={characterId}
          campaignId={props.campaignId}
        />
      );
    }
    if (p.type === "arcanum" || p.type === "bonusSpells") {
      return (
        <BonusSpellsStep
          id={`bonus-spells-${n}`}
          p={p}
          spells={spells}
          {...bonusContext(p)}
          value={state.spells[p.source] ?? emptySpellPick()}
          onChange={(v) => update({ spells: { ...state.spells, [p.source]: v } })}
          characterId={characterId}
          campaignId={props.campaignId}
        />
      );
    }
    if (p.type === "spells" && p.spells) {
      const caster = entries.get(refKey(p.spells.class));
      return (
        <SpellsStep
          id={`spells-${n}`}
          casterName={caster ? nameOf(caster) : className}
          mode={p.spells.mode}
          listId={p.spells.list}
          maxLevel={p.spells.maxLevel}
          pending={p}
          spells={spells}
          held={heldSpells(p)}
          granted={grantedFor(p.source)}
          value={state.spells[p.source] ?? emptySpellPick()}
          onChange={(v) => update({ spells: { ...state.spells, [p.source]: v } })}
          characterId={characterId}
          campaignId={props.campaignId}
        />
      );
    }
    if (ROW_TYPES.includes(p.type)) {
      const have = p.type === "expertise"
        ? derived.skills.filter((s) => s.proficiency === 2).map((s) => skillName(s.id))
        : p.type === "skills" ? derived.skills.filter((s) => s.proficiency > 0).map((s) => skillName(s.id)) : [];
      const hint = have.length ? `${p.type === "expertise" ? "Ya tienes pericia en" : "Ya tienes"}: ${have.join(", ")}.` : undefined;
      return <ChoiceRowsStep p={p} ctx={ctx} onChange={setValues} hint={hint} />;
    }
    return (
      <PickStep
        p={p}
        ctx={ctx}
        slots={slotsFor(p, effective)}
        onChange={setValues}
        held={held.get(p.source) ?? []}
        replaced={state.replaced[p.source] ?? ""}
        onReplace={(k) => update({ replaced: { ...state.replaced, [p.source]: k } })}
        featAbility={(k) => state.featAbility[featAbilityKey(p.source, k)]}
        onFeatAbility={(k, a) => update({ featAbility: { ...state.featAbility, [featAbilityKey(p.source, k)]: a } })}
        featResist={(k) => state.featResist[featAbilityKey(p.source, k)]}
        onFeatResist={(k, v) => update({ featResist: { ...state.featResist, [featAbilityKey(p.source, k)]: v } })}
        scores={scores}
      />
    );
  }

  return (
    <div ref={top} className="scroll-mt-4">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-extrabold">Subir de nivel</h1>
          <p className="text-muted">{props.characterName} · Nivel {n - 1} → {n}</p>
        </div>
        {n - 1 >= 2 && <DeleteLevel characterId={characterId} level={n - 1} />}
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        {classEntry && (
          <div className="lg:hidden">
            <ClassCard classEntry={classEntry} classLevel={classLevel} entry={entry} collapsible />
          </div>
        )}

        <section className={`${card} min-w-0`} aria-labelledby="level-up-step">
          <ol className="mb-5 flex gap-1.5 overflow-x-auto pb-1" aria-label="Pasos">
            {steps.map((s, i) => {
              const done = i < index;
              const reachable = firstMissing < 0 || i <= firstMissing;
              return (
                <li key={s.id} className="shrink-0">
                  <button
                    type="button"
                    disabled={!reachable || i === index}
                    aria-current={i === index ? "step" : undefined}
                    onClick={() => go(i)}
                    className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                      i === index ? "border-brand bg-brand text-white"
                        : done ? "border-line text-fg enabled:hover:border-brand" : "border-line text-muted enabled:hover:border-brand disabled:opacity-50"
                    }`}
                  >
                    {done && <Check size={12} aria-hidden="true" />}
                    {s.title}
                  </button>
                </li>
              );
            })}
          </ol>

          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Paso {index + 1} de {steps.length}</p>
          <h2 id="level-up-step" className="mb-4 font-heading text-2xl font-bold">{step.title}</h2>

          <div key={step.id} className="animate-fade-up">{content()}</div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <button
              type="button"
              onClick={() => go(index - 1)}
              disabled={index === 0 || saving}
              className="flex items-center gap-1 rounded-md border border-line px-4 py-2.5 font-semibold transition-colors enabled:hover:border-brand enabled:hover:text-white disabled:opacity-40"
            >
              <ChevronLeft size={16} aria-hidden="true" /> Anterior
            </button>
            <div className="flex flex-wrap items-center justify-end gap-3">
              {missing && <p className="text-sm text-muted" role="status">Falta: {missing}</p>}
              {isLast ? (
                <button type="button" onClick={confirm} disabled={saving || firstMissing >= 0 || !!conflict} className={primaryButton}>
                  {saving && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
                  Confirmar nivel
                </button>
              ) : (
                <button type="button" onClick={() => go(index + 1)} disabled={!!missing} className={primaryButton}>
                  Siguiente <ChevronRight size={16} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </section>

        {classEntry && (
          <aside className="sticky top-4 hidden lg:block">
            <ClassCard classEntry={classEntry} classLevel={classLevel} entry={entry} />
          </aside>
        )}
      </div>
    </div>
  );
}
