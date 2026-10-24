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
      {/* Portal abierto (sin suelo) y un destello de 4 puntas que sale por arriba */}
      <path d="M5 21v-9a7 7 0 0 1 7-7" />
      <path d="M19 14v7" />
      <path d="M17 2.5c.4 2.3 1.2 3.1 3.5 3.5-2.3.4-3.1 1.2-3.5 3.5-.4-2.3-1.2-3.1-3.5-3.5 2.3-.4 3.1-1.2 3.5-3.5z" />
      <path d="M12 13v.01M9 17v.01M14 18v.01" />
    </svg>
  );
}
