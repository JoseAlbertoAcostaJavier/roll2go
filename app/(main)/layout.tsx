import Navbar from "@/app/components/layout/Navbar";
import ChatAssistant from "@/app/components/chat/ChatAssistant";
import { countUnread } from "@/lib/server/notifications/notify";

/* Layout de la página principal incluye: Navbar, footer y asistente de IA.   
*/
import { getCurrentUser } from "@/lib/server/auth/currentUser";
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
          <p>Roll2Go</p>
        </div>
      </footer>
      <ChatAssistant />
    </>
  );
}