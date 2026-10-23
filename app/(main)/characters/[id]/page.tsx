import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import mongoose from "mongoose";
import { ChevronLeft, TriangleAlert, User as UserIcon } from "lucide-react";
import { connectDB } from "@/lib/mongodb";
import { Campaign } from "@/lib/Campaign";
import { Character } from "@/lib/Character";
import { requireUser } from "@/lib/currentUser";
import { system as rpgSystems } from "@/lib/systems";
import { booksByIds, visibleBooksOf } from "@/lib/rules/books";
import { getEntry, type CatalogEntry } from "@/lib/rules/catalog";
import { derive } from "@/lib/rules/dnd2024/derive";
import type { Dnd2024Sheet } from "@/lib/rules/dnd2024/sheet";
import { alignmentName } from "@/lib/rules/dnd2024/alignments";
import { equipmentRefs, refKey } from "@/lib/rules/dnd2024/equipmentRefs";
import { ABILITY_NAMES, proficiencyName, skillName } from "@/lib/rules/dnd2024/labels";
import { ABILITIES, type BackgroundData, type ClassData, type Ref } from "@/lib/rules/types";
import Bbcode from "@/app/components/Bbcode";
import { card, cardTitle } from "@/app/components/formStyles";

type Props = { params: Promise<{ id: string }> };

const STATUS_LABEL = { active: "En activo", retired: "Retirado", dead: "Fallecido" } as const;
const fmtMod = (m: number) => (m > 0 ? `+${m}` : m < 0 ? `−${-m}` : "+0");
const modColor = (m: number) => (m > 0 ? "text-success" : m < 0 ? "text-brand-soft" : "text-muted");

/* Personaje visible para el usuario: el dueño o un miembro de su campaña. Cualquier otro caso es 404
   (no se revela que existe). */
const loadCharacter = cache(async (id: string, userId: string) => {
  if (!mongoose.isValidObjectId(id)) return null;
  await connectDB();
  const c = await Character.findById(id).lean();
  if (!c) return null;
  let campaign: { id: string; name: string } | null = null;
  if (c.campaign) {
    const doc = await Campaign.findById(c.campaign).select("name members").lean();
    const member = !!doc?.members?.some((m: unknown) => String(m) === userId);
    if (String(c.owner) !== userId && !member) return null;
    if (doc) campaign = { id: String(doc._id), name: doc.name };
  } else if (String(c.owner) !== userId) return null;
  return { c, campaign };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const user = await requireUser(`/characters/${id}`);
  const found = await loadCharacter(id, user.id);
  return { title: found?.c.name ?? "Personaje" };
}

// Carga las entradas de la hoja con los libros que ve el dueño; las que ya no existen quedan fuera del mapa
async function loadEntries(sheet: Dnd2024Sheet, books: string[]) {
  const entries = new Map<string, CatalogEntry>();
  const tried = new Set<string>();
  const load = async (refs: Ref[]) => {
    const pending = refs.filter((r) => !tried.has(refKey(r)));
    pending.forEach((r) => tried.add(refKey(r)));
    const found = await Promise.all(pending.map((r) => (books.includes(r.book) ? getEntry(r) : null)));
    found.forEach((e, i) => e && entries.set(refKey(pending[i]), e));
    return pending.length;
  };

  const cls = sheet.classes?.[0];
  await load([
    sheet.species?.ref, sheet.lineage?.ref, sheet.background?.ref, cls?.ref, cls?.subclass?.ref,
  ].filter((r): r is Ref => !!r));
  const bg = entries.get(refKey(sheet.background.ref))?.data as BackgroundData | undefined;
  if (bg?.feat) await load([bg.feat]);

  // Equipo elegido: objetos y, por tandas, el contenido de los paquetes
  const klass = cls ? (entries.get(refKey(cls.ref))?.data as ClassData | undefined) : undefined;
  const options = [klass?.equipment?.[cls?.equipment ?? ""] ?? [], bg?.equipment?.[sheet.background.equipment] ?? []];
  for (let i = 0; i < 4; i++) {
    const added = await load(equipmentRefs(options, (k) => entries.get(k)));
    if (added === 0) break;
  }
  return { entries, feat: bg?.feat ? entries.get(refKey(bg.feat)) : undefined };
}

export default async function CharacterPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser(`/characters/${id}`);
  const found = await loadCharacter(id, user.id);
  if (!found) notFound();
  const { c, campaign } = found;
  const sheet = c.sheet as Dnd2024Sheet;
  const system = rpgSystems.find((s) => s.id === c.systemId);
  const isDnd2024 = c.systemId === "dnd-2024" && sheet?.version === 1;

  const visible = (await visibleBooksOf(String(c.owner), c.systemId)).map((b) => b.id);
  const { entries, feat } = isDnd2024 ? await loadEntries(sheet, visible) : { entries: new Map(), feat: undefined };
  const d = isDnd2024 ? derive(sheet, entries) : null;

  // Atribución del SRD si se usa contenido de un libro con esa licencia
  const usedBooks = [...new Set([...entries.values()].map((e) => e.ref.book))];
  const attributions = [...new Set((await booksByIds(usedBooks)).filter((b) => b.license === "srd" && b.attribution).map((b) => b.attribution))];

  const cls = sheet?.classes?.[0];
  const species = sheet?.species?.name ? `${sheet.species.name}${sheet.lineage?.name ? ` (${sheet.lineage.name})` : ""}` : "";
  const summary = [species, cls ? `${cls.name} ${cls.level}` : ""].filter(Boolean).join(" · ");
  const back = campaign ? `/campaigns/${campaign.id}/characters` : "/characters";
  const isOwner = String(c.owner) === user.id;

  const info: { label: string; value: string }[] = isDnd2024
    ? [
        { label: "Trasfondo", value: sheet.background.name },
        { label: "Dote de origen", value: feat ? (feat.nameEs ?? feat.name) : "" },
        { label: "Alineamiento", value: sheet.alignment ? alignmentName(sheet.alignment) : "" },
        { label: "Edad", value: sheet.age },
        { label: "Idiomas", value: sheet.languages },
        { label: "Puntos de experiencia", value: String(sheet.xp ?? 0) },
        { label: "Apariencia", value: sheet.appearance },
      ].filter((x) => x.value)
    : [];

  return (
    <div className="mx-auto max-w-280 px-5 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface text-muted">
            {c.portraitId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/images/${c.portraitId}`} alt="" className="h-full w-full object-cover" />
            ) : (
              <UserIcon size={32} aria-hidden="true" />
            )}
          </div>
          <div>
            <h1 className="font-heading text-3xl font-extrabold">{c.name}</h1>
            {summary && <p className="text-muted">{summary}</p>}
            <nav aria-label="Ruta de navegación" className="mt-1 flex flex-wrap items-center gap-x-2 text-xs uppercase text-muted">
              <span className="text-brand-soft">{system?.name ?? c.systemId}</span>
              <span aria-hidden="true">/</span>
              {campaign && (
                <>
                  <Link href="/campaigns" className="text-brand-soft hover:underline">Campañas</Link>
                  <span aria-hidden="true">/</span>
                  <Link href={`/campaigns/${campaign.id}`} className="text-brand-soft hover:underline">{campaign.name}</Link>
                  <span aria-hidden="true">/</span>
                </>
              )}
              <Link href={back} className="text-brand-soft hover:underline">Personajes</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{c.name}</span>
              {c.status !== "active" && (
                <span className="ml-2 rounded bg-surface px-2 py-0.5">{STATUS_LABEL[c.status as keyof typeof STATUS_LABEL]}</span>
              )}
            </nav>
          </div>
        </div>
        <Link href={isOwner ? "/characters" : back} className="flex items-center gap-1 text-sm text-muted hover:text-white">
          <ChevronLeft size={16} aria-hidden="true" /> Volver
        </Link>
      </header>

      {d && d.missing.length > 0 && (
        <p role="status" className="mb-6 flex items-start gap-2 rounded-md border border-line bg-surface p-3 text-sm text-muted">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-brand-soft" aria-hidden="true" />
          <span>Contenido no disponible: {d.missing.join(", ")}. Se muestra el nombre guardado.</span>
        </p>
      )}

      {d && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className={`${card} animate-fade-up`}>
            <h2 className={cardTitle}>Resumen</h2>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                { label: "PG", value: String(d.hpMax) },
                { label: "CA", value: String(d.ac) },
                { label: "Iniciativa", value: fmtMod(d.initiative) },
                { label: "Velocidad", value: `${d.speed} pies` },
                { label: "Competencia", value: fmtMod(d.proficiencyBonus) },
                { label: "Visión en la oscuridad", value: d.darkvision ? `${d.darkvision} pies` : "—" },
              ].map((s) => (
                <div key={s.label} className="rounded-md bg-surface px-3 py-2">
                  <dt className="text-xs uppercase tracking-wide text-muted">{s.label}</dt>
                  <dd className="font-heading text-xl font-bold">{s.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className={`${card} animate-fade-up`} style={{ animationDelay: "50ms" }}>
            <h2 className={cardTitle}>Características</h2>
            <dl className="grid grid-cols-3 gap-2">
              {ABILITIES.map((a) => (
                <div key={a} className="rounded-md bg-surface px-3 py-2 text-center">
                  <dt className="text-xs uppercase tracking-wide text-muted">{ABILITY_NAMES[a]}</dt>
                  <dd className="font-heading text-xl font-bold">
                    {d.abilities[a].score}{" "}
                    <span className={`text-sm ${modColor(d.abilities[a].mod)}`}>{fmtMod(d.abilities[a].mod)}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className={`${card} animate-fade-up`} style={{ animationDelay: "100ms" }}>
            <h2 className={cardTitle}>Competencias</h2>
            <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="font-semibold">Salvaciones</dt>
              <dd className="text-muted">{d.saves.map((a) => ABILITY_NAMES[a]).join(", ") || "—"}</dd>
              <dt className="font-semibold">Habilidades</dt>
              <dd className="text-muted">{d.skills.map(skillName).join(", ") || "—"}</dd>
              <dt className="font-semibold">Armaduras</dt>
              <dd className="text-muted">{d.armor.map(proficiencyName).join(", ") || "—"}</dd>
              <dt className="font-semibold">Armas</dt>
              <dd className="text-muted">{d.weapons.map(proficiencyName).join(", ") || "—"}</dd>
              <dt className="font-semibold">Herramientas</dt>
              <dd className="text-muted">{d.tools.join(", ") || "—"}</dd>
            </dl>
          </section>

          <section className={`${card} animate-fade-up`} style={{ animationDelay: "150ms" }}>
            <h2 className={cardTitle}>Equipo</h2>
            {d.equipment.length === 0 && !d.gold ? (
              <p className="text-sm text-muted">Sin equipo.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {d.equipment.map((e) => (
                  <li key={e.name}>{e.quantity > 1 ? `${e.quantity}× ` : ""}{e.name}</li>
                ))}
                {d.gold > 0 && (
                  <li className="font-semibold">{d.gold.toLocaleString("es-ES", { maximumFractionDigits: 2 })} po</li>
                )}
              </ul>
            )}
          </section>
        </div>
      )}

      {(info.length > 0 || c.backstory || sheet?.notes || c.imageId) && (
        <section className={`${card} mt-6 animate-fade-up`} style={{ animationDelay: "200ms" }}>
          <h2 className={cardTitle}>Información</h2>
          {c.imageId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/images/${c.imageId}`} alt="" className="mb-4 max-h-96 rounded-md object-contain" />
          )}
          {info.length > 0 && (
            <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
              {info.map((x) => (
                <div key={x.label} className="contents">
                  <dt className="font-semibold">{x.label}</dt>
                  <dd className="whitespace-pre-wrap text-muted">{x.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {c.backstory && (
            <>
              <h3 className="mb-2 mt-5 font-semibold">Historia</h3>
              <Bbcode source={c.backstory} className="text-sm" />
            </>
          )}
          {sheet?.notes && (
            <>
              <h3 className="mb-2 mt-5 font-semibold">Notas</h3>
              <p className="whitespace-pre-wrap text-sm text-muted">{sheet.notes}</p>
            </>
          )}
        </section>
      )}

      {attributions.map((a) => (
        <p key={a} className="mt-6 text-xs text-muted">{a}</p>
      ))}
    </div>
  );
}
