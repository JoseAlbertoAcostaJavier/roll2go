// Icono de cada acción básica de combate (archivos de public/assets/icons/dark/actions)
import { iconSrc } from "@/lib/utils/icons";

/** Clave de la entrada `action` → identificador del icono. Las acciones que no figuran no llevan icono. */
export const ACTION_ICONS: Record<string, string> = {
  "action:attack|xphb": "attack",
  "action:dash|xphb": "dash",
  "action:disengage|xphb": "disengage",
  "action:dodge|xphb": "dodge",
  "action:help|xphb": "help",
  "action:hide|xphb": "hide",
  "action:ready|xphb": "ready-action",
  "action:search|xphb": "search",
  "action:study|xphb": "search",
  "action:don or doff a shield|xphb": "use-shield",
  "action:escape a grapple|xphb": "escape",
  "action:opportunity attack|xphb": "opportunity-attack",
  "action:two-weapon fighting|xphb": "offhand-attack",
  "action:utilize|xphb": "quick-interaction",
  "action:magic|xphb": "cast-spell",
  "action:improvising an action|xphb": "improvise",
  "action:influence|xphb": "communicate",
  "action:end concentration|xphb": "concentration",
};

/** Ruta del icono de la acción, o null si no tiene. */
export function actionIcon(key: string): string | null {
  return iconSrc("action", ACTION_ICONS[key]);
}
