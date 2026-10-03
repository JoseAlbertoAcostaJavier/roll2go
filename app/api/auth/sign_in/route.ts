import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/lib/User";
import { COOKIE_NAME, signSession, sessionCookieOptions } from "@/lib/auth";

// Hash falso: se compara igualmente cuando el usuario no existe, para que la
// respuesta tarde lo mismo y no se pueda averiguar qué cuentas existen
const DUMMY_HASH = bcrypt.hashSync("no-existe", 12);

export async function POST(req: NextRequest) {
  let body: { identifier?: unknown; password?: unknown; remember?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  }

  const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const remember = body.remember === true;

  if (!identifier || !password) {
    return NextResponse.json({ error: "Rellena tu correo o usuario y la contraseña." }, { status: 400 });
  }

  try {
    // 1. Conectar a MongoDB a través de Mongoose
    await connectDB();

    // 2. Buscar al usuario (Si lleva "@" es un correo; si no, un nombre de usuario)
    const isEmail = identifier.includes("@");
    const user = await User.findOne(
      isEmail 
        ? { email: identifier.toLowerCase() } 
        : { usernameLower: identifier.toLowerCase() }
    );

    // 3. Verificar contraseña
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    
    if (!user || !ok) {
      // Mensaje genérico a propósito: no se dice si falló el usuario o la contraseña
      return NextResponse.json({ error: "Credenciales incorrectas." }, { status: 401 });
    }

    // 4. Crear sesión y firmar JWT
    const id = user._id.toString();
    const token = await signSession({ id, username: user.username }, remember);
    
    const res = NextResponse.json({ user: { id, username: user.username } });
    
    // 5. Inyectar la cookie en la respuesta
    res.cookies.set(COOKIE_NAME, token, sessionCookieOptions(remember));
    
    return res;
    
  } catch (err) {
    console.error("Error al iniciar sesión:", err);
    return NextResponse.json({ error: "No se pudo iniciar sesión. Inténtalo de nuevo." }, { status: 500 });
  }
}