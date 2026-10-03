import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/lib/User";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    // 1. Conectar a la base de datos
    await connectDB();

    // 2. Extraer datos
    const { username, email, password } = await req.json();

    if (!username || !email || !password) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    const emailLower = email.toLowerCase();
    const usernameLower = username.toLowerCase();

    // 3. Comprobar si el usuario o correo ya existen
    const existingUser = await User.findOne({
      $or: [{ email: emailLower }, { usernameLower: usernameLower }]
    });

    if (existingUser) {
      return NextResponse.json({ error: "El correo o nombre de usuario ya está en uso" }, { status: 409 });
    }

    // 4. Encriptar contraseña y crear usuario
    const passwordHash = await bcrypt.hash(password, 10);

    await User.create({
      username,
      usernameLower,
      email: emailLower,
      passwordHash,
    });

    return NextResponse.json({ success: true, message: "Cuenta creada" }, { status: 201 });

  } catch (error) {
    console.error("Error en sign_up:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}