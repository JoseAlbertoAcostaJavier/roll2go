"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { field } from "@/app/components/formStyles";

export default function PasswordInput({
  id, value, onChange, autoComplete,
}: {
  id: string; value: string; onChange: (v: string) => void; autoComplete: "current-password" | "new-password";
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${field} pr-11`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted transition-colors hover:text-white"
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}