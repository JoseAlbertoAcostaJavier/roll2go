// Icono propio de la escuela Transmutación: flechas en ciclo (línea, 24×24)
export default function Transmutation({ size = 24 }: { size?: number }) {
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
      <path d="M4 12a8 8 0 0 1 14-5.3" />
      <path d="M18 3v4h-4" />
      <path d="M20 12a8 8 0 0 1-14 5.3" />
      <path d="M6 21v-4h4" />
    </svg>
  );
}
