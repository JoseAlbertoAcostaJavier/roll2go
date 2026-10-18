import LogEntryForm from "@/app/components/LogEntryForm";
import { getCampaignAccess } from "@/lib/campaignAccess";

export default async function NewLogEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await getCampaignAccess(id); // cualquier miembro puede escribir notas

  return (
    <section>
      <h2 className="mb-5 font-heading text-lg font-bold uppercase tracking-wide">Nueva nota</h2>
      <LogEntryForm campaignId={id} />
    </section>
  );
}