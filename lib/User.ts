import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    usernameLower: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    email: { type: String, required: true, unique: true, lowercase: true },
    // select: false -> no se devuelve en las consultas salvo que se pida con .select("+passwordHash")
    passwordHash: { type: String, required: true, select: false },
    verified: { type: Boolean, default: false },
    // Verificación del correo: se guarda el HASH del token (nunca el token) y cuándo caduca
    verifyTokenHash: { type: String, select: false, index: true, sparse: true },
    verifyTokenExpires: { type: Date, select: false },
  },
  {
    timestamps: true, // Esto crea automáticamente createdAt y updatedAt
  },
);

  // Borra las cuentas SIN verificar pasadas 24 horas (no toca las que ya están verificadas)
UserSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24, partialFilterExpression: { verified: false } },
);
// En Next.js, los modelos pueden compilarse varias veces.
// Esta línea comprueba si ya existe antes de crearlo.
export const User = mongoose.models.User || mongoose.model("User", UserSchema);
