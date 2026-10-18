import { notFound } from "next/navigation";
import mongoose from "mongoose";
import LogEntryForm from "@/app/components/LogEntryForm";
import { getCampaignAccess } from "@/lib/campaignAccess";
import { CampaignLogEntry } from "@/lib/CampaignLogEntry";

export default async function EditLogEntryPage({ params }: { params: Promise<{ id: string; entryId: string }> }) {
  const { id, entryId } = await params;
  const { session } = await getCampaignAccess(id);
  if (!mongoose.isValidObjectId(entryId)) notFound();

  // Solo el autor puede editar su nota
  const entry = await CampaignLogEntry.findOne({ _id: entryId, campaign: id, author: session.id }).lean();
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