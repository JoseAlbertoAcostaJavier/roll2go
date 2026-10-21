import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import ConfirmAction from "@/app/components/ConfirmAction";
import FriendActions from "@/app/components/FriendActions";
import ProfileCard from "@/app/components/ProfileCard";
import { requireUser } from "@/lib/currentUser";
import { getPublicProfile } from "@/lib/userProfile";
import { relationBetween } from "@/lib/friends";
import { blockStatus } from "@/lib/blocks";

export const metadata: Metadata = { title: "Perfil" };

export default async function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const me = await requireUser(`/users/${username}`);
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) notFound();
  if (username.toLowerCase() === me.username.toLowerCase()) redirect("/profile");

  const profile = await getPublicProfile(username);
  if (!profile) notFound();
  const [relation, block] = await Promise.all([relationBetween(me.id, profile.id), blockStatus(me.id, profile.id)]);

  return (
    <div className="mx-auto max-w-xl px-5 py-10">
      <ProfileCard profile={profile}>
        {block.byMe ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-muted">Has bloqueado a {username}.</p>
            <ConfirmAction
              url={`/api/blocks/${profile.username}`}
              method="DELETE"
              label="Desbloquear"
              question="¿Desbloquear a este usuario?"
              confirmLabel="Sí, desbloquear"
            />
          </div>
        ) : block.byThem ? null : (
          <div className="flex flex-col items-center gap-4">
            <FriendActions username={profile.username} initialRelation={relation} showStatus />
            <ConfirmAction
              url={`/api/blocks/${profile.username}`}
              method="PUT"
              label="Bloquear usuario"
              question={`¿Quieres bloquear a ${username}? Dejará de poder escribirte y enviarte solicitudes.`}
              confirmLabel="Sí, bloquear"
            />
          </div>
        )}
      </ProfileCard>
    </div>
  );
}