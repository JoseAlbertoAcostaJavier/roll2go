"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, X } from "lucide-react";
import Avatar from "@/app/components/Avatar";
import { card, cardTitle, errorClass, field, labelClass, primaryButton, successClass } from "@/app/components/formStyles";

const SIZE = 256;

async function squareAvatar(file: File): Promise<File> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bmp.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.85));
  if (!blob) throw new Error("blob");
  return new File([blob], "avatar.webp", { type: blob.type });
}

type Errors = Partial<Record<"displayName" | "pronouns" | "location" | "bio" | "avatar", string>>;

export default function ProfileForm({
  username,
  avatarUrl,
  initial,
}: {
  username: string;
  avatarUrl: string | null;
  initial: { displayName: string; pronouns: string; location: string; bio: string };
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [pronouns, setPronouns] = useState(initial.pronouns);
  const [location, setLocation] = useState(initial.location);
  const [bio, setBio] = useState(initial.bio);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const previewRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  const shown = preview ?? (removeAvatar ? null : avatarUrl);

  function discardNew() {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPreview(null);
    setAvatar(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return discardNew();
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
      discardNew();
      setErrors((p) => ({ ...p, avatar: "Usa una imagen PNG, JPG o WebP de menos de 8 MB." }));
      return;
    }
    try {
      const square = await squareAvatar(file);
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = URL.createObjectURL(square);
      setPreview(previewRef.current);
      setAvatar(square);
      setRemoveAvatar(false);
      setErrors((p) => ({ ...p, avatar: undefined }));
    } catch {
      discardNew();
      setErrors((p) => ({ ...p, avatar: "No se pudo procesar la imagen." }));
    }
  }

  async function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setFormError("");
    setSaved(false);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("displayName", displayName);
      fd.set("pronouns", pronouns);
      fd.set("location", location);
      fd.set("bio", bio);
      fd.set("removeAvatar", String(removeAvatar));
      if (avatar) fd.set("avatar", avatar);

      const res = await fetch("/api/profile", { method: "PATCH", body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (data?.errors) setErrors(data.errors);
        else setFormError(data?.error ?? `El servidor ha respondido con un error (${res.status}).`);
        return;
      }
      setErrors({});
      setSaved(true);
      router.refresh();
    } catch {
      setFormError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  const linkButton = "mt-2 flex items-center gap-1 text-sm text-brand-soft hover:underline";

  return (
    <form onSubmit={handleSubmit} noValidate className={card}>
      <h2 className={cardTitle}>Perfil público</h2>

      <div className="mb-6">
        <label htmlFor="avatar" className={labelClass}>Foto de perfil</label>
        <div className="flex items-center gap-4">
          <Avatar url={shown} size={96} />
          <div className="min-w-0">
            <input
              ref={inputRef}
              id="avatar"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={pick}
              className="block w-full text-sm text-muted file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-surface file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-line"
            />
            <p className="mt-1 text-xs text-muted">PNG, JPG o WebP. Se recorta el centro en forma cuadrada.</p>
            {preview && (
              <button type="button" onClick={discardNew} className={linkButton}>
                <X size={14} aria-hidden="true" /> Descartar la foto nueva
              </button>
            )}
            {!preview && shown && (
              <button type="button" onClick={() => setRemoveAvatar(true)} className={linkButton}>
                <X size={14} aria-hidden="true" /> Quitar foto
              </button>
            )}
            {!preview && removeAvatar && avatarUrl && (
              <button type="button" onClick={() => setRemoveAvatar(false)} className={linkButton}>
                Restaurar la foto actual
              </button>
            )}
            {errors.avatar && <p className={errorClass} role="alert">{errors.avatar}</p>}
          </div>
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="displayName" className={labelClass}>Nombre visible</label>
        <input id="displayName" type="text" maxLength={40} value={displayName} placeholder={username} onChange={(e) => setDisplayName(e.target.value)} className={field} />
        <p className="mt-1 text-xs text-muted">Si lo dejas vacío, se mostrará tu nombre de usuario (@{username}).</p>
        {errors.displayName && <p className={errorClass} role="alert">{errors.displayName}</p>}
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pronouns" className={labelClass}>Pronombres</label>
          <input id="pronouns" type="text" maxLength={30} value={pronouns} placeholder="ella, él, elle..." onChange={(e) => setPronouns(e.target.value)} className={field} />
          {errors.pronouns && <p className={errorClass} role="alert">{errors.pronouns}</p>}
        </div>
        <div>
          <label htmlFor="location" className={labelClass}>Ubicación</label>
          <input id="location" type="text" maxLength={60} value={location} placeholder="Ciudad, país" onChange={(e) => setLocation(e.target.value)} className={field} />
          {errors.location && <p className={errorClass} role="alert">{errors.location}</p>}
        </div>
      </div>

      <div className="mb-6">
        <label htmlFor="bio" className={labelClass}>Biografía</label>
        <textarea id="bio" rows={5} maxLength={500} value={bio} onChange={(e) => setBio(e.target.value)} className={field} />
        <p className="mt-1 text-right text-xs text-muted">{bio.length}/500</p>
        {errors.bio && <p className={errorClass} role="alert">{errors.bio}</p>}
      </div>

      {formError && <p className="mb-4 text-sm text-brand-soft" role="alert">{formError}</p>}

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={loading} className={primaryButton}>
          {loading && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
          Guardar cambios
        </button>
        {saved && <span className={successClass} role="status">Perfil guardado.</span>}
        <Link href="/profile" className="text-sm text-muted hover:text-white">Ver mi perfil</Link>
      </div>
    </form>
  );
}