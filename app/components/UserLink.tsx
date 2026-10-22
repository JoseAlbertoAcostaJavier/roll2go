import Link from "next/link";
import Avatar from "@/app/components/Avatar";
import type { UserCard } from "@/lib/userCards";

export default function UserLink({
  user,
  size = 32,
  crown = false,
  showHandle = false,
  className = "",
}: {
  user: UserCard;
  size?: number;
  crown?: boolean;
  showHandle?: boolean;
  className?: string;
}) {
  return (
    <Link href={`/users/${user.username}`} className={`group flex min-w-0 items-center gap-3 ${className}`}>
      <Avatar url={user.avatarUrl} size={size} crown={crown} className="transition-transform group-hover:scale-105" />
      <span className="min-w-0">
        <span className="block truncate font-semibold group-hover:underline">{user.displayName}</span>
        {showHandle && <span className="block truncate text-xs text-muted">@{user.username}</span>}
      </span>
    </Link>
  );
}