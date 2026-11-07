import Navbar from "@/app/components/layout/Navbar";
import ChatAssistant from "@/app/components/chat/ChatAssistant";
import { countUnread } from "@/lib/server/notifications/notify";
import { getCurrentUser } from "@/lib/server/auth/currentUser";

/* Layout de la página principal: enlace de salto, Navbar, contenido, pie y asistente de IA.
   El contenedor ocupa al menos toda la altura de la ventana para que el pie quede abajo
   también en páginas cortas. En móvil, main deja espacio inferior para el botón flotante del asistente. */
export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const unread = user ? await countUnread(user.id) : 0;
  return (
    <div data-app-shell className="flex min-h-dvh flex-col print:block print:min-h-0">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-60 focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
      >
        Saltar al contenido
      </a>
      <Navbar user={user} unread={unread} />
      <main id="main" tabIndex={-1} className="min-w-0 flex-1 pb-22 focus:outline-none sm:pb-0 print:pb-0">
        {children}
      </main>
      <footer className="border-t border-line bg-[#111] py-7 text-sm text-muted">
        <div className="mx-auto max-w-280 px-5">
          <p>Roll2Go</p>
        </div>
      </footer>
      <ChatAssistant />
    </div>
  );
}
