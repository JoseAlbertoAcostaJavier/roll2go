"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, LoaderCircle, Maximize, Minus, Plus, Printer } from "lucide-react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

const toolButton = "flex size-9 items-center justify-center rounded-md border border-line-strong text-fg transition-colors enabled:hover:border-brand enabled:hover:text-white disabled:opacity-40";

/* Una página: se dibuja al ancho pedido y se redibuja al cambiar el zoom, con la densidad de la pantalla. */
function PdfPage({ doc, number, scale, onVisible }: { doc: PDFDocumentProxy; number: number; scale: number; onVisible: (n: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let task: RenderTask | null = null;
    let stale = false;
    // Se pinta en un lienzo aparte y se copia al acabar: al cambiar el zoom la página no parpadea y dos pinturas no chocan
    void (async () => {
      const page = await doc.getPage(number);
      if (stale) return;
      const ratio = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: scale * ratio });
      const buffer = document.createElement("canvas");
      buffer.width = viewport.width;
      buffer.height = viewport.height;
      task = page.render({ canvas: buffer, viewport });
      await task.promise;
      const target = canvas.current;
      if (stale || !target) return;
      target.width = buffer.width;
      target.height = buffer.height;
      target.style.width = `${viewport.width / ratio}px`;
      target.style.height = `${viewport.height / ratio}px`;
      target.getContext("2d")?.drawImage(buffer, 0, 0);
    })().catch((e: unknown) => {
      // Cancelar una pasada al cambiar el zoom rechaza su promesa: no es un error
      if ((e as { name?: string }).name !== "RenderingCancelledException") console.error(e);
    });
    return () => {
      stale = true;
      task?.cancel();
    };
  }, [doc, number, scale]);

  useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) onVisible(number);
    }, { threshold: 0.55 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [number, onVisible]);

  return <canvas ref={canvas} id={`pdf-page-${number}`} aria-label={`Página ${number}`} role="img" className="block max-w-none bg-white shadow-lg" />;
}

/* Visor de PDF: pinta cada página con pdf.js, con paginación, zoom, descarga e impresión. */
export default function PdfViewer({ url, filename, backHref }: { url: string; filename: string; backHref: string }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [blobUrl, setBlobUrl] = useState("");
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [current, setCurrent] = useState(1);
  const [zoom, setZoom] = useState<number | null>(null); // null: ajustar al ancho
  const [fitScale, setFitScale] = useState(1);
  const area = useRef<HTMLDivElement>(null);
  const printFrame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let stale = false;
    let closeDocument: (() => void) | null = null;
    let link = "";
    void (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("pdf");
        const blob = await res.blob();
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const task = pdfjs.getDocument({ data: await blob.arrayBuffer() });
        closeDocument = () => void task.destroy();
        const loaded = await task.promise;
        if (stale) {
          closeDocument();
          return;
        }
        link = URL.createObjectURL(blob);
        setBlobUrl(link);
        setDoc(loaded);
      } catch {
        if (!stale) setFailed(true);
      }
    })();
    return () => {
      stale = true;
      closeDocument?.();
      if (link) URL.revokeObjectURL(link);
      setDoc(null);
      setBlobUrl("");
    };
  }, [url, attempt]);

  // Escala que hace caber la página en el ancho disponible
  useEffect(() => {
    if (!doc || !area.current) return;
    const box = area.current;
    let stale = false;
    const measure = () => void doc.getPage(1).then((page) => {
      if (stale) return;
      const width = page.getViewport({ scale: 1 }).width;
      setFitScale(Math.min(Math.max((box.clientWidth - 32) / width, MIN_ZOOM), 1.6));
    });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => {
      stale = true;
      observer.disconnect();
    };
  }, [doc]);

  const scale = zoom ?? fitScale;
  const pages = doc?.numPages ?? 0;
  const onVisible = useCallback((n: number) => setCurrent(n), []);
  const changeZoom = (delta: number) => setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round((scale + delta) * 100) / 100)));
  const goTo = (n: number) => document.getElementById(`pdf-page-${n}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="flex h-[calc(100dvh-5rem)] min-h-96 flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-panel px-4 py-2">
        <Link href={backHref} className="flex items-center gap-1 text-sm text-muted transition-colors hover:text-white">
          <ChevronLeft size={16} aria-hidden="true" /> Volver a la ficha
        </Link>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button type="button" className={toolButton} aria-label="Página anterior" disabled={current <= 1} onClick={() => goTo(current - 1)}>
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <span aria-live="polite" className="min-w-14 text-center text-sm tabular-nums text-fg">{pages ? `${current} / ${pages}` : "—"}</span>
          <button type="button" className={toolButton} aria-label="Página siguiente" disabled={current >= pages} onClick={() => goTo(current + 1)}>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
          <span className="mx-1 h-6 w-px bg-line" aria-hidden="true" />
          <button type="button" className={toolButton} aria-label="Reducir" disabled={!doc || scale <= MIN_ZOOM} onClick={() => changeZoom(-ZOOM_STEP)}>
            <Minus size={16} aria-hidden="true" />
          </button>
          <span className="min-w-12 text-center text-sm tabular-nums text-fg">{Math.round(scale * 100)} %</span>
          <button type="button" className={toolButton} aria-label="Ampliar" disabled={!doc || scale >= MAX_ZOOM} onClick={() => changeZoom(ZOOM_STEP)}>
            <Plus size={16} aria-hidden="true" />
          </button>
          <button type="button" className={toolButton} aria-label="Ajustar al ancho" title="Ajustar al ancho" disabled={!doc} onClick={() => setZoom(null)}>
            <Maximize size={16} aria-hidden="true" />
          </button>
          <span className="mx-1 h-6 w-px bg-line" aria-hidden="true" />
          {blobUrl ? (
            <a href={blobUrl} download={filename} className={toolButton} aria-label="Descargar" title="Descargar">
              <Download size={16} aria-hidden="true" />
            </a>
          ) : (
            <button type="button" disabled className={toolButton} aria-label="Descargar"><Download size={16} aria-hidden="true" /></button>
          )}
          <button
            type="button"
            disabled={!blobUrl}
            onClick={() => printFrame.current?.contentWindow?.print()}
            className="flex h-9 items-center gap-2 rounded-md bg-brand px-3 text-sm font-bold text-white transition-colors enabled:hover:bg-brand-hover disabled:opacity-40"
          >
            <Printer size={16} aria-hidden="true" /> Imprimir
          </button>
        </div>
      </div>

      <div ref={area} className="flex-1 overflow-auto bg-surface p-4">
        {failed ? (
          <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted">
            No se ha podido cargar la ficha.
            <button
              type="button"
              onClick={() => {
                setFailed(false);
                setAttempt((a) => a + 1);
              }}
              className="rounded-md border border-line-strong px-3 py-1.5 font-semibold text-fg transition-colors hover:border-brand"
            >
              Reintentar
            </button>
          </div>
        ) : !doc ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted">
            <LoaderCircle size={18} className="animate-spin text-brand-soft" aria-hidden="true" /> Generando la ficha…
          </div>
        ) : (
          <div className="mx-auto flex w-max flex-col items-center gap-4">
            {Array.from({ length: pages }, (_, i) => <PdfPage key={i + 1} doc={doc} number={i + 1} scale={scale} onVisible={onVisible} />)}
          </div>
        )}
      </div>
      {blobUrl && <iframe ref={printFrame} src={blobUrl} title="Ficha para imprimir" aria-hidden="true" tabIndex={-1} className="pointer-events-none fixed left-0 top-0 size-px border-0 opacity-0" />}
    </div>
  );
}
