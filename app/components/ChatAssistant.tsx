"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, MessageCircle, Send, X } from "lucide-react";
import { system as rpgSystems } from "@/lib/systems";
/* Componente de asistente de rol
  Este componente es un asistente de rol que permite a los usuarios hacer preguntas sobre reglas, clases 
  y builds de rol de mesa. Antes de preguntar hay que elegir el sistema de rol (D&D 5e, Pathfinder 2...),
  porque las reglas cambian mucho de uno a otro. El asistente mantiene un historial de mensajes entre el
  usuario y la API de Gemini. Además, puede abrirse desde cualquier parte de la aplicación mediante un
  evento personalizado llamado "open-assistant".
*/
type Msg = { role: "user" | "model"; text: string };

// Preguntas de ejemplo: genéricas, para que valgan con cualquier sistema
const SUGGESTIONS = [
  "¿Qué clase me recomiendas para empezar?",
  "¿Cómo funciona el combate?",
  "¿Cómo se crea un personaje?",
];

// Estilos de las burbujas de mensaje (usuario a la derecha en rojo, asistente a la izquierda en gris)
const bubble = "max-w-[88%] whitespace-pre-wrap rounded-lg px-3.5 py-2.5 text-[.93rem]";
const userBubble = `${bubble} self-end bg-brand text-white`;
const modelBubble = `${bubble} self-start border border-line bg-surface`;
const chip =
  "rounded-full border border-line bg-surface px-3.5 py-1.5 text-left text-[.85rem] text-muted transition-colors hover:border-brand hover:text-brand-soft";

export default function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [systemId, setSystemId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sistema de rol elegido (undefined mientras no se haya elegido ninguno)
  const current = rpgSystems.find((s) => s.id === systemId);

  // Permite abrir el chat desde cualquier botón de la web
  useEffect(() => {
    const openChat = () => setOpen(true);
    window.addEventListener("open-assistant", openChat);
    return () => window.removeEventListener("open-assistant", openChat);
  }, []);

  // Al abrir: foco en el campo de texto y cierre con Escape
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Bajar al último mensaje
  useEffect(() => {
    const box = boxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [messages, loading, open, systemId]);

  // Elegir sistema: empieza una conversación nueva con él (y se puede escribir enseguida)
  function chooseSystem(id: string) {
    setSystemId(id);
    setMessages([]);
    setError("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  // Cambiar de sistema: se borra la conversación, porque las respuestas anteriores eran de otro sistema
  function changeSystem() {
    setSystemId(null);
    setMessages([]);
    setInput("");
    setError("");
  }

  async function send(text: string) {
    // Evita enviar preguntas vacías, sin sistema elegido o mientras se está cargando.
    const question = text.trim();
    if (!question || loading || !systemId) return;
    const next: Msg[] = [...messages, { role: "user", text: question }];
    setMessages(next);
    setInput("");
    setError("");
    setLoading(true);

    // Si el servidor tarda más de 40 s, se corta la espera
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 40000);
    // Llamada a la API de Gemini para obtener la respuesta del asistente.
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, systemId }),
        signal: controller.signal,
      });
      // Manejo de la respuesta de la API y actualización del estado de mensajes.
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessages([...next, { role: "model", text: data.reply }]);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setError("El asistente tarda demasiado. Inténtalo de nuevo.");
      } else {
        setError(e instanceof Error ? e.message : "No se pudo obtener respuesta.");
      }
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }

  /* Renderizado del componente, incluyendo el botón flotante para abrir el asistente, la ventana del chat,
     la elección de sistema, el historial de mensajes y el campo de entrada.
  */
  return (
    <>
      {!open && (
        <button
          className="fixed bottom-3 right-3 z-50 flex items-center gap-2 rounded-full bg-brand px-4 py-3 font-heading text-sm font-bold text-white shadow-[0_6px_20px_rgba(0,0,0,0.5)] transition-colors hover:bg-brand-hover sm:bottom-5 sm:right-5"
          onClick={() => setOpen(true)}
          aria-label="Abrir asistente de rol"
        >
          <MessageCircle size={22} />
          <span>Asistente</span>
        </button>
      )}

      {open && (
        <section
          className="fixed bottom-3 right-3 z-50 flex h-[min(540px,calc(100dvh_-_40px))] w-[min(380px,calc(100vw_-_24px))] flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-[0_12px_40px_rgba(0,0,0,0.6)] sm:bottom-5 sm:right-5"
          role="dialog"
          aria-label="Asistente de rol"
        >
          <header className="flex items-center justify-between bg-[linear-gradient(90deg,var(--color-brand-dark),var(--color-brand))] px-3.5 py-3 font-heading">
            <strong>Asistente de rol</strong>
            <button
              className="flex rounded-md p-1 text-white transition-colors hover:bg-white/20"
              onClick={() => setOpen(false)}
              aria-label="Cerrar asistente"
            >
              <X size={20} />
            </button>
          </header>

          {/* Sistema elegido, con opción de cambiarlo */}
          {current && (
            <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-3.5 py-2 text-sm">
              <span className="min-w-0 truncate text-muted">
                Sistema: <strong className="font-semibold text-white">{current.name}</strong>
              </span>
              <button onClick={changeSystem} className="shrink-0 text-brand-soft hover:underline">
                Cambiar
              </button>
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-3.5" ref={boxRef} aria-live="polite">
            {/* Paso 1: elegir sistema (obligatorio) */}
            {!current && (
              <>
                <p className={modelBubble}>
                  Antes de empezar, ¿a qué sistema de rol te refieres? Las reglas cambian mucho de uno a otro y así
                  te respondo con precisión.
                </p>
                <div className="flex flex-wrap gap-2">
                  {rpgSystems.map((s) => (
                    <button key={s.id} onClick={() => chooseSystem(s.id)} className={chip}>
                      {s.name}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Paso 2: ya hay sistema, todavía sin preguntas */}
            {current && messages.length === 0 && (
              <>
                <p className={modelBubble}>
                  Perfecto, hablaremos de {current.name}. Pregúntame lo que quieras sobre reglas, clases y builds.
                </p>
                <div className="flex flex-col items-start gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)} className={chip}>
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}

            {messages.map((m, i) => (
              <p key={i} className={m.role === "user" ? userBubble : modelBubble}>{m.text}</p>
            ))}
            {loading && (
              <p className={`${modelBubble} flex items-center gap-2`}>
                <LoaderCircle size={16} className="shrink-0 animate-spin text-brand-soft" aria-hidden="true" />
                Espera un momento mientras encuentro el tomo correcto...
              </p>
            )}
          </div>

          {error && <p className="px-3.5 pb-2 text-sm text-brand-soft" role="alert">{error}</p>}

          <div className="flex gap-2 border-t border-line p-3">
            <input
              ref={inputRef}
              value={input}
              maxLength={500}
              disabled={!current}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              aria-label="Tu pregunta"
              placeholder={current ? "Escribe tu pregunta..." : "Elige primero un sistema de rol"}
              className="h-11 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 text-[.95rem] text-fg disabled:cursor-not-allowed disabled:opacity-50"
            />
            <button
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-brand text-white transition-colors enabled:hover:bg-brand-hover disabled:opacity-50"
              onClick={() => send(input)}
              disabled={loading || !current || !input.trim()}
              aria-label="Enviar pregunta"
            >
              {loading ? <LoaderCircle size={20} className="animate-spin" /> : <Send size={20} />}
            </button>
          </div>
        </section>
      )}
    </>
  );
}