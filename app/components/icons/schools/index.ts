import type { ComponentType } from "react";
import Abjuration from "./abjuration";
import Conjuration from "./conjuration";
import Divination from "./divination";
import Enchantment from "./enchantment";
import Evocation from "./evocation";
import Illusion from "./illusion";
import Necromancy from "./necromancy";
import Transmutation from "./transmutation";

/** Iconos de escuela de magia indexados por la letra de 5etools (`SpellData.school`). */
export const SCHOOL_ICONS: Record<string, ComponentType<{ size?: number }>> = {
  A: Abjuration,
  C: Conjuration,
  D: Divination,
  E: Enchantment,
  V: Evocation,
  I: Illusion,
  N: Necromancy,
  T: Transmutation,
};
