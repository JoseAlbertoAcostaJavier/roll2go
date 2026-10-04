import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySession } from "@/lib/auth";

/* Las páginas privadas redirigen al login si no hay sesión válida.
   Es una comodidad de navegación: cuando existan APIs que guarden datos
   (personajes, campañas...), cada una debe volver a comprobar la sesión. */
export async function proxy(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const user = token ? await verifySession(token) : null;

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign_in";
    // Se guarda a dónde quería ir, para llevarle allí tras iniciar sesión
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// Páginas protegidas: añade aquí las nuevas rutas privadas
export const config = {
  matcher: ["/personajes/:path*", "/campanas/:path*"],
};