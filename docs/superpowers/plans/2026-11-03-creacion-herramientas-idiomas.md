# Creación: objetos a elegir e idiomas nativos — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El equipo inicial con «un juego/instrumento/herramientas/arma (a elegir)» se elige de un selector y llega al inventario como objeto del catálogo; los idiomas se eligen (Común + 2 estándar, Jerga de ladrones, Druídico, Explorador hábil) en vez de escribirse.

**Architecture:** El importador marca los `Pack` a elegir; la validación de la creación acepta picks e idiomas; reglas puras de idiomas; el creador y el asistente de subida de nivel muestran los selectores; la ficha lista los idiomas desde la hoja.

**Tech Stack:** Next.js 16.3, React, TypeScript, Tailwind 4, vitest.

**Spec:** `docs/superpowers/specs/2026-11-03-creacion-herramientas-idiomas-design.md`

## Global Constraints

- Rama `feat/creacion-idiomas` desde `main`; un commit por tarea; mensajes en español con `Co-Authored-By`. Sin push.
- Regla de capas: `lib/rules` sin `lib/server`, `lib/models`, mongoose ni next; `app/components/**` sin `lib/server`.
- En verde en cada commit: `npx vitest run`, `npx tsc --noEmit`, `npx eslint app lib tests scripts`. `next build` lo ejecuta el controlador.
- Textos exactos: «Falta elegir: {etiqueta}.», «Ese objeto no vale para {etiqueta}.», «Idiomas», «Idiomas de origen», «Jerga de ladrones», «Explorador hábil», «Explorador hábil: elige 2 idiomas.», «Elige idiomas estándar para tus idiomas de origen.», «Ya conoces ese idioma.», «Faltan idiomas por elegir.».
- Personajes y borradores antiguos siguen funcionando: `languages` de texto se muestra tal cual; un `Pack` sin `choose` o sin pick se trata como hoy.

## Review Focus

- Borrador del creador guardado antes del cambio (con `languages` de texto y sin picks): abre sin error y pide lo que falta (Task 4).
- Catálogo sin reimportar (`Pack` sin `choose`): el creador no pide picks y el inventario sale como hoy (Task 2 y 4).
- Cambiar la opción de equipo (A → B) en el creador borra los picks de la opción anterior y no los envía (Task 4).
- Multiclase Pícaro/Druida: dos idiomas fijos y un hueco del Pícaro; añadir Druida al subir de nivel añade Druídico sin pedir nada (Task 3).
- Borrar el nivel 2 de Explorador quita sus 2 idiomas; volver a subirlo los vuelve a pedir (Task 5).

---

### Task 1: Objetos a elegir en el catálogo

**Files:**
- Modify: `lib/rules/types.ts` (`ChoiceKind = "gaming" | "instrument" | "artisan" | "simple" | "simpleMelee" | "martial" | "martialMelee"`; `Pack.choose?: { kinds: ChoiceKind[]; label: string }`)
- Modify: `lib/rules/import/normalize.ts` (`toPack`), `lib/rules/schemas.ts`
- Modify: `README.md` («Despliegue»: «Tras desplegar la elección de objetos e idiomas: vuelve a ejecutar `npm run import:5etools -- --data <carpeta data de 5etools>` y reinicia el servidor tras borrar la caché de datos de Next.»)
- Test: `tests/rules/normalize.test.ts`, `tests/rules/schemas.test.ts`

**Interfaces:**
- Produces: `Pack.choose`; `choiceMatches(kind: ChoiceKind, data: ItemData): boolean` en `lib/rules/dnd2024/sheet/equipmentRefs.ts` (`gaming` → `type` `GS`; `instrument` → `INS`; `artisan` → `AT`; `simple`/`martial` → `weapon.category` `simple`/`martial`; `*Melee` además `type` `M`).

- [ ] **Step 1: Pruebas que fallan:** `{ equipmentType: "setGaming" }` → `{ choose: { kinds: ["gaming"], label: "Un juego (a elegir)" }, displayName: "Un juego (a elegir)" }`; `{ equipmentTypes: ["instrumentMusical", "toolArtisan"] }` → `kinds: ["instrument", "artisan"]` y la etiqueta compuesta de hoy; `weaponSimple` → `["simple"]`; `focusSpellcastingArcane` → sin `choose` (solo `displayName`); `choiceMatches` para cada tipo; el esquema acepta `choose` y rechaza `kinds: ["zzz"]`.
- [ ] **Step 2:** `npx vitest run tests/rules tests/dnd2024/sheet` → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** verde.
- [ ] **Step 5: Commit** `feat(catálogo): objetos a elegir en el equipo inicial`

### Task 2: Picks del equipo en la creación y el inventario inicial

**Files:**
- Modify: `lib/rules/dnd2024/sheet/sheet.ts` (`equipmentPicks?: Record<string, Ref>` en el trasfondo y en la primera clase de la hoja de creación — donde vive hoy `equipment: "A"`)
- Modify: `lib/rules/dnd2024/creation/validateSheet.ts` (valida picks de la opción elegida)
- Modify: `lib/rules/dnd2024/sheet/inventory.ts` (`startingInventory(choices: { pack: Pack[]; picks?: Record<string, Ref> }[], …)`) y `lib/rules/dnd2024/sheet/upgrade.ts` (pasa los picks)
- Modify: `lib/rules/dnd2024/sheet/equipmentRefs.ts` (`loadEquipmentEntries` carga también las refs elegidas)
- Test: `tests/dnd2024/creation/validateSheet.test.ts` (o el existente de creación), `tests/dnd2024/sheet/inventory.test.ts`

**Interfaces:**
- Consumes: `Pack.choose`, `choiceMatches` (Task 1).
- Produces: picks por índice de `Pack` (texto) en `background.equipmentPicks` y `classes[0].equipmentPicks`.

- [ ] **Step 1: Pruebas que fallan:** Soldado A sin pick → error en `background.equipmentPicks` «Falta elegir: Un juego (a elegir).»; con un objeto que no es `GS` → «Ese objeto no vale para Un juego (a elegir).»; con pick en un índice sin `choose` → «Petición no válida.»; con «dice set» (`GS`) → válido; `startingInventory` del Soldado con el pick → línea con `ref` del juego (suelta, no en la mochila) en vez de la de texto; sin pick o sin `choose` → línea de texto como hoy.
- [ ] **Step 2:** ejecutar → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** verde.
- [ ] **Step 5: Commit** `feat(creación): elegir el juego, instrumento o arma del equipo inicial`

### Task 3: Reglas de idiomas

**Files:**
- Create: `lib/rules/dnd2024/creation/languages.ts`
- Modify: `lib/rules/dnd2024/sheet/sheet.ts` (`languageChoices?: Ref[]` en la hoja de creación y en la v2)
- Modify: `lib/rules/dnd2024/creation/validateSheet.ts` (idiomas de origen y del Pícaro), `lib/rules/dnd2024/sheet/upgrade.ts` (copia `languageChoices`)
- Modify: `lib/rules/dnd2024/derive/index.ts` (`Derived.languages`: nombres en español de fijos + elegidos, y los de `languages` de texto si los hay)
- Test: `tests/dnd2024/creation/languages.test.ts`

**Interfaces:**
- Produces:
  - `fixedLanguages(classLevels: Record<string, number>): string[]` — claves desnudas: `language:common|xphb` siempre; `language:thieves' cant|xphb` con Pícaro ≥1; `language:druidic|xphb` con Druida ≥1.
  - `export type LanguageSlot = { source: "origin" | "rogue" | "ranger"; label: string; count: number; standardOnly: boolean }`; `languageSlots(classLevels): LanguageSlot[]` — `origin` («Idiomas de origen», 2, `standardOnly`); `rogue` («Jerga de ladrones», 1) con Pícaro ≥1; `ranger` («Explorador hábil», 2) con Explorador ≥2.
  - `checkLanguages(picks: Ref[], slots: LanguageSlot[], fixed: string[], lookup: (ref) => CatalogEntry | null): string | null` — `picks` en el orden de los huecos; errores de Global Constraints.

- [ ] **Step 1: Pruebas que fallan:** Humano Mago 1 → fijos `[common]`, huecos `[origin 2]`; Pícaro 1 → `[common, thieves' cant]`, `[origin 2, rogue 1]`; Druida 1 → `[common, druidic]`; Explorador 1 → sin `ranger`, Explorador 2 → con `ranger 2`; Pícaro 1/Druida 1 → los tres fijos; `checkLanguages` con 2 estándar → null; con Celestial en origen → «Elige idiomas estándar para tus idiomas de origen.»; con Común elegido o repetido → «Ya conoces ese idioma.»; con uno de menos → «Faltan idiomas por elegir.»; validación de la creación guarda `languageChoices`; `derive` lista «Común, Élfico, Enano» y añade el texto antiguo.
- [ ] **Step 2:** ejecutar → FAIL.
- [ ] **Step 3:** implementar (nombres en español desde el catálogo, `nameEs ?? name`).
- [ ] **Step 4:** verde.
- [ ] **Step 5: Commit** `feat(creación): idiomas de origen, Jerga de ladrones y Druídico`

### Task 4: Creador (picks e idiomas)

**Files:**
- Modify: `app/components/characters/creator/CharacterCreator.tsx` (selector por `Pack` con `choose` de la opción elegida, con objetos del catálogo filtrados con `choiceMatches`; sección «Idiomas» con chips fijos y selectores por hueco; fuera la caja «Idiomas» de «Información»; borrador: picks e idiomas en el estado guardado, compatibilidad con borradores antiguos; al cambiar de opción o de clase se limpian los picks e idiomas que ya no valen)
- Modify: `app/components/characters/creator/CharacterSummary.tsx` si muestra idiomas o equipo
- Modify: `app/api/...` o el cargador de opciones del catálogo que use el creador (para listar idiomas e ítems a elegir), siguiendo cómo `AddItemDialog`/`RuleSelect` piden opciones hoy
- Modify: `lib/rules/dnd2024/creation/recreate.ts` (Recrear conserva picks e idiomas)

**Interfaces:**
- Consumes: Tasks 1–3.
- [ ] **Step 1:** implementar; vitest, tsc y eslint en verde.
- [ ] **Step 2: Commit** `feat(creación): selectores de objetos a elegir e idiomas en el creador`

### Task 5: Idiomas del Explorador al subir de nivel

**Files:**
- Modify: `lib/rules/dnd2024/levels/pendingChoices.ts` (elección `{ type: "languages", source: "languages:ranger", count: 2, label: "Explorador hábil: elige 2 idiomas." }` al llegar a Explorador 2)
- Modify: `lib/rules/dnd2024/levels/validateLevel.ts` y `levelOps.ts` (valida con `checkLanguages`; añade a `languageChoices`; borrar el nivel los quita)
- Modify: `app/components/characters/levelup/LevelUpWizard.tsx` (paso con 2 selectores de idioma)
- Test: tests de niveles existentes (`tests/dnd2024/levels/*`)

**Interfaces:**
- Consumes: `languageSlots`, `checkLanguages` (Task 3).
- [ ] **Step 1: Pruebas que fallan:** Explorador 1 → 2 pide la elección; con 2 idiomas válidos se añaden; repetido → «Ya conoces ese idioma.»; borrar el nivel 2 los quita; Guerrero 1 → 2 no pide idiomas.
- [ ] **Step 2:** ejecutar → FAIL.
- [ ] **Step 3:** implementar (UI incluida).
- [ ] **Step 4:** verde.
- [ ] **Step 5: Commit** `feat(niveles): idiomas de Explorador hábil`

### Task 6: Comprobación (controlador)

- [ ] `next build` con el servidor de desarrollo parado.
- [ ] Pedir permiso y reimportar (`--dry-run` primero); borrar `.next/dev/cache/fetch-cache` y reiniciar.
- [ ] Navegador: guardar el borrador del creador; crear Soldado (juego en el inventario), Pícaro (Jerga de ladrones + idioma) y Explorador que sube a 2 (idiomas); «Elara Prueba» con sus idiomas de texto; 375 px; borrar los personajes y restaurar el borrador.
