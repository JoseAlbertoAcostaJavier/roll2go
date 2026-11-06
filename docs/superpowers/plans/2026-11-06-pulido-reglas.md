# Pulido de reglas — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Contadores de los rasgos de especie, usos del conjuro del Gnomo del bosque, idioma adicional del Pícaro por multiclase y dados de curación de los conjuros.

**Architecture:** Reglas puras en `lib/rules`: una tabla propia de contadores por especie y dos campos nuevos importados de 5etools (`SpellGrant.uses`, `SpellData.healing`). La UI (Rasgos, Acciones, Conjuros, subida de nivel) consume lo derivado.

**Tech Stack:** Next.js 16.3, React, TypeScript, Tailwind 4, vitest.

**Spec:** `docs/superpowers/specs/2026-11-06-pulido-reglas-design.md`

## Global Constraints

- Rama `feat/pulido-reglas` (ya creada); un commit por tarea; mensajes en español con `Co-Authored-By`. Sin push.
- Regla de capas: `lib/rules` sin `lib/server`, `lib/models`, mongoose ni next; `app/components/**` sin `lib/server`.
- En verde en cada commit: `npx vitest run`, `npx tsc --noEmit`, `npx eslint app lib tests scripts`. `next build` lo ejecuta el controlador.
- No reimportar a Atlas ni tocar `public/assets/icons/light/`. La reimportación la decide el usuario al final.
- Textos exactos: los nombres de contador de la tabla de la Tarea 1, «Curación», «Jerga de ladrones: elige 1 idioma.».
- Sin desplazamiento horizontal a 375 px; impresión sin controles.

## Review Focus

- Catálogo aún sin reimportar (sin `uses` ni `healing`): el conjuro sigue con 1 uso y la curación sin dados, sin errores (Tareas 2 y 3).
- Hoja de Orco con usos guardados en la clave antigua: Aguante incansable los conserva (Tarea 1).
- Personaje que baja de nivel con un uso gastado de Forma grande: el contador desaparece y no molesta; al volver a nivel 5, el valor se recorta al máximo (Tarea 1).
- Visitante: ve los contadores con su nombre, sin poder marcarlos (Tarea 1).
- El Pícaro por multiclase no ve «Jerga de ladrones» entre las opciones del asistente, y el servidor tampoco la acepta (Tarea 4).

---

### Task 1: Contadores de especie

**Files:**
- Modify: `lib/rules/dnd2024/derive/featureUses.ts`, `lib/rules/dnd2024/derive/actions.ts`
- Modify: `app/components/characters/sheet/FeaturesTab.tsx`, `app/components/characters/sheet/FeatureUsesControl.tsx`
- Test: `tests/dnd2024/derive/featureUses.test.ts`, `tests/dnd2024/derive/actions.test.ts`, `tests/server/status.test.ts`, `tests/server/rest.test.ts`

**Interfaces:**
- Produces: `FeatureUse` gana `owner?: string` (refKey de la especie) y `activation?: "action" | "bonus"`.
- Produces: `SPECIES_USES: Record<string, { id: string | null; name: string; max: string; recovery: Recovery; fromLevel?: number; activation?: "action" | "bonus" }[]>`, indexada por `ref.key` de la especie. Sustituye a la entrada `"species:orc|xphb"` de `USES`.

Tabla, en este orden (`PB` = `"@prof"`, `SR` = `{ long: "all", short: "all" }`, `LR` = `LONG`):

| `ref.key` | `id` | `name` | `max` | `recovery` | `fromLevel` | `activation` |
|---|---|---|---|---|---|---|
| `species:dragonborn\|xphb` | `breath-weapon` | Arma de aliento | PB | LR | | |
| | `draconic-flight` | Vuelo dracónico | 1 | LR | 5 | bonus |
| `species:orc\|xphb` | `adrenaline-rush` | Oleada de adrenalina | PB | SR | | bonus |
| | `null` | Aguante incansable | 1 | LR | | |
| `species:goliath\|xphb` | `giant-ancestry` | Ancestro gigante | PB | LR | | |
| | `large-form` | Forma grande | 1 | LR | 5 | bonus |
| `species:aasimar\|xphb` | `healing-hands` | Manos sanadoras | 1 | LR | | action |
| | `celestial-revelation` | Revelación celestial | 1 | LR | 3 | bonus |
| `species:dwarf\|xphb` | `stonecunning` | Sentido de la piedra | PB | LR | | bonus |

Clave del uso: `refKey(ref)` si `id` es `null`; si no, `` `${refKey(ref)}#${id}` ``. `fromLevel` se compara con `sheet.levels.length`.

- [ ] **Step 1: Pruebas que fallan** en `featureUses.test.ts`:
  - Orco con competencia +2: `[Oleada de adrenalina (max 2, short "all", key …species:orc|xphb#adrenaline-rush, activation "bonus"), Aguante incansable (max 1, short "none", key …species:orc|xphb)]`. Actualizar la prueba existente de la línea 120, que esperaba solo Aguante.
  - Goliat a nivel 4: sin Forma grande. A nivel 5: con ella.
  - Dracónido a nivel 4 y 5 (Vuelo dracónico); Aasimar a nivel 2 y 3 (Revelación celestial); Enano con competencia +3: Sentido de la piedra, max 3.
  - Hoja de Orco con `featureUses: { "…species:orc|xphb": 1 }`: Aguante incansable `used` 1.
  - Goliat a nivel 5 con Forma grande usada 3: `used` 1.
- [ ] **Step 2: Más pruebas que fallan:**
  - `actions.test.ts`: con los dos usos del Orco, dos ítems `feature`: Oleada en el grupo `bonus` con `special: false`; Aguante en `other` con `special: true`.
  - `rest.test.ts`: un descanso corto borra `…#adrenaline-rush` y conserva la clave de Aguante incansable.
  - `status.test.ts`: `featureUse` acepta `…#adrenaline-rush` y sigue rechazando `…#nada`.
- [ ] **Step 3:** ejecutar → FAIL.
- [ ] **Step 4: Implementar `featureUses`:** si `SPECIES_USES[f.ref.key]` existe, añade un uso por fila vigente y pasa al siguiente rasgo.
- [ ] **Step 5: Implementar `actions.ts`:** por cada candidato, los usos con `key === refKey(ref)` u `owner === refKey(ref)`; un ítem por uso, con `name: uso.name`, `group: uso.activation ?? f.activation ?? "other"` y `special: !(uso.activation ?? f.activation)`.
- [ ] **Step 6: Implementar la UI:**
  - `FeatureUsesControl`: prop `showName?: boolean` que muestra `use.name` antes de las casillas (también en la línea de impresión).
  - `FeaturesTab`: en los grupos sin rasgos propios, un control por cada uso de la especie (mismo criterio que Step 5), con `showName`, uno debajo de otro.
- [ ] **Step 7:** vitest, tsc y eslint en verde.
- [ ] **Step 8: Commit** `feat(ficha): contadores de los rasgos de especie`

### Task 2: Usos del conjuro del Gnomo del bosque

**Files:**
- Modify: `lib/rules/types.ts`, `lib/rules/schemas.ts` (`spellGrant`), `lib/rules/import/normalize.ts` (`blockGrants`, exportada para probarla)
- Modify: `lib/rules/dnd2024/derive/spells.ts`, `lib/rules/dnd2024/spells/spellTable.ts`, `lib/rules/dnd2024/spells/spellOps.ts`, `lib/server/characters/sheetEdits.ts`
- Test: `tests/rules/importSpells.test.ts` (nuevo), `tests/dnd2024/spells/spellTable.test.ts`, la prueba existente de `spellOps`

**Interfaces:**
- Produces: `SpellGrant.uses?: "pb"`; `OtherSpell.uses?: "pb"`; `SpellOpCtx.proficiencyBonus?: number`.
- Produces: `innateMax(uses: "pb" | undefined, proficiencyBonus: number | undefined): number` en `derive/spells.ts`: el bonificador si `uses === "pb"` y se conoce; si no, 1.

- [ ] **Step 1: Pruebas que fallan:**
  - `blockGrants([{ innate: { "3": { daily: { pb: ["speak with animals|xphb"] } } }, ability: { choose: ["int", "wis", "cha"] }, known: { "1": ["minor illusion|xphb#c"] } }])`: el conjuro de nivel 3 con `uses: "pb"`, el truco de nivel 1 sin `uses`.
  - Un bloque con `daily: { "1": [...] }`: sin `uses`.
  - `usableSpells`: un `OtherSpell` nivel 1 innato con `uses: "pb"` y competencia +3 → `limited.max` 3; sin `uses` → 1; sin `casting` → 1.
  - `applySpellOp`, op `limited`: con `uses: "pb"` y `proficiencyBonus: 3`, acepta `used` 3 y rechaza 4.
- [ ] **Step 2:** ejecutar → FAIL.
- [ ] **Step 3: Implementar:**
  - `blockGrants`: en el grupo `innate`, marca con `uses: "pb"` las cadenas de `value.daily.pb`.
  - `addGrants` copia `uses` a `OtherSpell`.
  - `usableSpells` (línea 96) e `innateUses` en `spellOps` (línea 65) usan `innateMax`.
  - `sheetEdits` pasa `proficiencyBonus` de `derive(...)`.
- [ ] **Step 4:** vitest, tsc y eslint en verde.
- [ ] **Step 5: Commit** `feat(conjuros): usos por competencia en conjuros de legado`

### Task 3: Dados de curación

**Files:**
- Modify: `lib/rules/types.ts`, `lib/rules/schemas.ts`, `lib/rules/import/normalize.ts` (`spellHealing`, exportada)
- Modify: `lib/rules/dnd2024/spells/spellTable.ts`, `lib/rules/dnd2024/derive/actions.ts`, `app/components/characters/sheet/ActionsTab.tsx`
- Test: `tests/rules/importSpells.test.ts`, `tests/dnd2024/spells/spellTable.test.ts`, `tests/dnd2024/derive/actions.test.ts`

**Interfaces:**
- Produces: `SpellData.healing?: { dice: string }`; el `ActionItem` de conjuro gana `healing?: true`.
- Produces: `spellHealing(raw: Rec): SpellData["healing"]` con la expresión `/\b(?:regains?|restore)\b[^."]*\{@dice\s+([^}|]+)/` sobre `JSON.stringify([raw.entries])`; `undefined` si el texto tiene `{@damage`.

- [ ] **Step 1: Pruebas que fallan:**
  - `spellHealing` con el texto de cada conjuro de la spec §5, copiado de `5etools-src/data/spells/spells-xphb.json` a la prueba: Curar heridas «2d8», Palabra de curación «2d4», Curar heridas en masa «5d8», Palabra de curación en masa «2d4», Plegaria de curación «2d8», Regenerar «4d8 + 15», Aura de vitalidad «2d6».
  - `undefined` en Festín de héroes, Reencarnar, Conjurar celestial y Deseo.
  - Tabla de Conjuros: con `healing: { dice: "2d8" }`, `effect` = `{ damageTypeId: null, label: "2d8 Curación" }`.
  - `deriveActions`: el mismo conjuro → `damage: "2d8"`, `healing: true`, `damageTypeId: null`, y va a la tabla como los de daño. Sin `healing` en los datos: como hoy.
- [ ] **Step 2:** ejecutar → FAIL.
- [ ] **Step 3: Implementar:**
  - `spellHealing` y su campo en el resultado de `normalize` y en el esquema.
  - `spellTable`: `healing` gana sobre el efecto de las etiquetas.
  - `actions.ts`: `damage: spellDamageAt(...) ?? data.healing?.dice ?? null`.
  - `ActionsTab` (línea 109): con `r.healing`, muestra los dados y «Curación», sin icono.
  - Si `actions.ts` decide tabla o lista por `damage`/`hit`, no hace falta tocarlo; si no, incluye la curación en la condición.
- [ ] **Step 4:** vitest, tsc y eslint en verde.
- [ ] **Step 5: Commit** `feat(conjuros): dados de curación en Conjuros y Acciones`

### Task 4: Idioma del Pícaro por multiclase

**Files:**
- Modify: `lib/rules/dnd2024/creation/languages.ts`, `lib/rules/dnd2024/levels/pendingChoices.ts`, `lib/rules/dnd2024/levels/validateLevel.ts`, `app/components/characters/levelup/LevelUpWizard.tsx`
- Test: `tests/dnd2024/levels/pendingChoices.test.ts`, `tests/dnd2024/levels/validateLevel.test.ts`

**Interfaces:**
- Produces: `ROGUE_LANGUAGES_SOURCE = "languages:rogue"`.
- Produces: `knownLanguagesAt(sheet: Pick<Dnd2024SheetV2, "levels" | "languageChoices">, classLevels: ClassLevels, classRef: Ref, newClassLevel: number): string[]`: `fixedLanguages({ ...classLevels, [bareName(classRef.key)]: newClassLevel })` más `chosenLanguageRefs(sheet)` en claves. Sustituye al cálculo repetido en `validateLevel` (línea 118) y en `LevelUpWizard` (línea 161).

- [ ] **Step 1: Pruebas que fallan:**
  - Hoja con 1 nivel de Guerrero, Pícaro nivel 1: `{ type: "languages", source: "languages:rogue", count: 1, label: "Jerga de ladrones: elige 1 idioma." }`.
  - `{ levels: [] }` con Pícaro nivel 1: sin esa elección.
  - Pícaro nivel 2: sin esa elección.
  - `opts.languages` sin ningún idioma libre: sin esa elección.
  - `validateLevel`: Guerrero que entra en Pícaro eligiendo «Jerga de ladrones» → error «Ya conoces ese idioma.»; eligiendo Élfico → la entrada lleva la elección y `chosenLanguageRefs` la incluye.
  - Sin cambios: «Explorador hábil» sigue pasando sus pruebas (`languages:ranger`).
- [ ] **Step 2:** ejecutar → FAIL.
- [ ] **Step 3: Implementar:**
  - En `pendingChoices`, junto a los idiomas de Explorador y con el mismo formato de etiqueta: si `newClassLevel === 1 && sheet.levels.length > 0`, toma de `languageSlots` el hueco `rogue` y aplica `capSlots` igual.
  - `validateLevel` y `LevelUpWizard` usan `knownLanguagesAt`.
- [ ] **Step 4:** vitest, tsc y eslint en verde.
- [ ] **Step 5: Commit** `feat(niveles): idioma adicional del Pícaro por multiclase`

### Task 5: Comprobación (controlador)

- [ ] `next build` con el servidor de desarrollo parado.
- [ ] Navegador, antes de reimportar, con personajes de prueba propios: Orco (dos contadores en Rasgos y Acciones; descanso corto) y Guerrero de nivel 1 que sube a Pícaro (pide idioma; Jerga de ladrones no aparece); 375 px.
- [ ] Pedir permiso al usuario para reimportar. Con su sí: `--dry-run`, reimportar, borrar `.next/dev/cache/fetch-cache`, reiniciar, y comprobar Gnomo del bosque de nivel 3 o más y Clérigo con Curar heridas.
- [ ] Borrar los personajes de prueba y restaurar el borrador del creador.
