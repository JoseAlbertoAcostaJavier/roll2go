import { cookies } from "next/headers";
import Navbar from "@/app/components/Navbar";
import ChatAssistant from "@/app/components/ChatAssistant";
import { COOKIE_NAME, verifySession } from "@/lib/auth";

/* Layout de la página principal incluye: Navbar, footer y asistente de IA.   
*/
   
export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const user = token ? await verifySession(token) : null;

  return (
    <>
      <Navbar user={user} />
      <main>{children}</main>
      <footer className="border-t border-line bg-[#111] py-7 text-sm text-muted">
        {/* Footer de la página principal. Añadire contenido aquí más tarde. */}
        <div className="mx-auto max-w-280 px-5">
          <a href="#" className="hover:text-brand-soft">Work In Progress</a>
          <p>Añadir Licencia Wizard of the Coast aqui más tarde.</p>
        </div>
      </footer>
      <ChatAssistant />
    </>
  );
}