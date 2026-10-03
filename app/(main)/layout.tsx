import Navbar from "@/app/components/Navbar";
import ChatAssistant from "@/app/components/ChatAssistant";

/* Layout de las páginas "normales" de la web: Navbar, footer y asistente de IA.
   Toda página que se cree dentro de app/(main)/ lo hereda automáticamente. */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
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
