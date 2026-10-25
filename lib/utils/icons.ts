// Iconos de clase, escuela de magia, especie, estado y grupos de rasgos (public/assets/icons)

export type IconKind = "class" | "school" | "species" | "status" | "feature";

/** Iconos de grupos de rasgos (public/assets/icons/features). */
export type FeatureIcon = "feats" | "invocations" | "others" | "weapon-mastery";

// Escuela de 5etools (`SpellData.school`) → nombre del archivo
const SCHOOLS: Record<string, string> = {
  A: "abjuration", C: "conjuration", D: "divination", E: "enchantment",
  V: "evocation", I: "illusion", N: "necromancy", T: "transmutation",
};

/** Ruta pública del icono (`id` es el identificador, o la letra de escuela de 5etools), o null si no hay. */
export function iconSrc(kind: IconKind, id: string | null | undefined): string | null {
  if (!id) return null;
  switch (kind) {
    case "class": return `/assets/icons/classes/${id}.svg`;
    case "species": return `/assets/icons/species/${id}.png`;
    case "school": return SCHOOLS[id] ? `/assets/icons/schools/${SCHOOLS[id]}.svg` : null;
    case "status": return `/assets/icons/status/${id}.svg`;
    case "feature": return `/assets/icons/features/${id}.svg`;
  }
}
