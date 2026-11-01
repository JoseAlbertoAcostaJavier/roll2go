# Acciones unificadas — diseño

Fecha: 2026-11-01. Segunda de las cuatro fases que siguen al rework de la estructura de la ficha: 1) descanso corto (hecha), 2) **Acciones unificadas**, 3) Conjuros con búsqueda y filtros, 4) Rasgos, Trasfondo y retoque visual.

## 1. Objetivo

La pestaña Acciones deja de mostrar solo los ataques con armas y reúne todo lo que el personaje puede hacer en su turno: armas, conjuros utilizables, rasgos de clase y subclase con activación, y las acciones básicas de combate, agrupado en **Acciones**, **Acciones adicionales**, **Reacciones** y **Otras**, con filtros. La disposición sigue la de D&D Beyond; colores, tipografía e iconos son los de Roll2Go (`dark/actions`, `dark/damage-types`, `dark/weapon-types`).

Éxito: un Mago ve sus trucos de ataque en la tabla, sus conjuros de 1 acción y de reacción en su grupo y las acciones básicas; un Guerrero ve sus armas, «Ataques por acción», Recuperar el aliento en Acciones adicionales y el Ataque de oportunidad en Reacciones; los rasgos pasivos no aparecen.

Fuera de alcance: registrar usos limitados de rasgos (y el filtro «Usos limitados»), acciones personalizadas, traducir los textos de rasgos y acciones básicas (se muestran como el resto de rasgos, con el texto de 5etools), y cambiar la pestaña Conjuros.

## 2. Datos (requiere reimportar)

### 2.1 Activación de rasgos

- `FeatureData` (rasgos de clase y subclase) gana `activation?: "action" | "bonus" | "reaction"`.
- Se calcula al normalizar (`normalizeClassFeature`, `normalizeSubclassFeature`) con una función pura `featureActivation(entries: unknown): Activation | undefined` en `lib/rules/import/activation.ts`:
  - recorre el texto plano de las entradas (las etiquetas `{@variantrule Bonus Action|XPHB}`, `{@action Magic|XPHB}`… se reducen a su texto) y busca, en este orden: «as a Bonus Action» / «take a Bonus Action» / «Bonus Action to» → `bonus`; «Reaction» precedido de «take a», «use your», «as a» o «can use» → `reaction`; «Magic action», «as an action», «take an action», «the {@action Attack} action» precedido de «take» → `action`;
  - sin coincidencia → `undefined` (pasivo).
- Correcciones: `ACTIVATION_OVERRIDES: Record<string, Activation | null>` en el mismo archivo, por clave del catálogo (`classFeature:<nombre>|<clase>|xphb|<nivel>`); `null` fuerza «pasivo». Se rellena revisando la salida de todos los rasgos XPHB (un script de comprobación en el plan) y corrigiendo los fallos evidentes; la lista y el motivo de cada corrección quedan comentados.
- README («Despliegue»): reimportar para ver los rasgos y las acciones básicas en Acciones.

### 2.2 Acciones básicas

- Nuevo tipo de entrada del catálogo `action` con `ActionData = { time: "action" | "bonus" | "reaction" | "free" | "varies" }` desde `actions.json` de 5etools (fuente XPHB): Atacar, Correr, Destrabarse, Esquivar, Ponerse o quitarse un escudo, Terminar la concentración, Escapar de un agarre, Ayudar, Esconderse, Improvisar, Influir, Magia, Ataque de oportunidad, Preparar, Buscar, Estudiar, Combate con dos armas, Usar.
- Nombres en español en `lib/rules/i18n/es.json` (`action:<nombre>|xphb`), con la traducción del Manual 2024.
- Icono: mapa `ACTION_ICONS: Record<string, string>` de la clave a un archivo de `dark/actions` (`attack`, `dash`, `disengage`, `dodge`, `help`, `hide`, `ready-action`, `search`, `use-shield`, `escape`, `opportunity-attack`, `offhand-attack`, `quick-interaction` para Usar, `cast-spell` para Magia, `improvise`, `communicate` para Influir, `concentration` para Terminar la concentración; Estudiar usa `search`). Sin icono → ninguno.

## 3. Cálculo (`lib/rules/dnd2024/derive/actions.ts`, puro)

`deriveActions(input): ActionsSummary`, con:

```ts
type ActionGroup = "action" | "bonus" | "reaction" | "other";
type ActionItem =
  | { kind: "attack"; group: "action"; attack: Attack }                         // armas
  | { kind: "spell"; group: ActionGroup; ref: Ref; name: string; level: number;
      range: string; hit: string | null; damage: string | null; damageTypeId: string | null; notes: string }
  | { kind: "feature"; group: Exclude<ActionGroup, "other">; ref: Ref; name: string; source: string }
  | { kind: "basic"; group: ActionGroup; ref: Ref; name: string; icon: string | null };
type ActionsSummary = { attacksPerAction: number; items: ActionItem[] };
```

- **Armas**: los `Attack` que ya calcula `derive`, en `action`.
- **Conjuros utilizables**: trucos, preparados, siempre preparados y los de especie, legado y dotes (los mismos que la pestaña Conjuros considera lanzables hoy; en el Mago, los preparados de su libro, no todo el libro). Grupo por `SpellData.time`: empieza por «1 acción adicional» → `bonus`; «1 reacción» → `reaction`; «1 acción» → `action`; cualquier otro → `other`. `hit`: «+N» si tiene ataque de conjuro (etiqueta «Ataque de conjuro»), «CD N {Car}» si pide salvación; `damage` y `damageTypeId` del primer «Daño de …» de sus etiquetas (dados desde el texto si el catálogo los tiene; si no, solo el tipo).
- **Rasgos**: los rasgos de clase y subclase que el personaje tiene a su nivel con `activation`, en ese grupo; `source` = «{Clase}» o «{Subclase}».
- **Básicas**: las entradas `action` del catálogo de los libros del personaje, por `time` (`free` y `varies` → `other`).
- `attacksPerAction`: 1, o 2 con Ataque adicional (cualquier clase), 3 con «Two Extra Attacks» y 4 con «Three Extra Attacks» del Guerrero.
- Orden dentro de cada grupo: armas, conjuros (por nivel y nombre), rasgos (por nivel), básicas (por nombre).

## 4. Pestaña Acciones

- Filtros (chips) arriba: **Todo · Ataques · Acción · Acción adicional · Reacción · Otras**. «Ataques» muestra solo la tabla de ataques (armas y conjuros con `hit`).
- Secciones, en este orden, solo si tienen algo:
  - **Acciones** · «Ataques por acción: N»: la tabla de ataques (armas y conjuros de 1 acción con `hit`), con las columnas de la fase anterior (Ataque, Alcance, Golpe/CD, Daño, Notas); debajo, los conjuros de 1 acción sin tirada (nombre, nivel, alcance, notas); los rasgos; y **«Acciones en combate»**: los nombres de las básicas separados por comas.
  - **Acciones adicionales**, **Reacciones**, **Otras**: igual, sin tabla si no hay ataques; en cada una, «Acciones en combate» si tiene básicas (Combate con dos armas, Ataque de oportunidad…).
- Cada conjuro abre su ficha (la de la pestaña Conjuros, `?spell=`). Cada rasgo se despliega con su descripción (`<details>`, como en Rasgos). Cada acción básica abre un diálogo con su icono, nombre y texto (el `StatDialog` con `children`, como Defensas).
- El estado del filtro va en la URL (`?tab=acciones&filtro=bonus`) para poder enlazarlo; por defecto, Todo.
- Responsive: en móvil los chips se desplazan en horizontal dentro de su fila; la tabla se desplaza dentro de su caja.

## 5. Pruebas

- vitest `featureActivation`: textos reales de 5etools (Second Wind → bonus, Action Surge → ninguno salvo corrección, Arcane Recovery → ninguno, Rage → bonus, Uncanny Dodge → reaction, Channel Divinity → action si aplica) y que las correcciones ganan.
- vitest `deriveActions`: agrupado de conjuros por tiempo, solo utilizables (un conjuro del libro no preparado no sale), rasgos pasivos fuera, básicas por tiempo, `attacksPerAction` 1/2/3/4, orden.
- vitest de la normalización de `action` (tiempo y nombre).
- En verde: vitest, `tsc`, `eslint`; `next build` al final.
- Navegador (con permiso para reimportar en Atlas): un Mago y un Guerrero de prueba propios (borrados al terminar), filtros, diálogos de acciones básicas con icono, fichas de conjuro y rasgos desplegables; 375 px sin desbordes.
