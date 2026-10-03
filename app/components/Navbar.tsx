"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  ChevronDown, CircleUser, Swords, Users, BookOpen, BookMarked, User, House, Menu, X,
} from "lucide-react";
// OJO: usa aquí la misma ruta de tu logo que ya tenías funcionando
import logo from "@/assets/logo.png";

/*Definición del menú principal con etiquetas, iconos y a dónde lleva cada uno.
  El formato es: label: "Nombre de la sección", icon: Icono correspondiente, href: "/ruta".
  Los iconos se importan desde la librería lucide-react y se asignan a cada sección del menú.
  Galeria con los Iconos: https://lucide.dev/icons/
  Este array alimenta tanto el menú de escritorio como el desplegable de la hamburguesa.
*/
const MENU = [
  { label: "Inicio", icon: House, href: "/" },
  { label: "Mis personajes", icon: User, href: "/personajes" },
  { label: "Mis campañas", icon: Swords, href: "/campanas" },
  { label: "Social", icon: Users, href: "/social" },
  { label: "Sistemas", icon: BookOpen, href: "/sistemas" },
  { label: "Biblioteca", icon: BookMarked, href: "/biblioteca" },
];

export default function Navbar() {
  /*Estado simulado para alternar entre sesión iniciada y no iniciada
    Por ahora lo he hecho muy simple, porque no hay sistema de autenticación implementado. En un futuro,
    este estado debería estar vinculado a la autenticación real del usuario, y cambiar dinámicamente 
    según el estado de la sesión. Incluso se podría tener en cuenta si el usuario desea que se le recuerde la sesión 
    iniciada o no, y almacenar esa preferencia en cookies o localStorage.
    Además, una vez establecido el sistema de autenticación, se podría mostrar el nombre del usuario en 
    lugar de "Usuario" en la barra de navegación.
  */
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Menú desplegable (hamburguesa): abierto o cerrado
  const [menuOpen, setMenuOpen] = useState(false);

  // Ruta actual (por ejemplo "/personajes")
  const pathname = usePathname() ?? "";

  // "Inicio" solo está activo en "/" exacto; el resto también en sus subpáginas (/personajes/nuevo...)
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  // Con el menú desplegable abierto, la tecla Escape lo cierra
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  /* El prefijo "nav:" (definido en globals.css, 1360px) marca el punto en el que cabe el menú completo.
     Por debajo de ese ancho se ve: hamburguesa + logo + botones de sesión.
     Desde ese ancho: logo + menú completo + botones de sesión. */
  return (
    <header className="relative z-40 flex items-stretch justify-between gap-3 border-b border-black bg-surface px-4 text-white lg:px-8">

      {/* Zona Izquierda: Hamburguesa, Logo y Menú Principal */}
      <div className="flex items-stretch gap-3 nav:gap-6">
        {/* Botón de hamburguesa: visible hasta que cabe el menú completo */}
        <button
          className="flex items-center text-gray-300 transition-colors hover:text-white nav:hidden"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <Link className="flex shrink-0 items-center py-2" href="/" onClick={() => setMenuOpen(false)}>
          <Image src={logo} alt="Roll2Go" priority className="h-auto w-36 md:w-44 hover:scale-105 transition-all" />
        </Link>

        {/* Navegación principal: solo cuando cabe completa */}
        <nav className="hidden items-stretch gap-1 nav:flex" aria-label="Menú principal">
          {MENU.map(({ label, icon: Icon, href }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className="group relative flex items-center whitespace-nowrap"
              >
                {/* Píldora: es lo que se ilumina en hover, más pequeña que la barra */}
                <span
                  className={`flex items-center  gap-1.5 px-4.5 py-4 text-[13px] font-bold uppercase tracking-wide transition-colors ${
                    active ? "text-white" : "text-gray-300 group-hover:bg-brand group-hover:text-white"
                  }`}
                >
                  <Icon
                    size={16}
                    className={`transition-colors ${active ? "text-white" : "text-gray-400 group-hover:text-white"}`}
                    aria-hidden="true"
                  />
                  {label}
                </span>
                {/* Línea roja que marca la zona activa */}
                {active && (
                  <span className="absolute inset-x-0 bottom-0 h-[3px] bg-brand" aria-hidden="true" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Zona Derecha: Autenticación 
      Si está logueado, se muestra su perfil y un botón para cerrar sesión. 
      Si no está logueado, se muestran botones para iniciar sesión o crear una cuenta.
      Por ahora, estos botones solo simulan el cambio de estado de sesión, 
      pero en un futuro deberían estar conectados a la lógica real de autenticación del usuario.
      */}
      <div className="flex shrink-0 items-center gap-5 py-3">
        {isLoggedIn ? (
          /* ESTADO: SESIÓN INICIADA */
          <>
            {/* Caja de Perfil */}
            <div
              className="flex cursor-pointer items-center gap-2 rounded border border-line bg-panel px-3 py-1.5 transition-colors hover:bg-line"
              onClick={() => setIsLoggedIn(false)}
              title="Cerrar sesión (Simulación)"
            >
              <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-gray-600">
                <User size={16} className="text-gray-300" />
              </div>
              <span className="hidden whitespace-nowrap text-sm font-medium text-gray-200 sm:block">
                {/*Debo cambiar esto por el nombre del usuario en la base de datos.*/}
                Hola, Usuario
              </span>
              <ChevronDown size={14} className="hidden text-gray-400 sm:block" />
            </div>
          </>
        ) : (
          /* ESTADO: INVITADO (SIN INICIAR SESIÓN) */
          <>
            {/* Botón Sign in */}
            <button
              className="flex items-center gap-2 whitespace-nowrap text-sm font-medium text-gray-300 transition-colors hover:text-white"
              onClick={() => setIsLoggedIn(true)}
            >
              <CircleUser size={18} />
              <span className="hidden sm:inline">Iniciar sesión</span>
            </button>

            {/* Botón de acción principal equivalente a "CREATE ACCOUNT"
                Esto es solo ahora porque no hay sistema de autenticación. En un futuro, este botón debería 
                llevar a un formulario de registro.
            */}
            <button
              className="whitespace-nowrap bg-brand px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-brand-hover"
              onClick={() => setIsLoggedIn(true)}
            >
              Crear cuenta
            </button>
          </>
        )}
      </div>

      {/* Menú desplegable: siempre en el DOM para poder animar la apertura y el cierre */}
      <div
        className={`fixed inset-0 -z-10 bg-black/50 transition-opacity duration-300 nav:hidden ${
          menuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />
      <nav
        id="mobile-menu"
        className={`absolute inset-x-0 top-full flex flex-col border-b border-black bg-surface pb-0 pt-1 shadow-[0_12px_30px_rgba(0,0,0,0.6)] 
        transition-[opacity,transform,visibility] duration-300 ease-out nav:hidden ${menuOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-2 opacity-0"
        }`}
        aria-label="Menú principal"
      >
        {MENU.map(({ label, icon: Icon, href }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 border-l-4 px-5 py-3 text-sm font-bold uppercase tracking-wide transition-colors ${
                active
                  ? "border-brand bg-panel text-white"
                  : "border-transparent text-gray-300 hover:bg-panel hover:text-white"
              }`}
            >
              <Icon size={18} className={active ? "text-white" : "text-gray-400"} aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}