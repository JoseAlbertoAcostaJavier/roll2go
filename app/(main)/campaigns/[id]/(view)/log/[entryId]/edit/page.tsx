import { notFound } from "next/navigation";
import LogEntryForm from "@/app/components/campaigns/LogEntryForm";
import { getCampaignAccess } from "@/lib/server/campaigns/campaignAccess";
import { logEntryForEdit } from "@/lib/server/campaigns/queries";

export default async function EditLogEntryPage({ params }: { params: Promise<{ id: string; entryId: string }> }) {
  const { id, entryId } = await params;
  const { session } = await getCampaignAccess(id);

  // Solo el autor puede editar su nota
  const entry = await logEntryForEdit(id, entryId, session.id);
  if (!entry) notFound();

  return (
    <section>
      <h2 className="mb-5 font-heading text-lg font-bold uppercase tracking-wide">Editar nota</h2>
      <LogEntryForm
        campaignId={id}
        entryId={entryId}
        initial={{ title: entry.title, content: entry.content, visibility: entry.visibility }}
      />
    </section>
  );
}