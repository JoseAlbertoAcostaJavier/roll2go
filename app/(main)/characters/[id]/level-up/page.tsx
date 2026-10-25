import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/currentUser";
import { OUTDATED_SHEET_ERROR, loadCharacterFor } from "@/lib/characterAccess";
import { getEntries, listEntries, listMasteryWeapons, listSpells, type CatalogEntry } from "@/lib/rules/catalog";
import { refKey } from "@/lib/rules/dnd2024/equipmentRefs";
import { summarizeClasses } from "@/lib/rules/dnd2024/upgrade";
import { MAX_LEVEL } from "@/lib/rules/dnd2024/validateLevel";
import type { ClassData, FeatureData, Ref, SubclassData } from "@/lib/rules/types";
import LevelUpWizard from "@/app/components/characters/levelup/LevelUpWizard";

export const metadata: Metadata = { title: "Subir de nivel" };

// Sin descripción (la hoja y los nombres de la tabla de clase no la necesitan): aligera lo que se manda al navegador
const light = (e: CatalogEntry): CatalogEntry => ({ ...e, description: "", descriptionEs: "", foundry: null });
const full = (e: CatalogEntry): CatalogEntry => ({ ...e, foundry: null });
// Los documentos del catálogo y la hoja pueden traer ObjectId o fechas: al cliente solo van datos planos
const plain = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export default async function LevelUpPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/characters/${id}/level-up`);
  // Solo el dueño sube de nivel: para el resto (y si no existe) es un 404
  const found = await loadCharacterFor(user.id, id, "write");
  if (!found) notFound();
  const { character: c, sheet, books, entries } = found;
  if (sheet.levels.length >= MAX_LEVEL) redirect(`/characters/${id}`);

  const back = (
    <Link href={`/characters/${id}`} className="mb-4 flex w-max items-center gap-1 text-sm text-muted hover:text-white">
      <ChevronLeft size={16} aria-hidden="true" /> Volver a la ficha
    </Link>
  );
  if (found.outdated) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-10">
        {back}
        <p role="alert" className="rounded-md border border-line bg-surface p-4 text-sm text-brand-soft">{OUTDATED_SHEET_ERROR}</p>
      </div>
    );
  }

  // Listas para las elecciones: dotes, rasgos opcionales y armas con maestría
  const [classOptions, feats, optionalFeatures, weapons] = await Promise.all([
    listEntries({ books, kind: "class" }),
    listEntries({ books, kind: "feat" }),
    listEntries({ books, kind: "optionalFeature" }),
    listMasteryWeapons(books),
  ]);
  const usable = (r: Ref) => books.includes(r.book);

  // Clases completas (descripción e identificador) y el nivel de clase que ganaría cada una
  const classes = await getEntries(classOptions.map((o) => o.ref));
  const summary = summarizeClasses(sheet.levels);
  const nextLevel = (ref: Ref) => (summary.find((s) => refKey(s.class.ref) === refKey(ref))?.level ?? 0) + 1;
  const dataOf = (e: CatalogEntry) => e.data as ClassData;

  // Subclases de las clases que la ganan en su siguiente nivel (del mismo padre y de libros utilizables)
  const subclassLists = await Promise.all(
    classes
      .filter((k) => nextLevel(k.ref) === dataOf(k).subclassLevel)
      .map((k) => listEntries({ books, kind: "subclass", parent: k.ref.key })),
  );
  const subclasses = (await getEntries(subclassLists.flat().map((o) => o.ref)))
    .filter((s) => s.parent && classes.some((k) => refKey(k.ref) === refKey(s.parent!)));

  // Rasgos: todos los de cada clase (para la tabla) y, con descripción, los del siguiente nivel de cada clase y de su
  // subclase (la que ya tiene o cualquiera de las que puede elegir ahora), con sus opciones
  const owned = summary.flatMap((s) => (s.subclass ? [s.subclass.ref] : []));
  const subclassFeatures = [...subclasses, ...owned.map((r) => entries.get(refKey(r))).filter((e) => !!e)].flatMap((s) => {
    const parent = s.parent ?? summary.find((x) => x.subclass && refKey(x.subclass.ref) === refKey(s.ref))?.class.ref;
    const level = parent ? nextLevel(parent) : 0;
    return (s.data as SubclassData).features.filter((f) => f.level === level).map((f) => f.ref);
  });
  const classFeatureRefs = classes.flatMap((k) => dataOf(k).features.map((f) => f.ref));
  const newKeys = new Set([
    ...classes.flatMap((k) => dataOf(k).features.filter((f) => f.level === nextLevel(k.ref)).map((f) => refKey(f.ref))),
    ...subclassFeatures.map(refKey),
  ]);
  const features = await getEntries([...classFeatureRefs, ...subclassFeatures].filter(usable));
  const optionRefs = features
    .filter((f) => newKeys.has(refKey(f.ref)))
    .flatMap((f) => (f.data as FeatureData | null)?.options ?? [])
    .filter(usable);
  const options = await getEntries(optionRefs);

  // Lo que necesita el asistente: la hoja (sin descripciones) y lo nuevo con descripción; lo último gana
  const all = new Map<string, CatalogEntry>();
  for (const e of entries.values()) all.set(refKey(e.ref), light(e));
  for (const e of features) all.set(refKey(e.ref), newKeys.has(refKey(e.ref)) ? full(e) : light(e));
  for (const e of [...classes, ...subclasses, ...options]) all.set(refKey(e.ref), full(e));

  // Conjuros (sin descripción) de todas las listas: además de la de cada clase, los de Secretos mágicos y
  // Descubrimientos mágicos (otras listas), las dotes (Iniciado en la magia, Tocado por los feéricos…) y el Pacto del
  // tomo (trucos y rituales de cualquier clase)
  const spells = await listSpells(books);

  return (
    <div className="mx-auto max-w-280 px-4 py-8 sm:px-5">
      {back}
      <LevelUpWizard
        characterId={id}
        characterName={c.name}
        campaignId={c.campaign ? String(c.campaign) : null}
        sheet={plain(sheet)}
        entries={plain([...all.values()])}
        classes={plain(classOptions.map((o) => o.ref))}
        subclasses={plain(subclasses.map((s) => s.ref))}
        feats={plain(feats)}
        optionalFeatures={plain(optionalFeatures)}
        weapons={plain(weapons)}
        spells={plain(spells)}
      />
    </div>
  );
}
