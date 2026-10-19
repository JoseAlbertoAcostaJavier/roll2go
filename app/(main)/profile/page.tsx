import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import ProfileCard from "@/app/components/ProfileCard";
import { requireUser } from "@/lib/currentUser";
import { getPublicProfile } from "@/lib/userProfile";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function MyProfilePage() {
  const me = await requireUser("/profile");
  const profile = await getPublicProfile(me.username);
  if (!profile) notFound();

  return (
    <div className="mx-auto max-w-xl px-5 py-10">
      <ProfileCard profile={profile}>
        <Link
          href="/settings/profile"
          className="flex items-center gap-2 rounded-md border border-brand px-4 py-2 text-sm font-bold text-brand-soft transition-colors hover:bg-brand hover:text-white"
        >
          <Pencil size={14} aria-hidden="true" /> Editar perfil
        </Link>
      </ProfileCard>
    </div>
  );
}