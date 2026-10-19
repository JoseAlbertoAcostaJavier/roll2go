"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import PasswordInput from "@/app/components/PasswordInput";
import { card, cardTitle, field, labelClass, primaryButton, successClass } from "@/app/components/formStyles";

// Envía un cambio de cuenta a la API y devuelve el resultado, sin romperse si la respuesta no es JSON
async function send(payload: Record<string, unknown>) {
  try {
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) return { ok: true as const };
    return { ok: false as const, error: (data?.error as string) ?? `El servidor ha respondido con un error (${res.status}).` };
  } catch {
    return { ok: false as const, error: "No se pudo conectar con el servidor." };
  }
}

function useAction() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function run(payload: Record<string, unknown>, okMessage: string, after?: () => void) {
    setLoading(true);
    setError("");
    setSuccess("");
    const r = await send(payload);
    setLoading(false);
    if (!r.ok) return setError(r.error);
    setSuccess(okMessage);
    after?.();
    router.refresh();
  }
  return { loading, error, success, run };
}

function Feedback({ error, success }: { error: string; success: string }) {
  return (
    <>
      {error && <p className="mt-3 text-sm text-brand-soft" role="alert">{error}</p>}
      {success && <p className={`mt-3 ${successClass}`} role="status">{success}</p>}
    </>
  );
}

function UsernameForm({ username }: { username: string }) {
  const [value, setValue] = useState(username);
  const { loading, error, success, run } = useAction();
  return (
    <form
      noValidate
      className={card}
      onSubmit={(e) => {
        e.preventDefault();
        run({ kind: "username", username: value }, "Nombre de usuario actualizado.");
      }}
    >
      <h2 className={cardTitle}>Nombre de usuario</h2>
      <label htmlFor="username" className={labelClass}>Usuario (@)</label>
      <input id="username" type="text" maxLength={20} autoCapitalize="none" spellCheck={false} value={value} onChange={(e) => setValue(e.target.value)} className={field} />
      <p className="mt-1 text-xs text-muted">Entre 3 y 20 caracteres: letras, números y guion bajo. Con él también se inicia sesión.</p>
      <button type="submit" disabled={loading || value === username} className={`${primaryButton} mt-4`}>
        {loading && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />} Cambiar usuario
      </button>
      <Feedback error={error} success={success} />
    </form>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const { loading, error, success, run } = useAction();
  const [localError, setLocalError] = useState("");
  return (
    <form
      noValidate
      className={card}
      onSubmit={(e) => {
        e.preventDefault();
        setLocalError("");
        if (next.length < 8) return setLocalError("La contraseña nueva debe tener al menos 8 caracteres.");
        if (next !== confirm) return setLocalError("Las contraseñas no coinciden.");
        run({ kind: "password", currentPassword: current, newPassword: next }, "Contraseña actualizada.", () => {
          setCurrent("");
          setNext("");
          setConfirm("");
        });
      }}
    >
      <h2 className={cardTitle}>Contraseña</h2>
      <div className="mb-4">
        <label htmlFor="pw-current" className={labelClass}>Contraseña actual</label>
        <PasswordInput id="pw-current" value={current} onChange={setCurrent} autoComplete="current-password" />
      </div>
      <div className="mb-4">
        <label htmlFor="pw-new" className={labelClass}>Contraseña nueva</label>
        <PasswordInput id="pw-new" value={next} onChange={setNext} autoComplete="new-password" />
        <p className="mt-1 text-xs text-muted">Mínimo 8 caracteres</p>
      </div>
      <div>
        <label htmlFor="pw-confirm" className={labelClass}>Confirma la contraseña nueva</label>
        <PasswordInput id="pw-confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" />
      </div>
      <button type="submit" disabled={loading || !current || !next} className={`${primaryButton} mt-4`}>
        {loading && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />} Cambiar contraseña
      </button>
      <Feedback error={localError || error} success={success} />
    </form>
  );
}

function EmailForm({ email, pendingEmail }: { email: string; pendingEmail: string | null }) {
  const [value, setValue] = useState("");
  const [password, setPassword] = useState("");
  const { loading, error, success, run } = useAction();
  return (
    <form
      noValidate
      className={card}
      onSubmit={(e) => {
        e.preventDefault();
        run({ kind: "email", newEmail: value, currentPassword: password }, "Te hemos enviado un enlace de confirmación al correo nuevo.", () => {
          setValue("");
          setPassword("");
        });
      }}
    >
      <h2 className={cardTitle}>Correo electrónico</h2>
      <p className="mb-4 text-sm text-muted">
        Correo actual: <strong className="break-all text-white">{email}</strong>
      </p>
      {pendingEmail && (
        <p className="mb-4 rounded-md border border-line bg-surface p-3 text-sm text-muted">
          Pendiente de confirmar: <strong className="break-all text-white">{pendingEmail}</strong>. Pulsa el enlace que
          te hemos enviado a esa dirección para completar el cambio. Caduca a los 30 minutos.
        </p>
      )}
      <div className="mb-4">
        <label htmlFor="new-email" className={labelClass}>Correo nuevo</label>
        <input id="new-email" type="email" autoComplete="email" value={value} onChange={(e) => setValue(e.target.value)} className={field} />
      </div>
      <div>
        <label htmlFor="email-pw" className={labelClass}>Contraseña actual</label>
        <PasswordInput id="email-pw" value={password} onChange={setPassword} autoComplete="current-password" />
      </div>
      <button type="submit" disabled={loading || !value || !password} className={`${primaryButton} mt-4`}>
        {loading && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />} Cambiar correo
      </button>
      <Feedback error={error} success={success} />
    </form>
  );
}

export default function AccountForms({
  username, email, pendingEmail,
}: {
  username: string; email: string; pendingEmail: string | null;
}) {
  return (
    <div className="space-y-6">
      <UsernameForm username={username} />
      <EmailForm email={email} pendingEmail={pendingEmail} />
      <PasswordForm />
    </div>
  );
}