// Expresiones de dados de la ficha. Módulo puro: lo usan componentes de servidor y de cliente.

/** «1d20+5» para un bonificador. */
export const d20Expr = (bonus: number) => `1d20${bonus >= 0 ? "+" : ""}${bonus}`;

/** Primera expresión de dados de un texto de daño («1d6-1 / 1d8-1 (dos manos)» → «1d6-1»); null si no tiene dados. */
export const diceIn = (text: string) => /\d{1,2}d\d{1,3}(?:[+-]\d{1,4})?/i.exec(text)?.[0] ?? null;
