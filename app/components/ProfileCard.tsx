import Avatar from "@/app/components/Avatar";
import type { PublicProfile } from "@/lib/userProfile";

export default function ProfileCard({ profile, children }: { profile: PublicProfile; children?: React.ReactNode }) {
  const meta = [profile.pronouns, profile.location].filter(Boolean).join(" · ");
  return (
    <section className="rounded-lg border border-line bg-panel p-6 text-center">
      <div className="mx-auto mb-4 w-fit rounded-full border-4 border-line">
        <Avatar url={profile.avatarUrl} size={136} />
      </div>
      <h1 className="font-heading text-2xl font-extrabold">{profile.displayName}</h1>
      <p className="text-sm text-muted">@{profile.username}</p>
      {meta && <p className="mt-1 text-sm text-muted">{meta}</p>}
      {profile.bio && <p className="mx-auto mt-4 max-w-prose whitespace-pre-wrap break-words text-sm">{profile.bio}</p>}

      <p className="mt-5 flex justify-center gap-6 text-sm text-muted">
        <span>
          <strong className="text-white">{profile.friends}</strong> {profile.friends === 1 ? "Amigo" : "Amigos"}
        </span>
        <span>
          <strong className="text-white">{profile.characters}</strong>{" "}
          {profile.characters === 1 ? "Personaje creado" : "Personajes creados"}
        </span>
      </p>

      {children && <div className="mt-6 flex flex-wrap justify-center gap-3 border-t border-line pt-5">{children}</div>}
    </section>
  );
}