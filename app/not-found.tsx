import Link from "next/link";
import Image from "next/image";
import logo from "@/assets/logo.png";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-5 text-center">
      <Link href="/">
        <Image src={logo} alt="Roll2Go" priority className="h-auto w-48" />
      </Link>
      <p className="font-heading text-7xl font-extrabold text-brand">404</p>
      <h1 className="font-heading text-2xl font-bold">Uy...Parece que esta página se ha perdido en el calabozo</h1>
      <p className="max-w-[40ch] text-muted">
        No hemos encontrado lo que buscas. Puede que todavía no exista o que la dirección esté mal escrita.
      </p>
      <Link
        href="/"
        className="rounded-md bg-brand px-5 py-2.5 font-heading font-bold text-white transition-colors hover:bg-brand-hover"
      >
        Volver al inicio
      </Link>
    </main>
  );
}