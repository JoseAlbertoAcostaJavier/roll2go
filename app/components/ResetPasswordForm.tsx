"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Eye, EyeOff, LoaderCircle } from "lucide-react";

export default function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const inputClass = (hasError: boolean, extra = "pr-11") =>
    `w-full rounded-md border bg-surface py-2.5 pl-10 ${extra} text-fg placeholder:text-muted focus:outline-none transition-colors ${
      hasError ? "border-brand-soft" : "border-line focus:border-brand"
    }`;
    if (!token) {
      return (
        <div className="w-full">
          <h1 className="mb-2 font-heading text-3xl font-extrabold">Enlace no válido</h1>
          <p className="mb-6 text-sm text-muted">
            Este enlace está incompleto. Pide uno nuevo desde la pantalla de recuperación.
          </p>
          <Link
            href="/forgot_password"
            className="block w-full rounded-md bg-brand py-2.5 text-center font-heading font-bold text-white transition-colors hover:bg-brand-hover"
          >
            Pedir un enlace nuevo
          </Link>
        </div>
      );
    }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Enlace inválido o incompleto.");
      return;
    }
    if (password.length < 8 || password.length > 72) {
      setError("La contraseña debe tener entre 8 y 72 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset_password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "No se pudo cambiar la contraseña.");

      router.push("/sign_in?reset=success");
    } catch (err) {
        if (err instanceof Error) {
            setError(err.message);
        } else {
            setError("Ocurrió un error inesperado.");
        }
        } finally {
        setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full">
      <h1 className="mb-1 font-heading text-3xl font-extrabold">Nueva contraseña</h1>
      <p className="mb-6 text-sm text-muted">Elige tu nueva clave de acceso.</p>

      <div className="mb-4">
        <label htmlFor="password" className="mb-1.5 block text-sm font-semibold">
          Nueva contraseña
        </label>
        <div className="relative">
          <Lock size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass(!!error && password.length > 0 && password.length < 8)}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted hover:text-white"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      <div className="mb-6">
        <label htmlFor="confirm" className="mb-1.5 block text-sm font-semibold">
          Confirma la contraseña
        </label>
        <div className="relative">
          <Lock size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            id="confirm"
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass(!!error && confirm !== "" && confirm !== password)}
          />
          <button
            type="button"
            onClick={() => setShowConfirm((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted hover:text-white"
          >
            {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-brand-soft" role="alert">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 font-heading font-bold text-white transition-colors enabled:hover:bg-brand-hover disabled:opacity-50"
      >
        {loading && <LoaderCircle size={18} className="animate-spin" />}
        {loading ? "Actualizando..." : "Actualizar contraseña"}
      </button>
    </form>
  );
}