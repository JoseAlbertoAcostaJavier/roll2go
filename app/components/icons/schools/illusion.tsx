// Icono propio de la escuela Ilusionismo: máscara (línea, 24×24)
export default function Illusion({ size = 24 }: { size?: number }) {
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
      <path d="M3 7c3-2 15-2 18 0 0 6-3 11-9 11S3 13 3 7z" />
      <path d="M7 10.5h3M14 10.5h3" />
      <path d="M9.5 14.5c1.5 1 3.5 1 5 0" />
    </svg>
  );
}
