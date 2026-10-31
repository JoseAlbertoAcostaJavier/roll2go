# Arreglos del creador y defensas en la ficha — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el creador y la subida de nivel solo ofrezcan lo elegible, no repitan conjuros entre fuentes, no pidan preparar al crear, reinicien las tiradas, y que la ficha muestre resistencias, inmunidades, vulnerabilidades e inmunidades a estados.

**Architecture:** La lógica nueva va en módulos puros de `lib/rules` (filtros de opciones, choque de conjuros, normalización y cálculo de defensas) con sus pruebas en `tests/`; los componentes de `app/components/characters` solo la usan. El servidor reutiliza las mismas funciones al validar.

**Tech Stack:** Next.js 16.3 (app router), React, TypeScript, Tailwind 4, Mongoose 9, vitest.

**Spec:** `docs/superpowers/specs/2026-10-31-arreglos-creador-design.md`

## Global Constraints

- Rama `fix/arreglos-creador` desde `main`; un commit por tarea; mensajes en español con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sin push.
- Interfaz y comentarios en español, con el estilo y la densidad de comentarios del código que rodea.
- Regla de capas (ESLint): `lib/rules` no importa `lib/server`, `lib/models`, mongoose ni next; `app/components/**` no importa `lib/server`.
- «En verde» en cada commit: `npx vitest run`, `npx tsc --noEmit` (ignorar `.next/`), `npx eslint app lib tests scripts`, y en la última tarea de código `npx next build`.
- Antes de usar una API de Next, leer `node_modules/next/dist/docs/`.
- Tipos de daño y estados se guardan en minúsculas e inglés, como 5etools (`"poison"`, `"frightened"`); se muestran en español.
- Pruebas en el navegador solo con personajes de prueba propios, borrados al terminar; restaurar los borradores del creador. No iniciar sesión: si el panel está sin sesión, pedírselo al usuario.

## Review Focus

- Un borrador antiguo del creador con `prepared` y `rolls` debe cargar sin error (Task 4 lo prueba en `parseDraft`).
- Una invocación con requisito de pacto **y** de nivel (p. ej. nivel 5 + Pacto del filo) a nivel 1 debe ocultarse, no salir desactivada por el pacto (Task 1).
- Un conjuro elegido como sustituto (`replace.in`) en una dote que coincide con otro de otra dote cuenta como choque (Task 2).
- Una especie con `resist: [{ choose }]` sin linaje elegido no debe romper `derive` ni mostrar tipos inventados: sale «a elegir» (Task 7).
- Desequipar un objeto con defensas debe quitar su defensa; un objeto no equipado nunca cuenta (Task 7).

---

### Task 1: Solo conjuros e invocaciones elegibles

**Files:**
- Modify: `lib/rules/dnd2024/spells/spellPicks.ts` (función nueva)
- Modify: `lib/rules/dnd2024/levels/featureChoices.ts` (función nueva)
- Modify: `app/components/characters/levelup/steps/SpellsStep.tsx` (`list`, `item`, `learnCheck`)
- Modify: `app/components/characters/creator/ClassFeaturesSection.tsx:143-162` (caso `optionalFeature`)
- Test: `tests/dnd2024/spells/spellPicks.test.ts`, `tests/dnd2024/levels/featureChoices.test.ts` (nuevo)

**Interfaces:**
- Produces: `classSpellOptions(spells: SpellOption[], o: { listId: string; maxLevel: number; extraLists?: string[]; accepts?: (s: SpellOption) => boolean }): SpellOption[]` — trucos y conjuros de nivel `1..maxLevel` de la lista (o de `extraLists` para nivel ≥ 1, o los que `accepts`), ordenados por nivel y nombre.
- Produces: `optionalFeatureAtLevel(data: OptionalFeatureData, classLevel: number): boolean` — `false` si `data.prerequisite?.level > classLevel`.

- [ ] **Step 1: Pruebas que fallan**

```ts
it("classSpellOptions no incluye conjuros por encima del nivel máximo", () => {
  const keys = classSpellOptions(spells, { listId: "wizard", maxLevel: 1 }).map((s) => s.ref.key);
  expect(keys).toContain("spell:fire bolt|xphb");      // truco
  expect(keys).toContain("spell:magic missile|xphb");  // nivel 1
  expect(keys).not.toContain("spell:misty step|xphb"); // nivel 2
});
it("con Secretos mágicos aplica el mismo tope a las otras listas", () => { /* extraLists: ["cleric"], maxLevel 1: cure wounds sí, aid (2) no */ });
it("optionalFeatureAtLevel", () => {
  expect(optionalFeatureAtLevel({ featureType: ["EI"], prerequisite: { level: 5 } } as OptionalFeatureData, 1)).toBe(false);
  expect(optionalFeatureAtLevel({ featureType: ["EI"], prerequisite: { level: 5, pact: "pact of the blade" } } as OptionalFeatureData, 1)).toBe(false);
  expect(optionalFeatureAtLevel({ featureType: ["EI"], prerequisite: { pact: "pact of the tome" } } as OptionalFeatureData, 1)).toBe(true);
  expect(optionalFeatureAtLevel({ featureType: ["EI"] } as OptionalFeatureData, 1)).toBe(true);
});
```

Construir `spells` con objetos `SpellOption` mínimos (mirar los que ya usa `spellFilters.test.ts`).

- [ ] **Step 2:** `npx vitest run tests/dnd2024/spells/spellPicks.test.ts tests/dnd2024/levels/featureChoices.test.ts` → FAIL (funciones no definidas).
- [ ] **Step 3: Implementar** las dos funciones. En `SpellsStep`, `list` pasa a ser `classSpellOptions(...)`; se quitan `dimmed` de `item` y la rama «Nivel demasiado alto» de `learnCheck`. En `ClassFeaturesSection`, el `.filter` del caso `optionalFeature` añade `optionalFeatureAtLevel(d, ctx.classLevel)` y la rama `Requiere nivel` del `blocked` desaparece (los requisitos de pacto y rasgo se quedan).
- [ ] **Step 4:** las pruebas pasan; vitest, tsc y eslint en verde.
- [ ] **Step 5: Commit** `fix(creador): solo los conjuros e invocaciones que se pueden elegir a ese nivel`

### Task 2: Choque de conjuros dote contra dote (servidor)

**Files:**
- Modify: `lib/rules/dnd2024/spells/featSpells.ts:258-269` (`featSpellClash`)
- Modify: `lib/rules/dnd2024/creation/checkFeatSpells.ts:31-38`, `lib/rules/dnd2024/levels/validateLevel.ts:182-185` (mensajes)
- Test: `tests/dnd2024/creation/validate.test.ts`, `tests/dnd2024/levels/validateLevel.test.ts`

**Interfaces:**
- Produces: `featSpellClash(choices: Choice[]): { source: string; name: string; with: string | null } | null` — `with` es el `source` de la otra elección `featSpells` (dote contra dote) o `null` (dote contra clase). Recorre las `featSpells` en orden; la que repite algo de una anterior (o de la clase) es la que choca.

- [ ] **Step 1: Pruebas que fallan**
  - `featSpellClash` con dos `featSpells` que comparten un truco → `{ source: <segunda>, name, with: <primera> }`.
  - Igual con el repetido como `replace.in` de la segunda.
  - Dote contra clase → `with: null` (la prueba actual de validate sigue pasando).
  - Al subir de nivel con dos dotes que repiten conjuro, el error en `levels.N.choices.<segunda>` es `"{etiqueta}: {conjuro} ya lo eliges con {etiqueta de la primera}."`; al crear, `"Conjuros de {dote}: {conjuro} ya lo eliges con {otra dote}."`. Con la clase, los mensajes actuales («… ya lo eliges con la clase.»).
- [ ] **Step 2:** `npx vitest run tests/dnd2024/creation/validate.test.ts tests/dnd2024/levels/validateLevel.test.ts` → FAIL.
- [ ] **Step 3: Implementar.** La etiqueta de la otra dote sale de `withSpells`/`featPending` por su `source`, como la de la primera.
- [ ] **Step 4:** pasan; vitest, tsc y eslint en verde.
- [ ] **Step 5: Commit** `fix(conjuros): el mismo conjuro no se elige con dos dotes`

### Task 3: El formulario marca los conjuros elegidos en otra fuente

**Files:**
- Modify: `app/components/characters/levelup/steps/SpellsStep.tsx` (prop `granted`, `heldLabel`, origen de la fila)
- Modify: `app/components/characters/levelup/steps/FeatSpellsStep.tsx` (prop `granted`, conjunto `taken`)
- Modify: `app/components/characters/creator/CharacterCreator.tsx` (`grantedSpells` y los dos usos)
- Modify: `app/components/characters/levelup/LevelUpWizard.tsx` (mismo cruce cuando hay `SpellsStep` y `FeatSpellsStep` en el nivel)
- Create: `lib/rules/dnd2024/spells/grantedSpells.ts`
- Test: `tests/dnd2024/spells/grantedSpells.test.ts`

**Interfaces:**
- Produces: `type GrantedSpell = { key: string; label: string | null }` — `label: null` ⇒ «Ya lo tienes»; con texto ⇒ «Ya lo eliges con {label}».
- Produces: `crossSourceGranted(base: string[], picks: { source: string; label: string; keys: string[] }[], except: string): GrantedSpell[]` — `base` (especie, linaje, clase…) con `label: null` más las claves de cada `picks` cuyo `source !== except`, con su `label`. Una clave repetida conserva la primera.
- `SpellsStep` y `FeatSpellsStep`: `granted?: GrantedSpell[]` (antes `string[]`).
- Etiquetas: la clase es `"la clase"`; una dote, su `p.label`.

- [ ] **Step 1: Prueba que falla**

```ts
it("cada fuente ve las demás, no la suya", () => {
  const picks = [
    { source: "class", label: "la clase", keys: ["spell:shocking grasp|xphb"] },
    { source: "featSpells:magic initiate", label: "Iniciado en la magia", keys: ["spell:light|xphb"] },
  ];
  expect(crossSourceGranted(["spell:dancing lights|xphb"], picks, "class")).toEqual([
    { key: "spell:dancing lights|xphb", label: null },
    { key: "spell:light|xphb", label: "Iniciado en la magia" },
  ]);
  expect(crossSourceGranted([], picks, "featSpells:magic initiate")).toEqual([
    { key: "spell:shocking grasp|xphb", label: "la clase" },
  ]);
});
```

- [ ] **Step 2:** `npx vitest run tests/dnd2024/spells/grantedSpells.test.ts` → FAIL.
- [ ] **Step 3: Implementar** la función y pasarla a los componentes. En el creador, `picks` = la clase (`form.spells`: trucos, conjuros y `free`) y cada dote (`form.featSpells[p.source]`: trucos, conjuros y `replace.in`). El motivo de la casilla y la marca de la fila salen de `label`. Un conjuro ya marcado que pasa a estar en otra fuente no se desmarca (lo para el servidor, Task 2).
- [ ] **Step 4:** pasa; vitest, tsc y eslint en verde.
- [ ] **Step 5: Commit** `fix(creador): los conjuros elegidos con la clase o una dote no se ofrecen en otra`

### Task 4: Sin preparar conjuros al crear

**Files:**
- Modify: `app/components/characters/creator/CharacterCreator.tsx` (`FormState.prepared`, `parseDraft`, `casting.preparedLimit`/`always`, línea ~619 `prepared`, props de `SpellsStep`, nota nueva, aviso de rehacer)
- Modify: `lib/rules/dnd2024/creation/validateSheet.ts:305-337` (`initialPrepared` desaparece; `v2.prepared = {}`)
- Modify: `lib/rules/dnd2024/creation/recreate.ts` (si el borrador de rehacer lleva `prepared`, no se rellena)
- Test: `tests/dnd2024/creation/validate.test.ts`, `tests/dnd2024/creation/recreate.test.ts`, `tests/api/createCharacter.test.ts`

**Interfaces:**
- `parseDraft` debe exportarse (o moverse a `lib/rules/dnd2024/creation/recreate.ts` junto a `CreationDraft`) para probarlo; un borrador con `prepared` y `rolls` válidos se lee y `prepared` se ignora.

- [ ] **Step 1: Pruebas que fallan**
  - `validateSheet` con `prepared: { "class:cleric|xphb": [<ref de bless>] }` → `ok: true` y `sheet.prepared` igual a `{}`.
  - El borrador de rehacer (`recreate.ts`) ya no incluye `prepared`.
  - `parseDraft` de un JSON antiguo con `prepared` no falla y el formulario no tiene ese campo.
  - Ajustar las pruebas actuales que esperaban preparados iniciales.
- [ ] **Step 2:** `npx vitest run tests/dnd2024/creation tests/api/createCharacter.test.ts` → FAIL.
- [ ] **Step 3: Implementar.** El creador no pasa `prepared` a `SpellsStep` (la prop sigue existiendo para nadie más: quitarla si ya no tiene usos, junto con `PreparedPick` y el código de preparar de `SpellsStep`). En la sección de conjuros, bajo el título, la nota exacta: `Prepararás tus conjuros desde la pestaña Conjuros de la ficha.`; si no hay nada que elegir (Paladín 1), solo la nota. El aviso de confirmación de rehacer añade que también se vacían los conjuros preparados.
- [ ] **Step 4:** pasan; vitest, tsc y eslint en verde.
- [ ] **Step 5: Commit** `fix(creador): los conjuros se preparan en la ficha, no al crear`

### Task 5: Las tiradas no pasan al siguiente personaje

**Files:**
- Modify: `app/components/characters/creator/CharacterCreator.tsx` (efecto de guardado del borrador, `submit`) y lo que señale el diagnóstico
- Test: el que reproduzca la causa (vitest si es lógica pura; si solo se reproduce en el navegador, documentar los pasos en el commit)

- [ ] **Step 1: Reproducir** con superpowers:systematic-debugging en el navegador (`npm run dev`): «Nuevo personaje» → «Mediante tiradas» → tirar → completar y crear → volver a «Nuevo personaje» por el mismo camino (menú, campaña y sin campaña). Mirar `localStorage` (claves `roll2go:new-character:*`) antes y después de crear. Anotar la causa.
- [ ] **Step 2: Prueba que falla** que reproduzca la causa.
- [ ] **Step 3: Arreglar la causa** y, además, añadir `const submitted = useRef(false)`: se pone a `true` justo antes de `localStorage.removeItem(draftKey)` tras un envío con éxito, y el efecto de guardado no escribe si está a `true`.
- [ ] **Step 4:** pasa; vitest, tsc y eslint en verde; en el navegador, el segundo personaje empieza sin tiradas. Borrar los personajes de prueba.
- [ ] **Step 5: Commit** `fix(creador): cada personaje nuevo empieza sin las tiradas del anterior`

### Task 6: Importar defensas

**Files:**
- Modify: `lib/rules/types.ts` (`Defenses`, campos en `SpeciesData`, `LineageData`, `FeatData`, `ItemData`)
- Modify: `lib/rules/import/normalize.ts` (`normalizeSpecies`, `normalizeLineage`, `normalizeFeat`, `normalizeItem`)
- Modify: `README.md` (sección «Despliegue»: reimportar los libros para ver las defensas)
- Test: `tests/rules/normalize.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type DefenseList = (string | { choose: { from: string[]; count: number } })[];
  export type Defenses = { resist?: DefenseList; immune?: DefenseList; vulnerable?: DefenseList; conditionImmune?: DefenseList };
  ```
  `SpeciesData`, `LineageData`, `FeatData` e `ItemData` ganan `defenses?: Defenses` (solo si hay alguna lista no vacía).
- Produces: `normalizeDefenses(raw: Rec): Defenses | undefined` (exportada) — lee `resist`, `immune`, `vulnerable`, `conditionImmune`; cadenas en minúsculas; `{ choose: { from, count? } }` con `count` 1 por defecto; descarta objetos con `special`, `cond` o listas anidadas condicionales.

- [ ] **Step 1: Pruebas que fallan**
  - `normalizeDefenses({ resist: ["poison"] })` → `{ resist: ["poison"] }`.
  - `normalizeDefenses({ resist: [{ choose: { from: ["acid", "fire"] } }] })` → `{ resist: [{ choose: { from: ["acid", "fire"], count: 1 } }] }`.
  - `normalizeDefenses({ resist: [{ special: "x" }, { resist: ["fire"], note: "while raging", cond: true }] })` → `undefined`.
  - `normalizeDefenses({ conditionImmune: ["Frightened"] })` → `{ conditionImmune: ["frightened"] }`.
  - `normalizeItem({ name: "Ring of Fire Resistance", source: "XDMG", type: "RG", resist: ["fire"] }).data.defenses` → `{ resist: ["fire"] }`; igual para `normalizeFeat` con `choose` `count: 2`.
  - Linaje: la versión del Tiflin con `resist: ["fire"]` da `defenses.resist` `["fire"]` en `normalizeLineage` (raw mínimo en la prueba).
- [ ] **Step 2:** `npx vitest run tests/rules/normalize.test.ts` → FAIL.
- [ ] **Step 3: Implementar** y añadir `defenses` en las cuatro normalizaciones.
- [ ] **Step 4:** pasan; vitest, tsc y eslint en verde.
- [ ] **Step 5: Commit** `feat(catálogo): importar resistencias, inmunidades y vulnerabilidades`

### Task 7: Calcular defensas y equipar objetos con defensas

**Files:**
- Create: `lib/rules/dnd2024/derive/defenses.ts`
- Modify: `lib/rules/dnd2024/derive/index.ts` (`Derived.defenses`)
- Modify: `lib/rules/dnd2024/sheet/edits.ts:51` (`canEquip`) y su mensaje de error
- Modify: `app/(main)/characters/[id]/page.tsx:88` (`equippable`)
- Modify: `lib/rules/dnd2024/sheet/sheet.ts` (`FeatPickValue` gana `resist?: string[]`; comentario de `InventoryItem.equipped`)
- Test: `tests/dnd2024/derive/defenses.test.ts` (nuevo), `tests/dnd2024/sheet/edits.test.ts`

**Interfaces:**
- Consumes: `Defenses` (Task 6).
- Produces:
  ```ts
  export type DefenseKind = "resist" | "immune" | "vulnerable" | "conditionImmune";
  export type DefenseRow = { kind: DefenseKind; type: string | null; sources: string[] };
  ```
  `type: null` ⇒ «a elegir» (un `choose` sin elección). `Derived.defenses: DefenseRow[]`, en el orden resist, immune, vulnerable, conditionImmune y por tipo; un mismo `kind`+`type` de varias fuentes sale una vez con todas.
- Produces: `defensesOf(sources: { name: string; defenses?: Defenses; chosen?: string[] }[]): DefenseRow[]` — `chosen` son los tipos elegidos para los `choose` (dotes).
- En `derive`: fuentes = especie, linaje, dotes (todas las del historial, con `FeatPickValue.resist` como `chosen`) y objetos del inventario **equipados** con catálogo.
- `canEquip(d)` = arma, armadura o `d.defenses`; mensaje: `"Solo se pueden equipar armaduras, escudos, armas y objetos con resistencias o inmunidades."`.

- [ ] **Step 1: Pruebas que fallan**
  - Enano: `[{ kind: "resist", type: "poison", sources: ["Enano"] }]`.
  - Enano + anillo de veneno equipado: una fila con `sources: ["Enano", "Anillo…"]`; el anillo sin equipar no cuenta.
  - Dote con `choose` y `chosen: ["cold", "fire"]` → dos filas; sin `chosen` → una fila `type: null`.
  - Especie con `choose` (Dracónido sin linaje) → `type: null`, sin lanzar.
  - `applyInventoryOp` equipa un objeto con `defenses` y rechaza uno sin nada con el mensaje nuevo.
- [ ] **Step 2:** `npx vitest run tests/dnd2024/derive tests/dnd2024/sheet/edits.test.ts` → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** pasan; vitest, tsc y eslint en verde.
- [ ] **Step 5: Commit** `feat(ficha): calcular las defensas y equipar objetos que las dan`

### Task 8: Elegir el tipo de resistencia de una dote

**Files:**
- Modify: `lib/rules/dnd2024/creation/checkChoices.ts:110` (`checkFeat`) y sus usos en los casos `feat` y `asi`
- Modify: `lib/rules/dnd2024/sheet/sheet.ts` (`Choice` `asi` con `feat`: `resist?: string[]`)
- Modify: `app/components/characters/levelup/state.ts`, `LevelUpWizard.tsx`, `steps/PickStep.tsx`, `steps/AsiStep.tsx` (campo junto a `FeatAbilityField`)
- Create: `app/components/characters/levelup/steps/FeatResistField.tsx`
- Modify: `lib/rules/dnd2024/sheet/labels.ts` (`DAMAGE_TYPE_NAMES`)
- Test: `tests/dnd2024/levels/validateLevel.test.ts`, `tests/dnd2024/sheet/labels.test.ts`

**Interfaces:**
- Consumes: `FeatData.defenses` (Task 6), `FeatPickValue.resist` (Task 7).
- Produces: `checkFeat(e, rawAbility, rawResist): { error: string } | { ability?: Ability; resist?: string[] }` — si la dote tiene un `choose` en `defenses.resist`, `rawResist` debe ser exactamente `count` tipos distintos de `from`; si no, se ignora. Error: `"elige {count} tipos de daño."` / `"tipo de daño no válido."`.
- Produces: `DAMAGE_TYPE_NAMES: Record<string, string>` (`acid: "Ácido"`, `bludgeoning: "Contundente"`, `cold: "Frío"`, `fire: "Fuego"`, `force: "Fuerza"`, `lightning: "Relámpago"`, `necrotic: "Necrótico"`, `piercing: "Perforante"`, `poison: "Veneno"`, `psychic: "Psíquico"`, `radiant: "Radiante"`, `slashing: "Cortante"`, `thunder: "Trueno"`) y `defenseTypeName(kind: DefenseKind, type: string): string` (los estados con la clave `condition:<tipo>` de `lib/rules/i18n`; si falta, el tipo tal cual).
- `FeatResistField({ id, count, from, value, onChange })`: `count` desplegables de tipos de daño sin repetir, en español.

- [ ] **Step 1: Pruebas que fallan**
  - Subir a nivel 19 con Don de resistencia a la energía y `resist: ["cold", "fire"]` → ok y la elección guarda `resist`.
  - Con un solo tipo → error `elige 2 tipos de daño.`; con `"banana"` → `tipo de daño no válido.`.
  - `defenseTypeName("resist", "poison")` → `"Veneno"`; `defenseTypeName("conditionImmune", "frightened")` → `"Asustado"`.
- [ ] **Step 2:** `npx vitest run tests/dnd2024/levels/validateLevel.test.ts tests/dnd2024/sheet/labels.test.ts` → FAIL.
- [ ] **Step 3: Implementar.** El estado del asistente guarda `featResist: Record<string, string[]>` por clave de dote, igual que `featAbility`, y lo manda en el valor de la dote.
- [ ] **Step 4:** pasan; vitest, tsc y eslint en verde.
- [ ] **Step 5: Commit** `feat(niveles): elegir los tipos de resistencia de una dote`

### Task 9: Tarjeta «Defensas» en la pestaña Información

**Files:**
- Modify: `app/components/characters/sheet/StatDialog.tsx` (`breakdown` opcional, `children?: ReactNode` en su lugar)
- Modify: `app/components/characters/sheet/InfoTab.tsx` (tarjeta y `Stat` `{ kind: "defenses" }`)
- Modify: `lib/rules/dnd2024/sheet/statTexts.ts` (`DEFENSES_TEXT`)

**Interfaces:**
- Consumes: `Derived.defenses` (Task 7), `defenseTypeName` (Task 8).
- Grupos y títulos: `Resistencias`, `Inmunidades`, `Vulnerabilidades`, `Inmunidad a estados`; `type: null` se muestra `a elegir`. La tarjeta solo aparece si `d.defenses.length > 0`; es un botón con `aria-haspopup="dialog"` y `data-print="text"`, como las demás. El diálogo (título `Defensas`) lista cada fila como `{tipo} · {fuentes unidas con ", "}`.

- [ ] **Step 1:** implementar; `npx vitest run`, `npx tsc --noEmit`, `npx eslint app lib tests scripts` y `npx next build` en verde.
- [ ] **Step 2: Comprobar en el navegador** con superpowers:verification-before-completion (reimportar antes los libros en local si hace falta, según el README): un Enano con un objeto de resistencia equipado muestra la tarjeta y el desglose; al desequiparlo desaparece el objeto de las fuentes. Repasar también los puntos de la spec §7: Mago Erudito (choque de conjuros marcado en el formulario), Brujo (sin invocaciones de nivel alto), Clérigo por tiradas creado dos veces (sin conjuros de nivel 2, sin preparar, sin tiradas heredadas). Borrar los personajes de prueba y restaurar los borradores.
- [ ] **Step 3: Commit** `feat(ficha): tarjeta de defensas en la pestaña Información`
