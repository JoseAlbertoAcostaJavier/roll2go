import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import FriendActions from "@/app/components/FriendActions";
import ProfileCard from "@/app/components/ProfileCard";
import { requireUser } from "@/lib/currentUser";
import { getPublicProfile } from "@/lib/userProfile";
import { relationBetween } from "@/lib/friends";

export const metadata: Metadata = { title: "Perfil" };

export default async function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const me = await requireUser(`/users/${username}`);
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) notFound();
  if (username.toLowerCase() === me.username.toLowerCase()) redirect("/profile");

  const profile = await getPublicProfile(username);
  if (!profile) notFound();
  const relation = await relationBetween(me.id, profile.id);

  return (
    <div className="mx-auto max-w-xl px-5 py-10">
      <ProfileCard profile={profile}>
        <FriendActions username={profile.username} initialRelation={relation} showStatus />
      </ProfileCard>
    </div>
  );
}