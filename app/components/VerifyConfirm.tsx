"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, LoaderCircle, X } from "lucide-react";

type State = { status: "loading" | "ok" | "error"; message?: string; email?: string };

/* Destino del enlace del correo: al cargar, envía el token a la API para verificar la cuenta.
   Se hace con un POST (y no al abrir la página) para que los antivirus de correo, que visitan los enlaces
   por su cuenta, no gasten el token antes de que lo use el usuario. */
export default function VerifyConfirm({ token }: { token: string }) {
  const [state, setState] = useState<State>(
    token ? { status: "loading" } : { status: "error", message: "El enlace no es válido." },
  );
  const started = useRef(false);

  useEffect(() => {
    // En desarrollo React ejecuta los efectos dos veces; esta marca evita gastar el token dos veces
    if (!token || started.current) return;
    started.current = true;

    fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        setState(res.ok ? { status: "ok" } : { status: "error", message: data.error, email: data.email });
      })
      .catch(() => setState({ status: "error", message: "No se pudo conectar con el servidor." }));
  }, [token]);

  if (state.status === "loading") {
    return (
      <div className="flex w-full flex-col items-center gap-4 py-10 text-center" role="status">
        <LoaderCircle size={36} className="animate-spin text-brand-soft" aria-hidden="true" />
        <p className="text-muted">Verificando tu cuenta...</p>
      </div>
    );
  }

  if (state.status === "ok") {
    return (
      <div className="w-full">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#6fd08c]/15 text-[#6fd08c]">
          <Check size={28} aria-hidden="true" />
        </div>
        <h1 className="mb-2 font-heading text-3xl font-extrabold">¡Cuenta verificada!</h1>
        <p className="mb-6 text-sm text-muted">Tu correo está confirmado. Ya puedes iniciar sesión.</p>
        <Link
          href="/sign_in"
          className="block w-full rounded-md bg-brand py-2.5 text-center font-heading font-bold text-white transition-colors hover:bg-brand-hover"
        >
          Iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand/15 text-brand-soft">
        <X size={28} aria-hidden="true" />
      </div>
      <h1 className="mb-2 font-heading text-3xl font-extrabold">No se pudo verificar</h1>
      <p className="mb-6 text-sm text-muted">{state.message}</p>

      {state.email ? (
        <Link
          href={`/verify?email=${encodeURIComponent(state.email)}`}
          className="block w-full rounded-md bg-brand py-2.5 text-center font-heading font-bold text-white transition-colors hover:bg-brand-hover"
        >
          Pedir un nuevo enlace
        </Link>
      ) : (
        <p className="text-sm text-muted">
          <Link href="/sign_in" className="font-semibold text-white hover:text-brand-soft">
            Iniciar sesión
          </Link>{" "}
          o{" "}
          <Link href="/sign_up" className="font-semibold text-white hover:text-brand-soft">
            crear una cuenta
          </Link>
          .
        </p>
      )}
    </div>
  );
}