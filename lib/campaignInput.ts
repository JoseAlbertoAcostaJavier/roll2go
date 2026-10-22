import { system as rpgSystems } from "@/lib/systems";
import { officialBooksOf } from "@/lib/rules/books";
import { detectImageType } from "@/lib/images";
import { CampaignImage } from "@/lib/CampaignImage";

const MAX_IMAGE = 2 * 1024 * 1024; // 2 MB
const MAX_LOGO = 1 * 1024 * 1024; // 1 MB

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
const flag = (v: FormDataEntryValue | null) => v === "true";

export type NewImage = { data: Buffer; contentType: string };

// Lee y valida un archivo de imagen. Si no se ha enviado archivo, no hay imagen ni error.
async function readImage(
  entry: FormDataEntryValue | null,
  maxBytes: number,
): Promise<{ image?: NewImage; error?: string }> {
  if (!(entry instanceof File) || entry.size === 0) return {};
  if (entry.size > maxBytes)
    return {
      error: `La imagen no puede pesar más de ${maxBytes / 1024 / 1024} MB.`,
    };
  const data = Buffer.from(await entry.arrayBuffer());
  const contentType = detectImageType(data);
  if (!contentType) return { error: "Usa una imagen PNG, JPG o WebP." };
  return { image: { data, contentType } };
}

// Guarda una imagen en MongoDB y devuelve su id
export async function storeImage(img: NewImage, owner: string) {
  const doc = await CampaignImage.create({ ...img, owner });
  return doc._id;
}

/* Valida los datos del formulario de campaña (el servidor repite todas las comprobaciones del navegador).
   ownedBooks: libros que se pueden aprobar. lockedSystemId: al editar, el sistema no cambia. */
export async function parseCampaignForm(
  form: FormData,
  opts: { ownedBooks: string[]; lockedSystemId?: string },
) {
  const name = text(form.get("name")).trim();
  const systemId = opts.lockedSystemId ?? text(form.get("systemId"));
  const statusRaw = text(form.get("status"));
  const shortDescription = text(form.get("shortDescription")).trim();
  const description = text(form.get("description"));
  const privateNotes = text(form.get("privateNotes"));
  const restrictBooks = flag(form.get("restrictBooks"));
  const allowCharacters = flag(form.get("allowCharacters"));
  const allowInternal = flag(form.get("allowInternal"));
  const allowExternal = flag(form.get("allowExternal"));

  let allowedBooks: string[] = [];
  try {
    const parsed = JSON.parse(text(form.get("allowedBooks")) || "[]");
    if (Array.isArray(parsed))
      allowedBooks = parsed.filter((b): b is string => typeof b === "string");
  } catch {
    // JSON mal formado: se trata como lista vacía
  }

  const errors: Record<string, string> = {};
  if (name.length < 3 || name.length > 80)
    errors.name = "El nombre debe tener entre 3 y 80 caracteres.";
  if (!rpgSystems.some((s) => s.id === systemId))
    errors.systemId = "Elige un sistema de rol.";
  if (statusRaw !== "active" && statusRaw !== "inactive")
    errors.status = "Estado no válido.";
  if (shortDescription.length > 300)
    errors.shortDescription = "Máximo 300 caracteres.";
  if (description.length > 100000)
    errors.description = "La descripción es demasiado larga.";
  if (privateNotes.length > 20000)
    errors.privateNotes = "Las notas son demasiado largas.";
  if (allowCharacters && !allowInternal && !allowExternal) {
    errors.characters =
      "Elige si se admiten personajes internos, externos o ambos.";
  }

  if (restrictBooks && !errors.systemId) {
    const inSystem = new Set((await officialBooksOf(systemId)).map((b) => b.id));
    const owned = new Set(opts.ownedBooks);
    allowedBooks = [...new Set(allowedBooks)];
    if (allowedBooks.length === 0)
      errors.books = "Selecciona al menos un libro.";
    else if (allowedBooks.some((id) => !inSystem.has(id) || !owned.has(id))) {
      errors.books =
        "Hay libros que no son de ese sistema o que no tienes en tu perfil.";
    }
  } else {
    allowedBooks = [];
  }

  const image = await readImage(form.get("image"), MAX_IMAGE);
  const logo = await readImage(form.get("logo"), MAX_LOGO);
  if (image.error) errors.image = image.error;
  if (logo.error) errors.logo = logo.error;

  return {
    errors,
    value: {
      name,
      systemId,
      status: statusRaw as "active" | "inactive",
      shortDescription,
      description,
      privateNotes,
      restrictBooks,
      allowedBooks,
      characters: allowCharacters
        ? { allowed: true, internal: allowInternal, external: allowExternal }
        : { allowed: false, internal: false, external: false },
    },
    image: image.image,
    logo: logo.image,
    removeImage: flag(form.get("removeImage")),
    removeLogo: flag(form.get("removeLogo")),
  };
}
