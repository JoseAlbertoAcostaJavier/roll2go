// Icono propio de la escuela Nigromancia: calavera (línea, 24×24)
export default function Necromancy({ size = 24 }: { size?: number }) {
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
      <path d="M5 11a7 7 0 0 1 14 0v3l-2 1v4H7v-4l-2-1z" />
      <circle cx="9" cy="11" r="1.5" />
      <circle cx="15" cy="11" r="1.5" />
      <path d="M10 19v-2M14 19v-2" />
    </svg>
  );
}
