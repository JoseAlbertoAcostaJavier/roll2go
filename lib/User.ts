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
    verifyTokenExpires: { type: Date, select: false }, // ... debajo de verifyTokenExpires

    resetTokenHash: { type: String, select: false, index: true, sparse: true },
    resetTokenExpires: { type: Date, select: false },
    // Libros de reglas que el usuario posee (ids de lib/books.ts). Se editarán desde el perfil.
    ownedBooks: { type: [String], default: [] },

    // Perfil público
    displayName: { type: String, trim: true, maxlength: 40, default: "" },
    pronouns: { type: String, trim: true, maxlength: 30, default: "" },
    location: { type: String, trim: true, maxlength: 60, default: "" },
    bio: { type: String, maxlength: 500, default: "" },
    avatarId: { type: mongoose.Schema.Types.ObjectId, ref: "CampaignImage" },
    // Cambio de correo pendiente de confirmar (reutiliza verifyTokenHash y verifyTokenExpires)
    pendingEmail: { type: String, select: false, lowercase: true },
    // Si, además de en Roll2Go, la notificación llega por correo
    emailPrefs: {
      campaigns: { type: Boolean, default: true },
      messages: { type: Boolean, default: false },
      social: { type: Boolean, default: true },
    },
    //Si el usuario es administrador o no (para poder acceder al panel de administración)
    // Búsqueda por prefijo del nombre visible (copia en minúsculas; se rellena al guardar el perfil)
    displayNameLower: { type: String, default: "", index: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    // Moderación: historial de advertencias y baneo permanente (con bannedAt la cuenta no puede entrar)
    warnings: {
      type: [
        {
          reason: { type: String, required: true, maxlength: 500 },
          by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    bannedAt: { type: Date, default: null },
    banReason: { type: String, maxlength: 500, default: "" },
    bannedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
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
