import mongoose from "mongoose";

// Declaramos el tipo en el espacio global de TypeScript
declare global {
  // Debe usarse 'var' obligatoriamente para extender globalThis
  var mongooseConnection: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
}

let cached = global.mongooseConnection;
if (!cached) {
  cached = global.mongooseConnection = { conn: null, promise: null };
}

export async function connectDB() {
  if (cached.conn) return cached.conn;

  // Se comprueba aquí dentro (y no al importar el archivo) para no romper el build
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Falta MONGODB_URI en .env.local");

  cached.promise ??= mongoose.connect(uri, { dbName: "roll2go" });
  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null; // si falla, la siguiente petición vuelve a intentarlo
    throw err;
  }
  return cached.conn;
}