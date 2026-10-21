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
    <Link href={`/users/${user.username}`} className={`flex min-w-0 items-center gap-3 hover:underline ${className}`}>
      <Avatar url={user.avatarUrl} size={size} crown={crown} />
      <span className="min-w-0">
        <span className="block truncate font-semibold">{user.displayName}</span>
        {showHandle && <span className="block truncate text-xs text-muted">@{user.username}</span>}
      </span>
    </Link>
  );
}