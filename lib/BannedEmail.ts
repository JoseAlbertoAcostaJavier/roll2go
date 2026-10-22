import mongoose from "mongoose";

/* Correos de cuentas baneadas: no se pueden volver a registrar. Se guarda aparte del usuario porque
   una cuenta sin verificar se borra sola a las 24 horas, y su correo quedaría libre. */
const BannedEmailSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  },
  { timestamps: true },
);

export const BannedEmail =
  mongoose.models.BannedEmail || mongoose.model("BannedEmail", BannedEmailSchema);
