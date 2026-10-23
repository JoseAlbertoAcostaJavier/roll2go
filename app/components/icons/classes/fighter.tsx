// Icono propio de la clase (línea, 24×24)
export default function Fighter({ size = 24 }: { size?: number }) {
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
      <path d="M20 4L9 15" />
      <path d="M7 13l4 4" />
      <path d="M9 15l-4 4" />
      <circle cx="4.5" cy="19.5" r="1.5" />
    </svg>
  );
}
