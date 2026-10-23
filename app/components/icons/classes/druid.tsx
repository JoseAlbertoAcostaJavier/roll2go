// Icono propio de la clase (línea, 24×24)
export default function Druid({ size = 24 }: { size?: number }) {
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
      <path d="M5 19C5 9 11 4 20 4c0 9-5 15-15 15z" />
      <path d="M5 19L14 10" />
    </svg>
  );
}
