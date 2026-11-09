"use client";

import { useEffect, useRef, useState } from "react";
import { CampaignDialog } from "@/app/components/campaigns/CharacterActions";
import { initialCrop, moveCrop, resizeCrop, type CropCorner, type SquareCrop } from "@/lib/utils/cropSquare";

const MIN_SIZE = 32;
const MAX_OUTPUT = 1024;
const CORNERS: { id: CropCorner; label: string; place: string }[] = [
  { id: "nw", label: "superior izquierda", place: "-left-1.5 -top-1.5 cursor-nwse-resize" },
  { id: "ne", label: "superior derecha", place: "-right-1.5 -top-1.5 cursor-nesw-resize" },
  { id: "sw", label: "inferior izquierda", place: "-bottom-1.5 -left-1.5 cursor-nesw-resize" },
  { id: "se", label: "inferior derecha", place: "-bottom-1.5 -right-1.5 cursor-nwse-resize" },
];

type Drag = { mode: "move" | CropCorner; px: number; py: number; crop: SquareCrop; scale: number };

/* Ventana para elegir la parte cuadrada de una imagen; con las flechas mueve la selección y con + y - cambia su tamaño. */
export default function ImageCropper({ src, fileName, opener, onCancel, onDone }: {
  src: string; fileName: string; opener: HTMLElement | null; onCancel: () => void; onDone: (file: File) => void;
}) {
  const image = useRef<HTMLImageElement>(null);
  const drag = useRef<Drag | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [crop, setCrop] = useState<SquareCrop | null>(null);
  const [error, setError] = useState("");
  const area = useRef<HTMLDivElement>(null);
  const ready = crop !== null;

  // La zona aparece cuando carga la imagen, después de que la ventana haya colocado el foco
  useEffect(() => {
    if (ready) area.current?.focus();
  }, [ready]);

  const onLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: width, naturalHeight: height } = e.currentTarget;
    setSize({ width, height });
    setCrop(initialCrop(width, height));
  };

  const start = (mode: Drag["mode"], e: React.PointerEvent) => {
    if (!crop || !image.current || !size) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { mode, px: e.clientX, py: e.clientY, crop, scale: size.width / image.current.getBoundingClientRect().width };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !size) return;
    const dx = (e.clientX - d.px) * d.scale;
    const dy = (e.clientY - d.py) * d.scale;
    setCrop(d.mode === "move"
      ? moveCrop(d.crop, dx, dy, size.width, size.height)
      : resizeCrop(d.crop, d.mode, dx, dy, size.width, size.height, MIN_SIZE));
  };
  const end = () => {
    drag.current = null;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!crop || !size) return;
    const step = Math.max(1, Math.round(Math.min(size.width, size.height) / 50));
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      setCrop(moveCrop(crop, moves[e.key][0], moves[e.key][1], size.width, size.height));
    } else if (e.key === "+" || e.key === "-") {
      e.preventDefault();
      const delta = e.key === "+" ? step : -step;
      setCrop(resizeCrop(crop, "se", delta, delta, size.width, size.height, MIN_SIZE));
    }
  };

  const accept = () => {
    if (!crop || !image.current) return;
    const side = Math.min(Math.round(crop.size), MAX_OUTPUT);
    const canvas = document.createElement("canvas");
    canvas.width = side;
    canvas.height = side;
    canvas.getContext("2d")?.drawImage(image.current, crop.x, crop.y, crop.size, crop.size, 0, 0, side, side);
    canvas.toBlob((blob) => {
      if (!blob) {
        setError("No se ha podido recortar la imagen.");
        return;
      }
      // El navegador que no sepa codificar WebP devuelve PNG
      const extension = blob.type === "image/webp" ? "webp" : "png";
      onDone(new File([blob], `${fileName.replace(/\.[^.]+$/, "")}.${extension}`, { type: blob.type }));
    }, "image/webp", 0.92);
  };

  const percent = (value: number, total: number) => `${(value / total) * 100}%`;

  return (
    <CampaignDialog title="Recortar retrato" opener={opener} onClose={onCancel}>
      <div className="flex justify-center">
        <div className="relative overflow-hidden leading-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={image} src={src} alt="Imagen a recortar" onLoad={onLoad} draggable={false} className="block max-h-[60vh] max-w-full select-none" />
          {crop && size && (
            <div
              role="group"
              tabIndex={0}
              ref={area}
              aria-label="Zona del retrato. Flechas para mover, más y menos para cambiar el tamaño."
              onPointerDown={(e) => start("move", e)}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
              onKeyDown={onKeyDown}
              className="absolute cursor-move touch-none border border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] focus-visible:outline-2 focus-visible:outline-brand"
              style={{ left: percent(crop.x, size.width), top: percent(crop.y, size.height), width: percent(crop.size, size.width), height: percent(crop.size, size.height) }}
            >
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/3 h-1/3 border-y border-dashed border-white/60" />
              <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-1/3 w-1/3 border-x border-dashed border-white/60" />
              {CORNERS.map((c) => (
                <span
                  key={c.id}
                  aria-hidden="true"
                  title={`Esquina ${c.label}`}
                  onPointerDown={(e) => start(c.id, e)}
                  onPointerMove={move}
                  onPointerUp={end}
                  onPointerCancel={end}
                  className={`absolute size-3 touch-none rounded-sm border border-brand bg-white ${c.place}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-line-strong px-4 py-2 text-sm font-semibold text-fg transition-colors hover:border-brand">Cancelar</button>
        <button type="button" onClick={accept} disabled={!crop} className="rounded-md bg-brand px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-hover disabled:opacity-40">Aceptar</button>
      </div>
    </CampaignDialog>
  );
}
