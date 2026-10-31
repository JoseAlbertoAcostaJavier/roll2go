import "server-only";
import { connectDB } from "@/lib/models/mongodb";
import { CampaignImage } from "@/lib/models/CampaignImage";
import { isValidId } from "@/lib/server/ids";

// Detecta el tipo REAL de la imagen mirando sus primeros bytes (el nombre o el tipo que declara el
// navegador se pueden falsificar). SVG no se admite a propósito: puede llevar scripts.
export function detectImageType(
  b: Buffer,
): "image/png" | "image/jpeg" | "image/webp" | null {
  if (
    b.length > 12 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  )
    return "image/png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return "image/jpeg";
  if (
    b.length > 12 &&
    b.toString("ascii", 0, 4) === "RIFF" &&
    b.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

// Imagen guardada (foto de perfil, de campaña o de personaje), o null si el id no es válido o no existe
export async function loadImage(id: string): Promise<{ data: Buffer; contentType: string } | null> {
  if (!isValidId(id)) return null;
  await connectDB();
  const img = await CampaignImage.findById(id);
  if (!img) return null;
  return { data: img.data, contentType: img.contentType };
}
