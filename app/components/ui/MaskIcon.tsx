// Icono SVG blanco pintado como máscara con el color del texto (`currentColor`), como StatusIcon.
// Sin `label` es decorativo (aria-hidden); con `label` se anuncia como imagen.
export default function MaskIcon({ src, size = 16, label, className = "" }: { src: string | null; size?: number; label?: string; className?: string }) {
  if (!src) return null;
  const mask = `url(${src}) center / contain no-repeat`;
  return (
    <span
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{ width: size, height: size, mask, WebkitMask: mask }}
    />
  );
}
