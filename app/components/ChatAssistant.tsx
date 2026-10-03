"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
/* Componente de asistente de rol
  Este componente es un asistente de rol que permite a los usuarios hacer preguntas sobre reglas, clases 
  y builds de rol de mesa. El asistente mantiene un historial de mensajes entre el usuario y la API de Gemini, y 
  permite enviar preguntas y recibir respuestas. El componente utiliza varios hooks de React para manejar el estado, 
  los efectos y las referencias a elementos del DOM. Además, el asistente puede abrirse desde cualquier parte de 
  la aplicación mediante un evento personalizado llamado "open-assistant".
*/
type Msg = { role: "user" | "model"; text: string };

const SUGGESTIONS = [
  "¿Qué atributo es mejor para un bardo?",
  "¿Qué diferencia hay entre D&D 5e y 5.5?",
  "¿Cómo funciona la ventaja y la desventaja?",
];

// Estilos de las burbujas de mensaje (usuario a la derecha en rojo, asistente a la izquierda en gris)
const bubble = "max-w-[88%] whitespace-pre-wrap rounded-lg px-3.5 py-2.5 text-[.93rem]";
const userBubble = `${bubble} self-end bg-brand text-white`;
const modelBubble = `${bubble} self-start border border-line bg-surface`;

export default function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
  }, [messages, loading, open]);

  async function send(text: string) {
    // Evita enviar preguntas vacías o mientras se está cargando.
    const question = text.trim();
    if (!question || loading) return;
    const next: Msg[] = [...messages, { role: "user", text: question }];
    setMessages(next);
    setInput("");
    setError("");
    setLoading(true);
    // Llamada a la API de Gemini para obtener la respuesta del asistente.
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      // Manejo de la respuesta de la API y actualización del estado de mensajes.
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessages([...next, { role: "model", text: data.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo obtener respuesta.");
    } finally {
      setLoading(false);
    }
  }

  /* Renderizado del componente, incluyendo el botón flotante para abrir el asistente, la ventana del chat,
     el historial de mensajes, el campo de entrada y los botones de sugerencias.
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

          <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-3.5" ref={boxRef} aria-live="polite">
            {messages.length === 0 && (
              <>
                <p className={modelBubble}>Pregúntame lo que quieras sobre reglas, clases y builds de rol de mesa.</p>
                <div className="flex flex-col items-start gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-left text-[.85rem] text-muted transition-colors hover:border-brand hover:text-brand-soft"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}
            {messages.map((m, i) => (
              <p key={i} className={m.role === "user" ? userBubble : modelBubble}>{m.text}</p>
            ))}
            {loading && <p className={modelBubble}>Espera un momento mientras encuentro el tomo correcto...</p>}
          </div>

          {error && <p className="px-3.5 pb-2 text-sm text-brand-soft" role="alert">{error}</p>}

          <div className="flex gap-2 border-t border-line p-3">
            <input
              ref={inputRef}
              value={input}
              maxLength={500}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              aria-label="Tu pregunta"
              placeholder="Escribe tu pregunta..."
              className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2.5 text-[.95rem] text-fg"
            />
            <button
              className="flex w-[42px] items-center justify-center rounded-md bg-brand text-white transition-colors enabled:hover:bg-brand-hover disabled:opacity-50"
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              aria-label="Enviar pregunta"
            >
              <Send size={18} />
            </button>
          </div>
        </section>
      )}
    </>
  );
}