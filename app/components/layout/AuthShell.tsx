import Link from "next/link";
import Image from "next/image";
import logo from "@/assets/logo.png";
/* Para el Jose del futuro, la versión antigua con el panel rojo esta en en google Docs.
   Para el resto de personas leyendo este comentario. Este componente es simplemente un contenedor decorativo
   para las páginas pertenecientes a Auth, como Sign In, Sign Up, Forgot Password, etc.
   Existe exclusivamente para no repetir código y mantener un estilo consistente en todas las páginas.
*/
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_20px_60px_rgba(0,0,0,0.6)] md:grid-cols-2">

      <div className="flex flex-col justify-center p-6 sm:p-10">
        <Link href="/" className="mx-auto mb-4 block w-40">
          <Image 
            src={logo} 
            alt="Roll2Go - Volver al inicio" 
            priority 
            className="h-auto w-full transition-transform duration-300 hover:scale-105" 
          />        
        </Link>
        {children}
      </div>
    </div>
  );
}