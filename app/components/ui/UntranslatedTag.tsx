// Etiqueta «EN»: el contenido de al lado solo está disponible en inglés. No se imprime.
export default function UntranslatedTag({ className = "" }: { className?: string }) {
  return (
    <span
      title="Solo disponible en inglés"
      aria-label="Solo disponible en inglés"
      className={`inline-block rounded border border-line px-1 align-middle text-xs font-normal normal-case leading-tight tracking-normal text-muted print:hidden ${className}`}
    >
      EN
    </span>
  );
}
