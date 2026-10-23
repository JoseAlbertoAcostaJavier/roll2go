import type { ComponentType } from "react";
import Barbarian from "./barbarian";
import Bard from "./bard";
import Cleric from "./cleric";
import Druid from "./druid";
import Fighter from "./fighter";
import Monk from "./monk";
import Paladin from "./paladin";
import Ranger from "./ranger";
import Rogue from "./rogue";
import Sorcerer from "./sorcerer";
import Warlock from "./warlock";
import Wizard from "./wizard";

/** Iconos de clase indexados por `identifier` de la clase. */
export const CLASS_ICONS: Record<string, ComponentType<{ size?: number }>> = {
  barbarian: Barbarian,
  bard: Bard,
  cleric: Cleric,
  druid: Druid,
  fighter: Fighter,
  monk: Monk,
  paladin: Paladin,
  ranger: Ranger,
  rogue: Rogue,
  sorcerer: Sorcerer,
  warlock: Warlock,
  wizard: Wizard,
};
