import type { Metadata } from "next";
import { Montserrat, Open_Sans, Lilita_One as Bebas_Neue } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat" });
const openSans = Open_Sans({ subsets: ["latin"], variable: "--font-open-sans" });
const display = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--font-display-face" });
export const metadata: Metadata = {
  // Plantilla: una página con title "Inicio" se muestra como "Inicio - Roll2Go"
  title: {
    default: "Roll2Go - Tu mesa de rol, en cualquier sitio",
    template: "%s - Roll2Go",
  },
  description: "Crea personajes, organiza campañas y tira dados con tu grupo.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${montserrat.variable} ${openSans.variable} ${display.variable}`}>
        {children}
      </body>
    </html>
  );
}