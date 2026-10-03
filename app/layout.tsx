import type { Metadata } from "next";
import { Montserrat, Open_Sans } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat" });
const openSans = Open_Sans({ subsets: ["latin"], variable: "--font-open-sans" });

export const metadata: Metadata = {
  title: {
    default: "Roll2Go - Tu mesa de rol, en cualquier sitio",
    template: "%s - Roll2Go",
  },
  description: "Crea personajes, organiza campañas y tira dados con tu grupo.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${montserrat.variable} ${openSans.variable}`}>{children}</body>
    </html>
  );
}