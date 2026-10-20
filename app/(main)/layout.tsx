import Navbar from "@/app/components/Navbar";
import ChatAssistant from "@/app/components/ChatAssistant";
import { countUnread } from "@/lib/notify";

/* Layout de la página principal incluye: Navbar, footer y asistente de IA.   
*/
import { getCurrentUser } from "@/lib/currentUser";
// ...

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const unread = user ? await countUnread(user.id) : 0;
  return (
    <>
      <Navbar user={user} unread={unread} />      <main>{children}</main>
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