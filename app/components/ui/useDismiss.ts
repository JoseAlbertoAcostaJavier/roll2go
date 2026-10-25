import { useEffect, type RefObject } from "react";

// Cierra un menú desplegable al pulsar fuera de él o la tecla Escape. `inside` añade zonas que cuentan como dentro
// (p. ej. una lista pintada en un portal fuera de `ref`).
export default function useDismiss(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  close: () => void,
  inside?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!active) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (inside?.current?.contains(target)) return;
      if (ref.current && !ref.current.contains(target)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, active, close, inside]);
}
