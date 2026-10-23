// Icono propio de la clase (línea, 24×24)
export default function Rogue({ size = 24 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2l3 9-3 3-3-3z" />
      <path d="M8 14h8" />
      <path d="M12 14v6" />
      <path d="M10.5 20h3" />
    </svg>
  );
}
