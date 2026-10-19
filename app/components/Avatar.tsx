import { User as UserIcon } from "lucide-react";

export default function Avatar({ url, size = 32, className = "" }: { url?: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size };
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" style={style} className={`shrink-0 rounded-full object-cover ${className}`} />
  ) : (
    <span style={style} aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-full bg-panel text-muted ${className}`}>
      <UserIcon size={Math.round(size * 0.5)} />
    </span>
  );
}