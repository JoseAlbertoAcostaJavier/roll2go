"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { card, cardTitle, errorClass, field, labelClass, primaryButton } from "@/app/components/formStyles";
import type { Pronoun } from "@/lib/rules/dnd2024/names";
import NameGeneratorButton from "./NameGeneratorButton";
import FieldError from "./fields/FieldError";
import ImageFields from "./fields/ImageFields";
import InfoFields, { type InfoValues } from "./fields/InfoFields";
import PronounsField from "./fields/PronounsField";
import StatusField from "./fields/StatusField";
import { LIMITS, type Status } from "./fields/constants";

type Initial = InfoValues & {
  name: string;
  pronouns: Pronoun[];
  status: Status;
  portraitUrl: string | null;
  imageUrl: string | null;
};

// Errores con campo propio en el formulario; el resto va junto al botón de guardar
const SHOWN_ERRORS = new Set(["name", "pronouns", "status", "portrait", "image", "alignment", "age", "xp", "appearance", "backstory", "languages", "notes"]);

/* Edición de los datos del personaje: nombre, pronombres, estado, imágenes y los campos de información.
   `speciesIdentifier` es la especie para el generador de nombres. */
export default function CharacterEditForm({
  characterId, speciesIdentifier, initial,
}: {
  characterId: string;
  speciesIdentifier: string;
  initial: Initial;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [pronouns, setPronouns] = useState<Pronoun[]>(initial.pronouns);
  const [status, setStatus] = useState<Status>(initial.status);
  const [info, setInfo] = useState<InfoValues>({
    alignment: initial.alignment, age: initial.age, xp: initial.xp,
    appearance: initial.appearance, backstory: initial.backstory, languages: initial.languages, notes: initial.notes,
  });
  const [portrait, setPortrait] = useState<File | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [removePortrait, setRemovePortrait] = useState(false);
  const [removeImage, setRemoveImage] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [scrollTick, setScrollTick] = useState(0);

  // Tras un envío con errores, se lleva la vista al primero
  useEffect(() => {
    if (scrollTick === 0) return;
    document.querySelector("[data-field-error]")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [scrollTick]);

  function clearErrors(keys: string[]) {
    if (!keys.length) return;
    setErrors((e) => {
      if (!keys.some((k) => e[k])) return e;
      const next = { ...e };
      for (const k of keys) delete next[k];
      return next;
    });
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (loading) return;
    setFormError("");

    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("pronouns", pronouns.join(","));
    fd.set("status", status);
    for (const [k, v] of Object.entries(info)) fd.set(k, k === "xp" && v.trim() === "" ? "0" : v);
    if (portrait) fd.set("portrait", portrait);
    if (image) fd.set("image", image);
    if (removePortrait) fd.set("removePortrait", "true");
    if (removeImage) fd.set("removeImage", "true");

    setLoading(true);
    try {
      const res = await fetch(`/api/characters/${characterId}`, { method: "PATCH", body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (data?.errors) {
          setErrors(data.errors);
          setScrollTick((t) => t + 1);
        } else setFormError(data?.error ?? `El servidor ha respondido con un error (${res.status}).`);
        return;
      }
      router.push(`/characters/${characterId}?saved=1`);
      router.refresh();
    } catch {
      setFormError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  const generalErrors = Object.entries(errors).filter(([k]) => !SHOWN_ERRORS.has(k));
  const errorCount = Object.keys(errors).length;

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <section className={`${card} animate-fade-up`}>
        <h2 className={cardTitle}>Detalles</h2>
        <div className="space-y-5">
          <div>
            <label htmlFor="name" className={labelClass}>Nombre *</label>
            <div className="flex flex-wrap items-start gap-2">
              <input
                id="name"
                className={`${field} min-w-0 flex-1`}
                maxLength={LIMITS.name}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearErrors(["name"]);
                }}
              />
              <NameGeneratorButton
                species={speciesIdentifier}
                pronouns={pronouns}
                onName={(n) => {
                  setName(n);
                  clearErrors(["name"]);
                }}
              />
            </div>
            <FieldError errors={errors} keys={["name"]} />
          </div>
          <div>
            <PronounsField
              value={pronouns}
              onChange={(p) => {
                setPronouns(p);
                clearErrors(["pronouns"]);
              }}
            />
            <FieldError errors={errors} keys={["pronouns"]} />
          </div>
          <ImageFields
            errors={errors}
            portraitUrl={initial.portraitUrl}
            imageUrl={initial.imageUrl}
            onPortrait={setPortrait}
            onImage={setImage}
            onRemovePortrait={setRemovePortrait}
            onRemoveImage={setRemoveImage}
          />
        </div>
      </section>

      <section className={`${card} animate-fade-up`} style={{ animationDelay: "50ms" }}>
        <h2 className={cardTitle}>Estado</h2>
        <StatusField
          value={status}
          onChange={(s) => {
            setStatus(s);
            clearErrors(["status"]);
          }}
          errors={errors}
        />
      </section>

      <section className={`${card} animate-fade-up`} style={{ animationDelay: "100ms" }}>
        <h2 className={cardTitle}>Información</h2>
        <InfoFields
          values={info}
          errors={errors}
          onChange={(patch, ...keys) => {
            setInfo((i) => ({ ...i, ...patch }));
            clearErrors(keys);
          }}
        />
      </section>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {generalErrors.map(([k, msg]) => (
          <p key={k} className={errorClass} role="alert" data-field-error>{msg}</p>
        ))}
        {formError && <p className={errorClass} role="alert">{formError}</p>}
        <Link
          href={`/characters/${characterId}`}
          className="rounded-md border border-line px-4 py-2.5 text-sm font-semibold text-muted transition-colors hover:text-white"
        >
          Cancelar
        </Link>
        <button type="submit" disabled={loading} className={primaryButton}>
          {loading && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
          Guardar cambios
          {errorCount > 0 && (
            <span className="rounded-full bg-white/20 px-2 text-xs">
              {errorCount} {errorCount === 1 ? "problema" : "problemas"}
            </span>
          )}
        </button>
      </div>
    </form>
  );
}
