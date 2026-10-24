// Icono propio de la escuela Evocación: rayo (línea, 24×24)
export default function Evocation({ size = 24 }: { size?: number }) {
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
      <path d="M13 2L5 13h6l-1 9 8-11h-6z" />
    </svg>
  );
}
