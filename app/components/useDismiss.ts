import { useEffect, type RefObject } from "react";

// Cierra un menú desplegable al pulsar fuera de él o la tecla Escape
export default function useDismiss(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  close: () => void,
) {
  useEffect(() => {
    if (!active) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
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
  }, [ref, active, close]);
}
