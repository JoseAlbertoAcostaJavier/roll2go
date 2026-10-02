"use client";
/* Componente de botón para abrir el asistente
  Este componente es un botón que, al hacer clic, dispara un evento personalizado llamado "open-assistant". 
  Este evento puede ser escuchado por otros componentes o partes de la aplicación para abrir el asistente.
  El botón recibe como prop "children", que permite pasar contenido dentro del botón, como texto o iconos.
*/
export default function OpenAssistantButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="btn" onClick={() => window.dispatchEvent(new Event("open-assistant"))}>
      {children}
    </button>
  );
}