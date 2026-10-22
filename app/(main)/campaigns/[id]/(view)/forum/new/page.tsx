import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import ForumPostForm from "@/app/components/ForumPostForm";
import { getCampaignAccess } from "@/lib/campaignAccess";

export default async function NewForumPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await getCampaignAccess(id); // cualquier participante puede escribir

  return (
    <section>
      <Link href={`/campaigns/${id}/forum`} className="mb-4 flex items-center gap-1 text-sm text-muted hover:text-white">
        <ChevronLeft size={16} aria-hidden="true" /> Foro
      </Link>
      <h2 className="mb-5 font-heading text-lg font-bold uppercase tracking-wide">Nuevo mensaje</h2>
      <ForumPostForm campaignId={id} kind="post" />
    </section>
  );
}