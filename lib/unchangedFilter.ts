// Filtro de escritura condicional: solo se escribe si el campo sigue como se leyó. Con $eq, porque Mongoose convierte
// un array suelto en $in (`"sheet.spellbookExtra": []` no coincidiría nunca).
export const unchangedFilter = (stored: unknown) => (stored === undefined ? { $exists: false } : { $eq: stored });
