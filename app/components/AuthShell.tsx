import Link from "next/link";
import Image from "next/image";
import logo from "@/assets/logo.png";

/* Tarjeta dividida compartida por login y registro: formulario a la izquierda (children)
   y panel decorativo rojo a la derecha. */
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_20px_60px_rgba(0,0,0,0.6)] md:grid-cols-2">
      {/* Izquierda: formulario (en móvil lleva el logo arriba, porque el panel derecho se oculta) */}
      <div className="flex flex-col justify-center p-6 sm:p-10">
        <Link href="/" className="mb-6 self-center md:hidden">
          <Image src={logo} alt="Roll2Go - Volver al inicio" priority className="h-auto w-40" />
        </Link>
        {children}
      </div>

      {/* Derecha: panel decorativo (solo en pantallas medianas y grandes).
          Para poner una foto en su lugar: añade "relative" a esta etiqueta y sustituye su contenido por
          <Image src={tuImagen} alt="" fill className="object-cover" /> */}
      <aside className="relative hidden flex-col items-center justify-center gap-5 overflow-hidden bg-[linear-gradient(135deg,var(--color-brand-dark),var(--color-brand))] p-10 text-center md:flex">
        {/* Dado de 20 caras decorativo */}
        <svg
          viewBox="0 0 100 100"
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -right-20 h-96 w-96 text-white/10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        >
          <polygon points="50,3 91,26 91,74 50,97 9,74 9,26" />
          <polygon points="50,24 76,68 24,68" />
          <path d="M50 3V24M91 26L76 68M9 26L24 68M50 97L76 68M50 97L24 68M91 26L50 24M9 26L50 24" />
        </svg>

        <Link href="/" className="relative">
          <Image src={logo} alt="Roll2Go - Volver al inicio" priority className="h-auto w-56" />
        </Link>
        <p className="relative font-heading text-xl font-bold">Tu mesa de rol, en cualquier sitio</p>
        <p className="relative max-w-[28ch] text-sm text-white/80">
          Crea personajes, organiza campañas y tira dados con tu grupo.
        </p>
      </aside>
    </div>
  );
}