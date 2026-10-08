"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, User } from "lucide-react";

// redirectTo: a dónde ir tras entrar (por defecto la portada)
export default function LoginForm({ redirectTo = "/" }: { redirectTo?: string }) {
  const router = useRouter();
  // "identifier" puede ser el correo o el nombre de usuario
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!identifier.trim() || !password) {
      setError("Rellena tu correo o usuario y la contraseña.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/sign_in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), password, remember }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Contraseña correcta pero cuenta sin verificar: se lleva al usuario a pedir otro enlace
        if (data.code === "unverified") {
          router.push(`/verify?email=${encodeURIComponent(data.email)}`);
          return;
        }
        setError(data.error ?? "No se pudo iniciar sesión.");
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full">
      <h1 className="mb-1 font-heading text-3xl font-extrabold">Bienvenido</h1>
      <p className="mb-6 text-sm text-muted">Entra en tu cuenta para ver tus personajes y campañas.</p>

      {/* Correo o nombre de usuario */}
      <label htmlFor="identifier" className="mb-1.5 block text-sm font-semibold">
        Correo o nombre de usuario
      </label>
      <div className="relative mb-4">
        <User size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          id="identifier"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          className="w-full rounded-md border border-line bg-surface py-2.5 pl-10 pr-3 text-fg placeholder:text-muted focus:border-brand focus:outline-none"
        />
      </div>

      {/* Contraseña */}
      <label htmlFor="password" className="mb-1.5 block text-sm font-semibold">
        Contraseña
      </label>
      <div className="relative mb-3">
        <Lock size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          id="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-line bg-surface py-2.5 pl-10 pr-11 text-fg placeholder:text-muted focus:border-brand focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setShowPassword((s) => !s)}
          aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted transition-colors hover:text-white"
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      {/* Recuérdame + contraseña olvidada */}
      <div className="mb-5 flex items-center justify-between gap-3 text-sm">
        <label className="flex cursor-pointer items-center gap-2 text-muted">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 accent-brand"
          />
          Recuérdame
        </label>
        {/*Queda por hacer la pagina forgot_password*/}
        <Link href="/forgot_password" className="text-muted transition-colors hover:text-brand-soft">
          ¿Olvidaste tu contraseña?
        </Link>
      </div>

      {error && (
        <p className="mb-4 text-sm text-brand-soft" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-brand py-2.5 font-heading font-bold text-white transition-colors enabled:hover:bg-brand-hover disabled:opacity-50"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>

      <p className="mt-5 text-center text-sm text-muted">
        ¿No tienes cuenta?{" "}
        <Link href="/sign_up" className="font-semibold text-white hover:text-brand-soft">
          Crear cuenta
        </Link>
      </p>
    </form>
  );
}