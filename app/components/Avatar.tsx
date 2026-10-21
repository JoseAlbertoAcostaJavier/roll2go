import { Crown, User as UserIcon } from "lucide-react";

// Foto de perfil. Si no hay foto, un icono: la corona para el DM (crown) o el de usuario para el resto.
export default function Avatar({
  url,
  size = 32,
  className = "",
  crown = false,
}: {
  url?: string | null;
  size?: number;
  className?: string;
  crown?: boolean;
}) {
  const style = { width: size, height: size };
  const Icon = crown ? Crown : UserIcon;
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" style={style} className={`shrink-0 rounded-full object-cover ${className}`} />
  ) : (
    <span
      style={style}
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-panel text-muted ${className}`}
    >
      <Icon size={Math.round(size * 0.5)} />
    </span>
  );
}