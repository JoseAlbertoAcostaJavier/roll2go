import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PdfViewer from "@/app/components/ui/PdfViewer";
import { requireUser } from "@/lib/server/auth/currentUser";
import { loadCharacterFor } from "@/lib/server/characters/characterAccess";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Ficha en PDF" };

export default async function CharacterPdfPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser(`/characters/${id}/pdf`);
  const found = await loadCharacterFor(user.id, id, "read");
  if (!found) notFound();
  return <PdfViewer url={`/api/characters/${id}/pdf`} filename={`${found.character.name}.pdf`} backHref={`/characters/${id}`} />;
}
