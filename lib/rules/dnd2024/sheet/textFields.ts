// Campos de texto de la hoja y su límite de caracteres. Módulo pequeño para que lo importe también el cliente.

// Los que pide el creador
export const TEXT_LIMITS = { alignment: 40, appearance: 500, age: 500, languages: 500, notes: 10000 } as const;

// Los de la ficha: los del creador y los que solo se editan en la propia ficha (Trasfondo y Notas)
export const SHEET_TEXT_LIMITS = {
  ...TEXT_LIMITS,
  gender: 100, eyes: 100, hair: 100, skin: 100, height: 100, weight: 100, faith: 100,
  personality: 2000, ideals: 2000, bonds: 2000, flaws: 2000,
  organizations: 5000, allies: 5000, enemies: 5000,
} as const;
export type SheetTextField = keyof typeof SHEET_TEXT_LIMITS;
