"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, CircleUser, Swords, Users, BookMarked, User, House } from "lucide-react";
/*Definición del menú principal con etiquetas y sus respectivos iconos
  El formato siempre es label: "Nombre de la sección", icon: Icono correspondiente
  Los iconos se importan desde la librería lucide-react y se asignan a cada sección del menú.
  Galeria con los Iconos: https://lucide.dev/icons/
*/
const MENU = [
  { label: "Inicio", icon: House },  
  { label: "Mis personajes", icon: User },
  { label: "Mis campañas", icon: Swords },
  { label: "Social", icon: Users },
  { label: "Biblioteca", icon: BookMarked }
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

  return (
    <header className="flex items-center justify-between px-4 lg:px-8 py-3 bg-[#19191a] text-white border-b border-[#000]">
      
      {/* Zona Izquierda: Logo y Menú Principal */}
      <div className="flex items-center gap-8">
        {/* Logo manteniendo tu clase CSS original */}
        <Link className="brand" href="/" style={{ margin: 0, padding: 0 }}>
          Roll<span>2</span>Go
        </Link>

        {/* Navegación principal (Oculta en móviles, visible en escritorio) */}
        <nav className="hidden md:flex items-center gap-6" aria-label="Menú principal">
          {MENU.map(({ label, icon: Icon }) => (
            <button 
              key={label} 
              className="flex items-center gap-1 text-[13px] font-bold tracking-wide text-gray-200 hover:text-white uppercase transition-colors"
            >
              <Icon size={16} className="text-gray-400" aria-hidden="true"/>
              {label}
              <ChevronDown size={14} className="text-gray-400" aria-hidden="true" />
            </button>
          ))}
        </nav>
      </div>

      {/* Zona Derecha: Autenticación 
      Si está logueado, se muestra su perfil y un botón para cerrar sesión. 
      Si no está logueado, se muestran botones para iniciar sesión o crear una cuenta.
      Por ahora, estos botones solo simulan el cambio de estado de sesión, 
      pero en un futuro deberían estar conectados a la lógica real de autenticación del usuario.
      */}
      <div className="flex items-center gap-5">
        {isLoggedIn ? (
          /* ESTADO: SESIÓN INICIADA */
          <>
            {/* Caja de Perfil */}
            <div 
              className="flex items-center gap-2 bg-[#242426] px-3 py-1.5 rounded cursor-pointer hover:bg-[#38383b] transition-colors border border-[#38383b]"
              onClick={() => setIsLoggedIn(false)}
              title="Cerrar sesión (Simulación)"
            >
              <div className="w-7 h-7 bg-gray-600 rounded-full flex items-center justify-center overflow-hidden">
                <User size={16} className="text-gray-300" />
              </div>
              <span className="text-sm font-medium text-gray-200 hidden sm:block">
                {/*Debo cambiar esto por el nombre del usuario en la base de datos.*/ }                
                Hola, Usuario 
              </span>
              <ChevronDown size={14} className="text-gray-400 hidden sm:block" />
            </div>
          </>
        ) : (
          /* ESTADO: INVITADO (SIN INICIAR SESIÓN) */
          <>
            {/* Botón Sign in */}
            <button 
              className="flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
              onClick={() => setIsLoggedIn(true)}
            >
              <CircleUser size={18} />
              <span className="hidden sm:inline">Iniciar sesión</span>
            </button>
            
            {/* Botón de acción principal equivalente a "CREATE ACCOUNT"
                Esto es solo ahora porque no hay sistema de autenticación. En un futuro, este botón debería 
                llevar a un formulario de registro.
            */ }           
            <button 
              className="bg-[#dc3741] hover:bg-[#c22d37] text-white px-4 py-2 font-bold text-xs uppercase tracking-wider transition-colors"
              onClick={() => setIsLoggedIn(true)} 
              >
              Crear cuenta
            </button>
          </>
        )}
      </div>
    </header>
  );
}