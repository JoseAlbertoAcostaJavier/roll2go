"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, LoaderCircle } from "lucide-react";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setStatus("error");
      setMessage("Escribe un correo electrónico válido.");
      return;
    }
    
    setStatus("loading");
    try {
      const res = await fetch("/api/auth/forgot_password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "No se pudo procesar la solicitud.");
      
      setStatus("success");
    } catch (err) {
          setStatus("error");
          if (err instanceof Error) {
            setMessage(err.message);
          } else {
            setMessage("Ocurrió un error inesperado.");
          }
    }
  }

  if (status === "success") {
    return (
      <div className="w-full text-center">
        <h1 className="mb-2 font-heading text-3xl font-extrabold">Revisa tu correo</h1>
        <p className="mb-6 text-sm text-muted">
          Si el correo existe en nuestro sistema, hemos enviado un enlace para recuperar la contraseña.
        </p>
        <Link href="/sign_in" className="font-semibold text-brand hover:text-brand-soft">
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full">
      <h1 className="mb-1 font-heading text-3xl font-extrabold">Recuperar contraseña</h1>
      <p className="mb-6 text-sm text-muted">Introduce tu correo y te enviaremos un enlace.</p>

      <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">
        Correo electrónico
      </label>
      <div className="relative mb-4">
        <Mail size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-line bg-surface py-2.5 pl-10 pr-3 text-fg placeholder:text-muted focus:border-brand focus:outline-none"
        />
      </div>

      {status === "error" && (
        <p className="mb-4 text-sm text-brand-soft" role="alert">{message}</p>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 font-heading font-bold text-white transition-colors enabled:hover:bg-brand-hover disabled:opacity-50"
      >
        {status === "loading" && <LoaderCircle size={18} className="animate-spin" />}
        {status === "loading" ? "Enviando..." : "Enviar enlace"}
      </button>

      <p className="mt-5 text-center text-sm text-muted">
        ¿Te has acordado?{" "}
        <Link href="/sign_in" className="font-semibold text-white hover:text-brand-soft">
          Iniciar sesión
        </Link>
      </p>
    </form>
  );
}