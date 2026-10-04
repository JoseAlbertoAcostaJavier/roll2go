import Link from "next/link";
import Image from "next/image";
import logo from "@/assets/logo.png";
import D20 from "@/assets/D20.png";

/* Tarjeta dividida compartida por login y registro: formulario a la izquierda
   y panel rojo con el logo a la derecha. */
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

      {/* Derecha: panel rojo plano con el logo y el lema (solo en pantallas medianas y grandes).
          "relative" es lo que ancla el D20 a este panel y no a la ventana. */}
      <aside className="relative hidden flex-col items-center justify-center gap-3 overflow-hidden bg-[#bc1e28] p-4 text-center md:flex">
        <Link href="/" className="block w-full">
        <Image src={logo} alt="Roll2Go - Volver al inicio" priority className="h-auto w-full transition-transform duration-300 hover:scale-105 hover:rotate-2" />        
        </Link>
        <p className="font-display text-[1.75rem] uppercase leading-tight text-balance text-white">
          Menos papeles y más rol
        </p>
        {/* D20 decorativo: pegado a la esquina inferior derecha del panel */}
        <Image
          src={D20}
          alt=""
          className="pointer-events-none absolute bottom-0 right-0 h-auto w-46 select-none"
        />
      </aside>
    </div>
  );
}