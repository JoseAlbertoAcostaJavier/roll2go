// Icono propio de la escuela Conjuración: portal del que sale una chispa (línea, 24×24)
export default function Conjuration({ size = 24 }: { size?: number }) {
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
      <path d="M6 21V10a6 6 0 0 1 12 0v11" />
      <path d="M4 21h16" />
      <path d="M12 11v4M10 13h4" />
    </svg>
  );
}
