"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImagePlus, LoaderCircle, X } from "lucide-react";
import BbcodeEditor from "@/app/components/BbcodeEditor";

type Option = { id: string; name: string };
type Book = { id: string; systemId: string; name: string };
type Errors = Partial<
  Record<"name" | "systemId" | "shortDescription" | "description" | "privateNotes" | "books" | "characters" | "image" | "logo", string>
>;

// Valores de partida al editar una campaña que ya existe
export type CampaignInitial = {
  name: string;
  systemId: string;
  status: "active" | "inactive";
  shortDescription: string;
  description: string;
  privateNotes: string;
  restrictBooks: boolean;
  allowedBooks: string[];
  allowCharacters: boolean;
  allowInternal: boolean;
  allowExternal: boolean;
  imageUrl: string | null;
  logoUrl: string | null;
};

const field =
  "w-full rounded-md border border-line bg-surface px-3 py-2.5 text-fg placeholder:text-muted focus:border-brand focus:outline-none";
const labelClass = "mb-1.5 block text-sm font-semibold";
const sectionClass = "rounded-lg border border-line bg-panel p-5 sm:p-6";
const sectionTitle = "mb-4 border-l-4 border-brand pl-3 font-heading text-xl font-bold";
const errorClass = "mt-1 text-xs text-brand-soft";
const linkButton = "mt-2 flex items-center gap-1 text-sm text-brand-soft hover:underline";

/* Selector de imagen con vista previa y validación de tipo y tamaño.
   currentUrl: imagen que ya tiene la campaña (al editar). onRemove(true) = hay que borrar la actual. */
function ImagePicker({
  id, label, hint, maxMB, previewClass, currentUrl, onFile, onRemove, error,
}: {
  id: string; label: string; hint: string; maxMB: number; previewClass: string;
  currentUrl?: string | null;
  onFile: (f: File | null) => void;
  onRemove: (remove: boolean) => void;
  error?: string;
}) {
  const [url, setUrl] = useState<string | null>(null); // vista previa del archivo nuevo
  const [removed, setRemoved] = useState(false);
  const [localError, setLocalError] = useState("");
  const urlRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Al desmontar, se libera la vista previa
  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  // Descarta el archivo nuevo (si lo hay)
  function clearFile() {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setUrl(null);
    onFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function setRemove(value: boolean) {
    setRemoved(value);
    onRemove(value);
  }

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return clearFile();
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      clearFile();
      setLocalError("Usa una imagen PNG, JPG o WebP.");
      return;
    }
    if (file.size > maxMB * 1024 * 1024) {
      clearFile();
      setLocalError(`La imagen no puede pesar más de ${maxMB} MB.`);
      return;
    }
    setLocalError("");
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = URL.createObjectURL(file);
    setUrl(urlRef.current);
    onFile(file);
    setRemove(false); // si había marcado quitar la actual, la nueva la sustituye
  }

  // Lo que se muestra: el archivo nuevo, o la imagen actual si no se ha quitado
  const shown = url ?? (removed ? null : currentUrl ?? null);

  return (
    <div>
      <label htmlFor={id} className={labelClass}>{label}</label>
      <div className="flex items-start gap-4">
        <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-line bg-surface text-muted ${previewClass}`}>
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus size={26} aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0">
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={pick}
            className="block w-full text-sm text-muted file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-surface file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-line"
          />
          <p className="mt-1 text-xs text-muted">{hint}</p>
          {url && (
            <button type="button" onClick={clearFile} className={linkButton}>
              <X size={14} aria-hidden="true" /> {currentUrl ? "Descartar la imagen nueva" : "Quitar imagen"}
            </button>
          )}
          {!url && shown && (
            <button type="button" onClick={() => setRemove(true)} className={linkButton}>
              <X size={14} aria-hidden="true" /> Quitar imagen
            </button>
          )}
          {!url && removed && currentUrl && (
            <button type="button" onClick={() => setRemove(false)} className={linkButton}>
              Restaurar la imagen actual
            </button>
          )}
          {(localError || error) && <p className={errorClass} role="alert">{localError || error}</p>}
        </div>
      </div>
    </div>
  );
}

export default function CampaignForm({
  systems, books, ownedBooks, mode = "create", campaignId, initial,
}: {
  systems: Option[]; books: Book[]; ownedBooks: string[];
  mode?: "create" | "edit"; campaignId?: string; initial?: CampaignInitial;
}) {
  const router = useRouter();
  const editing = mode === "edit";

  const [name, setName] = useState(initial?.name ?? "");
  const [systemId, setSystemId] = useState(initial?.systemId ?? "");
  const [status, setStatus] = useState<"active" | "inactive">(initial?.status ?? "active");
  const [image, setImage] = useState<File | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [shortDescription, setShortDescription] = useState(initial?.shortDescription ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [privateNotes, setPrivateNotes] = useState(initial?.privateNotes ?? "");
  const [restrictBooks, setRestrictBooks] = useState(initial?.restrictBooks ?? false);
  const [selectedBooks, setSelectedBooks] = useState<string[]>(initial?.allowedBooks ?? []);
  const [allowCharacters, setAllowCharacters] = useState(initial?.allowCharacters ?? true);
  const [allowInternal, setAllowInternal] = useState(initial?.allowInternal ?? true);
  const [allowExternal, setAllowExternal] = useState(initial?.allowExternal ?? true);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  // Libros del sistema elegido que el usuario tiene en su perfil
  const available = books.filter((b) => b.systemId === systemId && ownedBooks.includes(b.id));

  function changeSystem(id: string) {
    setSystemId(id);
    setSelectedBooks([]); // los libros elegidos eran de otro sistema
  }
  const toggleBook = (id: string) =>
    setSelectedBooks((cur) => (cur.includes(id) ? cur.filter((b) => b !== id) : [...cur, id]));

  function validate(): Errors {
    const e: Errors = {};
    if (name.trim().length < 3 || name.trim().length > 80) e.name = "El nombre debe tener entre 3 y 80 caracteres.";
    if (!systemId) e.systemId = "Elige un sistema de rol.";
    if (restrictBooks && selectedBooks.length === 0) e.books = "Selecciona al menos un libro.";
    if (allowCharacters && !allowInternal && !allowExternal) {
      e.characters = "Elige si se admiten personajes internos, externos o ambos.";
    }
    return e;
  }

  async function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setFormError("");
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("systemId", systemId);
    fd.set("status", status);
    fd.set("shortDescription", shortDescription.trim());
    fd.set("description", description);
    fd.set("privateNotes", privateNotes);
    fd.set("restrictBooks", String(restrictBooks));
    fd.set("allowedBooks", JSON.stringify(restrictBooks ? selectedBooks : []));
    fd.set("allowCharacters", String(allowCharacters));
    fd.set("allowInternal", String(allowInternal));
    fd.set("allowExternal", String(allowExternal));
    fd.set("removeImage", String(removeImage));
    fd.set("removeLogo", String(removeLogo));
    if (image) fd.set("image", image);
    if (logo) fd.set("logo", logo);

    setLoading(true);
    try {
      // Sin cabecera Content-Type: el navegador la añade con el límite del formulario multipart
      const res = await fetch(editing ? `/api/campaigns/${campaignId}` : "/api/campaigns", {
        method: editing ? "PATCH" : "POST",
        body: fd,
      });
      // Si el servidor responde con algo que no es JSON (una página de error), no se rompe
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (data?.errors) setErrors(data.errors);
        else setFormError(data?.error ?? `El servidor ha respondido con un error (${res.status}).`);
        return;
      }
      router.push(`/campaigns/${editing ? campaignId : data.id}`);
      router.refresh();
    } catch {
      setFormError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {/* Datos básicos */}
      <section className={sectionClass}>
        <h2 className={sectionTitle}>Datos básicos</h2>

        <div className="mb-4">
          <label htmlFor="systemId" className={labelClass}>Sistema de rol</label>
          <select
            id="systemId"
            value={systemId}
            disabled={editing}
            onChange={(e) => changeSystem(e.target.value)}
            className={`${field} disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <option value="">Elige un sistema...</option>
            {systems.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {editing && (
            <p className="mt-1 text-xs text-muted">El sistema no se puede cambiar una vez creada la campaña.</p>
          )}
          {errors.systemId && <p className={errorClass} role="alert">{errors.systemId}</p>}
        </div>

        <div className="mb-4">
          <label htmlFor="name" className={labelClass}>Nombre de la campaña</label>
          <input id="name" type="text" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={field} />
          {errors.name && <p className={errorClass} role="alert">{errors.name}</p>}
        </div>

        <fieldset>
          <legend className={labelClass}>Estado</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              ["active", "Activa", "Se muestra en el listado principal de campañas."],
              ["inactive", "Inactiva", "Solo se muestra cuando filtras por campañas inactivas."],
            ] as const).map(([value, title, desc]) => (
              <label
                key={value}
                className={`flex cursor-pointer gap-3 rounded-md border p-3 ${
                  status === value ? "border-brand bg-brand/10" : "border-line"
                }`}
              >
                <input
                  type="radio"
                  name="status"
                  value={value}
                  checked={status === value}
                  onChange={() => setStatus(value)}
                  className="mt-1 accent-brand"
                />
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-sm text-muted">{desc}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      {/* Imágenes */}
      <section className={sectionClass}>
        <h2 className={sectionTitle}>Imágenes</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <ImagePicker
            id="image"
            label="Imagen"
            hint="PNG, JPG o WebP, máximo 2 MB. Se usa como portada."
            maxMB={2}
            previewClass="h-24 w-36"
            currentUrl={initial?.imageUrl}
            onFile={setImage}
            onRemove={setRemoveImage}
            error={errors.image}
          />
          <ImagePicker
            id="logo"
            label="Logo"
            hint="PNG, JPG o WebP, máximo 1 MB. Mejor cuadrado."
            maxMB={1}
            previewClass="h-24 w-24"
            currentUrl={initial?.logoUrl}
            onFile={setLogo}
            onRemove={setRemoveLogo}
            error={errors.logo}
          />
        </div>
      </section>

      {/* Detalles */}
      <section className={sectionClass}>
        <h2 className={sectionTitle}>Detalles</h2>

        <div className="mb-5">
          <label htmlFor="shortDescription" className={labelClass}>Descripción corta</label>
          <textarea
            id="shortDescription"
            rows={3}
            maxLength={300}
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            className={field}
          />
          <p className="mt-1 text-right text-xs text-muted">{shortDescription.length}/300</p>
        </div>

        <div className="mb-5">
          <label htmlFor="description" className={labelClass}>Descripción</label>
          <BbcodeEditor id="description" value={description} onChange={setDescription} />
          {errors.description && <p className={errorClass} role="alert">{errors.description}</p>}
        </div>

        <div>
          <label htmlFor="privateNotes" className={labelClass}>Notas privadas</label>
          <textarea
            id="privateNotes"
            rows={5}
            maxLength={20000}
            value={privateNotes}
            onChange={(e) => setPrivateNotes(e.target.value)}
            className={field}
          />
          <p className="mt-1 text-xs text-muted">Solo las verás tú, como DM. Los jugadores no tendrán acceso.</p>
          {errors.privateNotes && <p className={errorClass} role="alert">{errors.privateNotes}</p>}
        </div>
      </section>

      {/* Libros de reglas */}
      <section className={sectionClass}>
        <h2 className={sectionTitle}>Libros de reglas</h2>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={restrictBooks}
            onChange={(e) => setRestrictBooks(e.target.checked)}
            className="mt-1 h-4 w-4 accent-brand"
          />
          <span>
            <span className="block font-semibold">Limitar los libros de reglas disponibles</span>
            <span className="block text-sm text-muted">
              Al crear un personaje en la campaña, los jugadores solo verán los libros que apruebes. Sin límite,
              tus jugadores podrán usar cualquier libro que deseen.
            </span>
          </span>
        </label>

        {restrictBooks && (
          <div className="mt-4 rounded-md border border-line bg-surface p-4">
            {!systemId ? (
              <p className="text-sm text-muted">Elige primero un sistema de rol.</p>
            ) : available.length === 0 ? (
              <p className="text-sm text-muted">
                No tienes libros de este sistema en tu perfil. Añádelos en{" "}
                <Link href="/profile" className="font-semibold text-white hover:text-brand-soft">tu perfil</Link>{" "}
                para poder elegirlos aquí.
              </p>
            ) : (
              <fieldset>
                <legend className="mb-2 text-sm text-muted">Tus libros de este sistema:</legend>
                <div className="space-y-2">
                  {available.map((b) => (
                    <label key={b.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedBooks.includes(b.id)}
                        onChange={() => toggleBook(b.id)}
                        className="h-4 w-4 accent-brand"
                      />
                      {b.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {errors.books && <p className={errorClass} role="alert">{errors.books}</p>}
          </div>
        )}
      </section>

      {/* Personajes */}
      <section className={sectionClass}>
        <h2 className={sectionTitle}>Personajes</h2>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={allowCharacters}
            onChange={(e) => setAllowCharacters(e.target.checked)}
            className="mt-1 h-4 w-4 accent-brand"
          />
          <span>
            <span className="block font-semibold">Permitir añadir personajes</span>
            <span className="block text-sm text-muted">Elige qué tipos de personaje pueden unirse a la campaña.</span>
          </span>
        </label>

        {allowCharacters && (
          <div className="mt-4 space-y-3 rounded-md border border-line bg-surface p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={allowInternal} onChange={(e) => setAllowInternal(e.target.checked)} className="mt-1 h-4 w-4 accent-brand" />
              <span>
                <span className="block text-sm font-semibold">Internos</span>
                <span className="block text-sm text-muted">
                  Permite personajes creados desde la propia campaña, usando los libros de reglas restringidos.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={allowExternal} onChange={(e) => setAllowExternal(e.target.checked)} className="mt-1 h-4 w-4 accent-brand" />
              <span>
                <span className="block text-sm font-semibold">Externos</span>
                <span className="block text-sm text-muted">
                  Permite añadir personajes creados de manera independiente, fuera de la campaña. 
                  <br></br>
                  Pueden no usar los libros de reglas establecidos
                </span>
              </span>
            </label>
            {errors.characters && <p className={errorClass} role="alert">{errors.characters}</p>}
          </div>
        )}
      </section>

      {formError && <p className="text-sm text-brand-soft" role="alert">{formError}</p>}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 rounded-md bg-brand px-6 py-2.5 font-heading font-bold text-white transition-colors enabled:hover:bg-brand-hover disabled:opacity-50"
        >
          {loading && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
          {editing ? (loading ? "Guardando..." : "Guardar cambios") : loading ? "Creando..." : "Crear campaña"}
        </button>
        <Link href={editing ? `/campaigns/${campaignId}` : "/campaigns"} className="text-sm text-muted hover:text-white">
          Cancelar
        </Link>
      </div>
    </form>
  );
}