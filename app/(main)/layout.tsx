import { cookies } from "next/headers";
import Navbar from "@/app/components/Navbar";
import ChatAssistant from "@/app/components/ChatAssistant";
import { COOKIE_NAME, verifySession } from "@/lib/auth";

/* Layout de las páginas "normales" de la web: Navbar, footer y asistente de IA.
   Toda página que se cree dentro de app/(main)/ lo hereda automáticamente.
   La sesión se lee aquí, en el servidor, y se pasa al Navbar: así no parpadea
   "Iniciar sesión" al cargar y no hace falta preguntar a la API en cada página. */
export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const user = token ? await verifySession(token) : null;

  return (
    <>
      <Navbar user={user} />
      <main>{children}</main>
      <footer className="border-t border-line bg-[#111] py-7 text-sm text-muted">
        <div className="mx-auto max-w-280 px-5">
          <a href="#" className="hover:text-brand-soft">Work In Progress</a>
          <p>Añadir Licencia Wizard of the Coast aqui más tarde.</p>
        </div>
      </footer>
      <ChatAssistant />
    </>
  );
}