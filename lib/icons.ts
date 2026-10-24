// Iconos de clase, escuela de magia, especie y estado del personaje (public/images, generados por scripts/build-icons.ts)

export type IconKind = "class" | "school" | "species" | "status";

// Escuela de 5etools (`SpellData.school`) → nombre del archivo
const SCHOOLS: Record<string, string> = {
  A: "abjuration", C: "conjuration", D: "divination", E: "enchantment",
  V: "evocation", I: "illusion", N: "necromancy", T: "transmutation",
};
const SCHOOL_FILES = new Set(Object.values(SCHOOLS));

// Nombres de archivo de la carpeta de iconos que no coinciden con el identificador
const RENAMES: Partial<Record<IconKind, Record<string, string>>> = {
  class: { babarian: "barbarian" },
  status: { active: "active", archived: "retired", dead: "dead", npc: "npc" },
};

/** Identificador de un archivo de la carpeta de iconos, o null si no se reconoce. */
export function iconFileId(kind: IconKind, file: string): string | null {
  const base = file.replace(/\.[a-z0-9]+$/i, "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (!base) return null;
  if (kind === "status") return RENAMES.status![base] ?? null;
  if (kind === "school") return SCHOOL_FILES.has(base) ? base : null;
  return RENAMES[kind]?.[base] ?? base;
}

/** Ruta pública del icono (`id` es el identificador, o la letra de escuela de 5etools), o null si no hay. */
export function iconSrc(kind: IconKind, id: string | null | undefined): string | null {
  if (!id) return null;
  switch (kind) {
    case "class": return `/images/classes/${id}.webp`;
    case "species": return `/images/species/${id}.webp`;
    case "school": return SCHOOLS[id] ? `/images/schools/${SCHOOLS[id]}.webp` : null;
    case "status": return `/images/status/${id}.svg`;
  }
}
