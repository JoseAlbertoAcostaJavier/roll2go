import type { Metadata } from "next";
import ProfileForm from "@/app/components/account/ProfileForm";
import { requireUser } from "@/lib/server/auth/currentUser";
import { profileFields } from "@/lib/server/account/settings";

export const metadata: Metadata = { title: "Editar perfil" };

export default async function ProfileSettingsPage() {
  const me = await requireUser("/settings/profile");
  const fields = await profileFields(me.id);

  return (
    <ProfileForm
      username={me.username}
      avatarUrl={me.avatarUrl}
      initial={fields}
    />
  );
}