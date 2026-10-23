// Icono propio de la clase (línea, 24×24)
export default function Monk({ size = 24 }: { size?: number }) {
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
      <circle cx="12" cy="5" r="2" />
      <path d="M12 8v5" />
      <path d="M5 13c3 0 5 1 7 1s4-1 7-1" />
      <path d="M6 20c2-3 4-4 6-4s4 1 6 4" />
    </svg>
  );
}
