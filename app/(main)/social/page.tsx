import type { Metadata } from "next";
import Link from "next/link";
import Avatar from "@/app/components/ui/Avatar";
import FriendActions from "@/app/components/social/FriendActions";
import UserSearch from "@/app/components/social/UserSearch";
import { requireUser } from "@/lib/server/auth/currentUser";
import type { Relation } from "@/lib/shared/users";
import ConfirmAction from "@/app/components/ui/ConfirmAction";
import { socialOverview, type SocialPerson } from "@/lib/server/social/queries";
export const metadata: Metadata = { title: "Social" };

type Person = SocialPerson;

/* La tarjeta entera abre el perfil gracias al enlace "estirado" del nombre; las acciones quedan por encima (z-10). */
function PersonCard({ p, index }: { p: Person; index: number }) {
  const status = { friend: "", outgoing: "Solicitud enviada", incoming: "Te ha enviado una solicitud", none: "" }[p.relation];
  return (
    <li
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
      className="group relative flex animate-fade-up gap-4 rounded-xl border border-line bg-panel p-4 transition-all duration-200 hover:-translate-y-1 hover:border-brand-soft hover:shadow-lg hover:shadow-brand/5 has-[a:focus-visible]:border-brand"
    >
      <div className="shrink-0">
        <Avatar url={p.avatarUrl} size={80} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="truncate font-heading text-xl font-extrabold text-white">
          <Link
            href={`/users/${p.username}`}
            className="outline-none after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-brand-soft"
          >
            {p.displayName}
          </Link>
        </h3>
        <p className="truncate text-sm font-medium text-muted">@{p.username}</p>
        {status ? <p className="mt-1 text-sm text-muted">{status}</p> : null}
        <div className="pointer-events-none relative z-10 mt-auto pt-3 [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
          <FriendActions username={p.username} initialRelation={p.relation} align="start" />
        </div>
      </div>
    </li>
  );
}

function Section({ title, people }: { title: string; people: Person[] }) {
  if (people.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-4 border-l-4 border-brand pl-3 font-heading text-xl font-bold">
        {title} <span className="text-sm font-normal text-muted">({people.length})</span>
      </h2>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-5">
        {people.map((p, i) => (
          <PersonCard key={p.username} p={p} index={i} />
        ))}
      </ul>
    </section>
  );
}

export default async function SocialPage() {
  const me = await requireUser("/social");
  // Amigos, solicitudes y bloqueados
  const { people, blockedUsers } = await socialOverview(me.id);
  const pick = (rel: Relation) => people.filter((p) => p.relation === rel);
  return (
    <div className="mx-auto max-w-280 px-5 py-10">
      <h1 className="mb-6 font-heading text-3xl font-extrabold text-white">Lista de amigos</h1>

      <div className="rounded-xl border border-line bg-surface/50 p-5 shadow-sm">
        <UserSearch />
      </div>

      <Section title="Solicitudes recibidas" people={pick("incoming")} />
      <Section title="Mis amigos" people={pick("friend")} />
      <Section title="Solicitudes enviadas" people={pick("outgoing")} />

      {people.length === 0 && (
        <p className="mt-8 rounded-xl border border-dashed border-line p-12 text-center font-medium text-muted">
          Todavía no tienes amigos en Roll2Go. Busca a alguien por su nombre de usuario y envíale una solicitud.
        </p>
      )}

      {blockedUsers.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 border-l-4 border-brand pl-3 font-heading text-xl font-bold">
            Usuarios bloqueados <span className="text-sm font-normal text-muted">({blockedUsers.length})</span>
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
            {blockedUsers.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{u.displayName}</span>
                  <span className="block truncate text-xs text-muted">@{u.username}</span>
                </span>
                <ConfirmAction
                  url={`/api/blocks/${u.username}`}
                  method="DELETE"
                  label="Desbloquear"
                  question={`¿Quieres desbloquear a ${u.displayName}?`}
                  confirmLabel="Sí, desbloquear"
                />
              </li>
            ))}
          </ul>
        </section>
      )}      
    </div>
  );
}