import mongoose from "mongoose";

// 1. Declaramos el tipo en el espacio global de TypeScript
declare global {
  // Debe usarse 'var' obligatoriamente para extender globalThis
  var mongooseConnection: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
}

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("Falta MONGODB_URI en .env.local");
}

// 2. Usamos nuestra variable global fuertemente tipada
let cached = global.mongooseConnection;

if (!cached) {
  cached = global.mongooseConnection = { conn: null, promise: null };
}

export async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI as string, { 
      dbName: "roll2go" 
    }).then((m) => m);
  }
  
  cached.conn = await cached.promise;
  return cached.conn;
}