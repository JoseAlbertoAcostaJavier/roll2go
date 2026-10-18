import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { CampaignImage } from "@/lib/CampaignImage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id))
    return new Response("No encontrada", { status: 404 });

  await connectDB();
  const img = await CampaignImage.findById(id);
  if (!img) return new Response("No encontrada", { status: 404 });

  return new Response(new Uint8Array(img.data), {
    headers: {
      "Content-Type": img.contentType,
      // El id cambia si se sube otra imagen, así que se puede cachear para siempre
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
