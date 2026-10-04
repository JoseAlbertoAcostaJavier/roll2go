import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    usernameLower: { type: String, required: true, unique: true, lowercase: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    // select: false -> no se devuelve en las consultas salvo que se pida con .select("+passwordHash")
    passwordHash: { type: String, required: true, select: false },
  },
  {
    timestamps: true, // Esto crea automáticamente createdAt y updatedAt
  },
);

// En Next.js, los modelos pueden compilarse varias veces.
// Esta línea comprueba si ya existe antes de crearlo.
export const User = mongoose.models.User || mongoose.model("User", UserSchema);