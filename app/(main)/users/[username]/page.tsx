import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import ProfileCard from "@/app/components/ProfileCard";
import { requireUser } from "@/lib/currentUser";
import { getPublicProfile } from "@/lib/userProfile";

export const metadata: Metadata = { title: "Perfil" };

export default async function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const me = await requireUser(`/users/${username}`);
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) notFound();
  if (username.toLowerCase() === me.username.toLowerCase()) redirect("/profile");

  const profile = await getPublicProfile(username);
  if (!profile) notFound();

  // Los botones de amistad y de mensaje se añaden en la entrega de Social
  return (
    <div className="mx-auto max-w-xl px-5 py-10">
      <ProfileCard profile={profile} />
    </div>
  );
}