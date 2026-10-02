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
        <button className="chat-fab" onClick={() => setOpen(true)} aria-label="Abrir asistente de rol">
          <MessageCircle size={22} />
          <span>Asistente</span>
        </button>
      )}

      {open && (
        <section className="chat-panel" role="dialog" aria-label="Asistente de rol">
          <header className="chat-head">
            <strong>Asistente de rol</strong>
            <button onClick={() => setOpen(false)} aria-label="Cerrar asistente">
              <X size={20} />
            </button>
          </header>

          <div className="msgs" ref={boxRef} aria-live="polite">
            {messages.length === 0 && (
              <>
                <p className="msg model">Pregúntame lo que quieras sobre reglas, clases y builds de rol de mesa.</p>
                <div className="chips">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)}>{s}</button>
                  ))}
                </div>
              </>
            )}
            {messages.map((m, i) => (
              <p key={i} className={`msg ${m.role}`}>{m.text}</p>
            ))}
            {loading && <p className="msg model">Espera un momento mientras encuentro el tomo correcto...</p>}
          </div>

          {error && <p className="error" role="alert">{error}</p>}

          <div className="chat-input">
            <input
              ref={inputRef}
              value={input}
              maxLength={500}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              aria-label="Tu pregunta"
              placeholder="Escribe tu pregunta..."
            />
            <button className="send" onClick={() => send(input)} disabled={loading || !input.trim()} aria-label="Enviar pregunta">
              <Send size={18} />
            </button>
          </div>
        </section>
      )}
    </>
  );
}