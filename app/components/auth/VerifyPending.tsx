"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LoaderCircle, Mail } from "lucide-react";

/* Pantalla "Revisa tu correo": a ella se llega tras registrarse o al intentar entrar con una cuenta sin
   verificar. Permite pedir otro enlace (con espera de 60 s entre envíos). */
export default function VerifyPending({ initialEmail }: { initialEmail: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");

  // Cuenta atrás entre reenvíos
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function resend() {
    setError("");
    setInfo("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Escribe un correo electrónico válido.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo reenviar el correo.");
        return;
      }
      setInfo("Si tu cuenta está pendiente de verificar, recibirás un nuevo correo en unos minutos.");
      setCooldown(60);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand/15 text-brand-soft">
        <Mail size={28} aria-hidden="true" />
      </div>
      <h1 className="mb-2 font-heading text-3xl font-extrabold">Verifica tu correo</h1>

      {initialEmail ? (
        <p className="mb-1 text-sm text-muted">
          Para activar tu cuenta, pulsa el enlace que hemos enviado a{" "}
          <strong className="break-all font-semibold text-white">{initialEmail}</strong>. El enlace caduca a los 30
          minutos.
        </p>
      ) : (
        <p className="mb-1 text-sm text-muted">
          Escribe el correo con el que te registraste y te enviaremos un enlace para activar tu cuenta.
        </p>
      )}
      <p className="mb-6 text-sm text-muted">Si no lo ves, revisa también la carpeta de spam.</p>

      {/* Si no sabemos el correo, se pide */}
      {!initialEmail && (
        <>
          <label htmlFor="verify-email" className="mb-1.5 block text-sm font-semibold">
            Correo electrónico
          </label>
          <input
            id="verify-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            className="mb-3 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-fg placeholder:text-muted focus:border-brand focus:outline-none"
          />
        </>
      )}

      <button
        onClick={resend}
        disabled={loading || cooldown > 0}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 font-heading font-bold text-white transition-colors enabled:hover:bg-brand-hover disabled:opacity-50"
      >
        {loading && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
        {cooldown > 0 ? `Reenviar correo (${cooldown} s)` : "Reenviar correo"}
      </button>

      {info && (
        <p className="mt-3 text-sm text-[#6fd08c]" role="status">
          {info}
        </p>
      )}
      {error && (
        <p className="mt-3 text-sm text-brand-soft" role="alert">
          {error}
        </p>
      )}

      <p className="mt-5 text-center text-sm text-muted">
        ¿Ya verificaste tu cuenta?{" "}
        <Link href="/sign_in" className="font-semibold text-white hover:text-brand-soft">
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}