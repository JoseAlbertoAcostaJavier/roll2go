// Icono propio de la clase (línea, 24×24)
export default function Barbarian({ size = 24 }: { size?: number }) {
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
      <path d="M13 4l7 3-1 7-6-1z" />
      <path d="M13 11L4 21" />
    </svg>
  );
}
