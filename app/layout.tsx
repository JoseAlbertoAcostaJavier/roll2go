
import type { Metadata } from "next";
import { Montserrat, Open_Sans } from "next/font/google";
import Navbar from "./components/Navbar";
import "./globals.css";
import ChatAssistant from "./components/ChatAssistant";
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat" });
const openSans = Open_Sans({ subsets: ["latin"], variable: "--font-open-sans" });

export const metadata: Metadata = {
  title: "Roll2Go - Tu mesa de rol, en cualquier sitio",
  description: "Crea personajes, organiza campañas y tira dados con tu grupo.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${montserrat.variable} ${openSans.variable}`}>
        <Navbar />
        <main>{children}</main>
        <footer className="footer">
          <div className="wrap">
            <a href="#">Work In Progress</a>
          </div>
        </footer>
        <ChatAssistant />
      </body>
    </html>
  );
}
