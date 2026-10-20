import type { Metadata } from "next";
import Link from "next/link";
import Avatar from "@/app/components/Avatar";
import FriendActions from "@/app/components/FriendActions";
import UserSearch from "@/app/components/UserSearch";
import { requireUser } from "@/lib/currentUser";
import { connectDB } from "@/lib/mongodb";
import { Friendship } from "@/lib/Friendship";
import { User } from "@/lib/User";
import { relationOf, type Relation } from "@/lib/friends";

export const metadata: Metadata = { title: "Social" };

type Person = { username: string; displayName: string; avatarUrl: string | null; relation: Relation };

function PersonCard({ p }: { p: Person }) {
  const status = { friend: "Tu amigo", outgoing: "Solicitud enviada", incoming: "Te ha enviado una solicitud", none: "" }[p.relation];
  return (
    <li className="flex flex-col items-center rounded-lg border border-line bg-panel p-5 text-center">
      <Avatar url={p.avatarUrl} size={96} />
      <Link href={`/users/${p.username}`} className="mt-3 max-w-full truncate font-heading font-bold uppercase text-brand-soft hover:underline">
        {p.displayName}
      </Link>
      <p className="text-xs text-muted">@{p.username}</p>
      <p className="mb-3 mt-1 text-sm text-muted">{status}</p>
      <FriendActions username={p.username} initialRelation={p.relation} />
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
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(220px,100%),1fr))] gap-4">
        {people.map((p) => (
          <PersonCard key={p.username} p={p} />
        ))}
      </ul>
    </section>
  );
}

export default async function SocialPage() {
  const me = await requireUser("/social");
  await connectDB();

  const rows = await Friendship.find({ $or: [{ requester: me.id }, { recipient: me.id }] })
    .sort({ updatedAt: -1 })
    .limit(300)
    .lean();
  const otherIds = rows.map((r) => (String(r.requester) === me.id ? String(r.recipient) : String(r.requester)));
  const users = await User.find({ _id: { $in: otherIds } }).select("username displayName avatarId").lean();
  const byId = new Map(users.map((u) => [String(u._id), u] as const));

  const people: Person[] = [];
  rows.forEach((r, i) => {
    const u = byId.get(otherIds[i]);
    if (!u) return; // cuenta borrada
    people.push({
      username: u.username,
      displayName: u.displayName || u.username,
      avatarUrl: u.avatarId ? `/api/images/${u.avatarId}` : null,
      relation: relationOf(me.id, r),
    });
  });
  const pick = (rel: Relation) => people.filter((p) => p.relation === rel);

  return (
    <div className="mx-auto max-w-280 px-5 py-10">
      <h1 className="mb-6 font-heading text-3xl font-extrabold">Lista de Amigos</h1>

      <div className="rounded-lg border border-line bg-panel p-5 sm:p-6">
        <UserSearch />
      </div>

      <Section title="Solicitudes recibidas" people={pick("incoming")} />
      <Section title="Mis amigos" people={pick("friend")} />
      <Section title="Solicitudes enviadas" people={pick("outgoing")} />

      {people.length === 0 && (
        <p className="mt-8 rounded-lg border border-dashed border-line p-10 text-center text-muted">
          Todavía no tienes amigos en Roll2Go. Busca a alguien por su nombre de usuario y envíale una solicitud.
        </p>
      )}
    </div>
  );
}