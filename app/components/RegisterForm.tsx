"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, User } from "lucide-react";

type Errors = Partial<Record<"username" | "email" | "password" | "confirm", string>>;

// Estilos del campo: borde normal o rojo claro si tiene error
const inputClass = (hasError: boolean, extra = "pr-3") =>
  `w-full rounded-md border bg-surface py-2.5 pl-10 ${extra} text-fg placeholder:text-muted focus:outline-none ${
    hasError ? "border-brand-soft" : "border-line focus:border-brand"
  }`;
const iconClass = "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted";

export default function RegisterForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  // Cada contraseña tiene su propio ojo: se muestran u ocultan por separado
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  // Comprueba los campos y devuelve un error por cada uno que no cumpla
  function validate(): Errors {
    const e: Errors = {};
    // El nombre de usuario no puede llevar "@" ni espacios: así el login distingue usuario de correo
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
      e.username = "Entre 3 y 20 caracteres: letras, números y guion bajo (sin @ ni espacios).";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      e.email = "Escribe un correo electrónico válido.";
    }
    if (password.length < 8) {
      e.password = "La contraseña debe tener al menos 8 caracteres.";
    }
    if (confirm !== password) {
      e.confirm = "Las contraseñas no coinciden.";
    }
    return e;
  }

  async function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setFormError("");
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/sign_up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Errores por campo (por ejemplo "ese usuario ya existe") o uno general
        if (data.errors) setErrors(data.errors);
        else setFormError(data.error ?? "No se pudo crear la cuenta.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setFormError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  const errorText = (id: string, msg?: string) =>
    msg && (
      <p id={`${id}-error`} className="mt-1 text-xs text-brand-soft" role="alert">
        {msg}
      </p>
    );

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full">
      <h1 className="mb-1 font-heading text-3xl font-extrabold">Crear cuenta</h1>
      <p className="mb-6 text-sm text-muted">Únete a Roll2Go y empieza a crear tus personajes y campañas.</p>

      {/* Nombre de usuario */}
      <div className="mb-4">
        <label htmlFor="username" className="mb-1.5 block text-sm font-semibold">
          Nombre de usuario
        </label>
        <div className="relative">
          <User size={18} className={iconClass} aria-hidden="true" />
          <input
            id="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            aria-invalid={!!errors.username}
            aria-describedby={errors.username ? "username-error" : undefined}
            className={inputClass(!!errors.username)}
          />
        </div>
        {errorText("username", errors.username)}
      </div>

      {/* Correo */}
      <div className="mb-4">
        <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">
          Correo electrónico
        </label>
        <div className="relative">
          <Mail size={18} className={iconClass} aria-hidden="true" />
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            className={inputClass(!!errors.email)}
          />
        </div>
        {errorText("email", errors.email)}
      </div>

      {/* Contraseña */}
      <div className="mb-4">
        <label htmlFor="password" className="mb-1.5 block text-sm font-semibold">
          Contraseña
        </label>
        <div className="relative">
          <Lock size={18} className={iconClass} aria-hidden="true" />
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined}
            className={inputClass(!!errors.password, "pr-11")}
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
        {errorText("password", errors.password)}
      </div>

      {/* Confirmación */}
      <div className="mb-6">
        <label htmlFor="confirm" className="mb-1.5 block text-sm font-semibold">
          Confirma la contraseña
        </label>
        <div className="relative">
          <Lock size={18} className={iconClass} aria-hidden="true" />
          <input
            id="confirm"
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={!!errors.confirm}
            aria-describedby={errors.confirm ? "confirm-error" : undefined}
            className={inputClass(!!errors.confirm, "pr-11")}
          />
          <button
            type="button"
            onClick={() => setShowConfirm((s) => !s)}
            aria-label={showConfirm ? "Ocultar confirmación" : "Mostrar confirmación"}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted transition-colors hover:text-white"
          >
            {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {errorText("confirm", errors.confirm)}
      </div>

      {formError && (
        <p className="mb-4 text-sm text-brand-soft" role="alert">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-brand py-2.5 font-heading font-bold text-white transition-colors enabled:hover:bg-brand-hover disabled:opacity-50"
      >
        {loading ? "Creando cuenta..." : "Crear cuenta"}
      </button>

      <p className="mt-5 text-center text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href="/sign_in" className="font-semibold text-white hover:text-brand-soft">
          Iniciar sesión
        </Link>
      </p>
    </form>
  );
}