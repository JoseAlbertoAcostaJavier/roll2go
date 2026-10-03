import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    usernameLower: { type: String, required: true, unique: true, lowercase: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
  },
  { 
    timestamps: true // Esto crea automáticamente createdAt y updatedAt
  }
);

// En Next.js, los modelos pueden compilarse varias veces. 
// Esta línea comprueba si ya existe antes de crearlo.
export const User = mongoose.models.User || mongoose.model("User", UserSchema);