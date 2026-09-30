"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Search, User } from "lucide-react";

const MENU = [
  { label: "Mis personajes" },
  { label: "Mis campañas" },
  { label: "Social" },
  { label: "Sistemas" },
];

export default function Navbar() {
  // Estado simulado para alternar entre sesión iniciada y no iniciada
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
          {MENU.map(({ label }) => (
            <button 
              key={label} 
              className="flex items-center gap-1 text-[13px] font-bold tracking-wide text-gray-200 hover:text-white uppercase transition-colors"
            >
              {label}
              <ChevronDown size={14} className="text-gray-400" aria-hidden="true" />
            </button>
          ))}
        </nav>
      </div>

      {/* Zona Derecha: Búsqueda y Autenticación */}
      <div className="flex items-center gap-5">
        
        {/* Icono de búsqueda común en ambos estados */}
        <button aria-label="Buscar en Roll2Go" className="text-gray-300 hover:text-white transition-colors">
          <Search size={20} />
        </button>

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
                Hola, Aventurero
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
              <User size={18} />
              <span className="hidden sm:inline">Iniciar sesión</span>
            </button>
            
            {/* Botón de acción principal equivalente a "CREATE ACCOUNT" */}
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