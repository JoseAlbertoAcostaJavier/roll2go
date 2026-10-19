import type { Metadata } from "next";
import ProfileForm from "@/app/components/ProfileForm";
import { requireUser } from "@/lib/currentUser";
import { User } from "@/lib/User";

export const metadata: Metadata = { title: "Editar perfil" };

export default async function ProfileSettingsPage() {
  const me = await requireUser("/settings/profile");
  const u = await User.findById(me.id).select("displayName pronouns location bio").lean();

  return (
    <ProfileForm
      username={me.username}
      avatarUrl={me.avatarUrl}
      initial={{
        displayName: u?.displayName ?? "",
        pronouns: u?.pronouns ?? "",
        location: u?.location ?? "",
        bio: u?.bio ?? "",
      }}
    />
  );
}