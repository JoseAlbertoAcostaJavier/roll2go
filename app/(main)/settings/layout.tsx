import SettingsNav from "@/app/components/SettingsNav";
import { requireUser } from "@/lib/currentUser";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireUser("/settings/profile");
  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <h1 className="mb-6 font-heading text-3xl font-extrabold">Ajustes</h1>
      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <SettingsNav />
        <div>{children}</div>
      </div>
    </div>
  );
}