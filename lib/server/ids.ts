import "server-only";
import mongoose from "mongoose";

// Ids de MongoDB para las rutas y las páginas, que no importan mongoose
export const isValidId = (id: unknown) => mongoose.isValidObjectId(id);
export const newId = () => new mongoose.Types.ObjectId().toHexString();
