// Icono propio de la clase (línea, 24×24)
export default function Ranger({ size = 24 }: { size?: number }) {
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
      <path d="M6 4c8 0 14 6 14 14" />
      <path d="M6 4l14 14" />
      <path d="M4 20l8-8" />
    </svg>
  );
}
