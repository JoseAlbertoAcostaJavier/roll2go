# Usos y acciones — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cuadrados de uso para espacios y rasgos (Furia, Recuperación arcana…), guardados en la hoja y recuperados con los descansos; lista de acciones limpia; dados de daño de los conjuros e iconos de escuela.

**Architecture:** El importador añade `id` a las columnas de la tabla de clase y `damage` a los conjuros; un módulo puro calcula los usos (Foundry + tabla propia) dentro de `derive`; la ruta de estado y los descansos los guardan y recuperan; la UI usa un componente de cuadrados común.

**Tech Stack:** Next.js 16.3, React, TypeScript, Tailwind 4, vitest.

**Spec:** `docs/superpowers/specs/2026-11-03-usos-y-acciones-design.md`

## Global Constraints

- Rama `feat/usos-acciones` desde `main`; un commit por tarea; mensajes en español con `Co-Authored-By`. Sin push.
- Regla de capas: `lib/rules` sin `lib/server`, `lib/models`, mongoose ni next; `app/components/**` sin `lib/server`.
- En verde en cada commit: `npx vitest run`, `npx tsc --noEmit`, `npx eslint app lib tests scripts`. `next build` lo ejecuta el controlador.
- Textos exactos: «/ Descanso largo», «/ Descanso corto», «(Especial)», «Ese rasgo no tiene usos.», «Los usos van de 0 a N.» (N = máximo), «Petición no válida.».
- Cuadrados: hueco = disponible, marcado (fondo de marca con ✓) = gastado; más de 10 usos → «n / máx» con − y +. Impresión: «disponibles/máx · Descanso largo» en texto.
- Sin `eval` ni `Function` para las fórmulas. Sin desplazamiento horizontal a 375 px.

## Review Focus

- Hoja antigua sin `featureUses`: todo disponible y los descansos no fallan (Task 3).
- Rasgo con fórmula desconocida (`@scale.psi-warrior.die.number`) o sin entrada en el catálogo: sin contador y sin error (Task 2).
- Usados guardados por encima del máximo actual (tras borrar un nivel): se muestran recortados y la op acepta volver a 0 (Task 2 y 3).
- Dos clics rápidos en cuadrados: el segundo no pisa el primero (Task 3, `unchangedFilter` como el resto de ops de estado; Task 4, una petición a la vez como `InspirationBox`).
- Personaje multiclase: `@classes.<clase>.levels` y `@scale.<clase>.*` usan el nivel en esa clase, no el total (Task 2).

---

### Task 1: Datos del catálogo (columnas con id y daño de conjuros)

**Files:**
- Modify: `lib/rules/types.ts` (`ClassTable.columns[]` gana `id: string`; `SpellData.damage?: { dice: string; scaling?: { level: number; dice: string }[] }`)
- Modify: `lib/rules/schemas.ts`, `lib/rules/import/normalize.ts` (`classTable`, `normalizeSpell`)
- Modify: `README.md` («Despliegue»: «Tras desplegar los usos y acciones: vuelve a ejecutar `npm run import:5etools -- --data <carpeta data de 5etools>` y reinicia el servidor tras borrar la caché de datos de Next (`.next/cache` en producción, `.next/dev/cache` en desarrollo).»)
- Test: `tests/rules/normalize.test.ts`, `tests/rules/schemas.test.ts`

**Interfaces:**
- Produces: `ClassTable.columns[i].id` = etiqueta inglesa original sin etiquetas de 5etools, en minúsculas, espacios → «-» (`Rages` → `rages`, `Channel Divinity` → `channel-divinity`, espacios de conjuro → `slots-<n>`); `SpellData.damage`.

- [ ] **Step 1: Pruebas que fallan:**
  - `classTable` de una tabla con `colLabels: ["Rages", "Rage Damage", "Weapon Mastery"]` → ids `rages`, `rage-damage`, `weapon-mastery` (la `label` sigue traducida como hoy).
  - Descarga de fuego (`scalingLevelDice: { label: "damage", scaling: { "1": "1d10", "5": "2d10", "11": "3d10", "17": "4d10" } }`) → `damage: { dice: "1d10", scaling: [{ level: 1, dice: "1d10" }, { level: 5, dice: "2d10" }, …] }`. `scalingLevelDice` también puede ser un array: se usa el primero.
  - Manos ardientes (nivel 1, texto con `{@damage 3d6}`) → `damage: { dice: "3d6" }`; conjuro sin `{@damage}` ni `scalingLevelDice` → sin `damage`.
  - El esquema acepta y valida `damage` y `id`.
- [ ] **Step 2:** `npx vitest run tests/rules` → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** verde.
- [ ] **Step 5: Commit** `feat(catálogo): id de columnas de clase y daño de los conjuros`

### Task 2: Cálculo de usos de rasgos

**Files:**
- Create: `lib/rules/dnd2024/derive/usesFormula.ts` (evaluador)
- Create: `lib/rules/dnd2024/derive/featureUses.ts` (`USES`, `featureUses`)
- Modify: `lib/rules/dnd2024/sheet/sheet.ts` (`featureUses?: Record<string, number>`)
- Modify: `lib/rules/dnd2024/derive/index.ts` (`Derived.featureUses: FeatureUse[]`)
- Test: `tests/dnd2024/derive/usesFormula.test.ts`, `tests/dnd2024/derive/featureUses.test.ts`

**Interfaces:**
- Consumes: `ClassTable.columns[].id` (Task 1), `FeatureGroup` (`derive/features.ts`), `entry.foundry` (catálogo).
- Produces:
  - `export type UsesVars = { prof: number; mods: Record<Ability, number>; classLevels: Record<string, number>; scale: (cls: string, column: string) => number | null }`.
  - `evalUses(formula: string, vars: UsesVars): number | null` — `null` si hay algo desconocido; resultado `Math.floor`.
  - `export type Recovery = { long: "all"; short: "all" | "none" | number }`; `export type FeatureUse = { key: string; name: string; max: number; used: number; recovery: Recovery }`.
  - `featureUses(sheet: Dnd2024SheetV2, entries: Map<string, CatalogEntry>, groups: FeatureGroup[], vars: UsesVars): FeatureUse[]` — un elemento por rasgo con usos (clave `refKey`, sin duplicados), `used = min(sheet.featureUses?.[key] ?? 0, max)`; `max < 1` o fórmula desconocida → fuera.
  - `USES: Record<string, { max?: string; recovery?: Recovery; shortFrom?: { level: number } }>` con clave = clave del rasgo sin libro (`classFeature:rage|barbarian|xphb|1`, la que use el catálogo): las entradas de la spec §2. Inspiración bárdica: `short: "none"` y `shortFrom: { level: 5 }` (desde Bardo 5, `short: "all"`).
  - `Derived.featureUses`.

- [ ] **Step 1: Pruebas que fallan:**
  - `evalUses`: `"@prof"` con prof 3 → 3; `"max(1,@abilities.cha.mod)"` con car −1 → 1; `"(2 * @classes.wizard.levels) + @abilities.int.mod"` mago 3, int +3 → 9; `"@scale.barbarian.rages"` con escala 3 → 3; `"@scale.psi-warrior.die.number"` sin escala → null; `"1; drop table"` → null.
  - `featureUses`: Bárbaro 1 del fixture → Furia `{ max: 2, used: 0, recovery: { long: "all", short: 1 } }`; con `sheet.featureUses` de Furia 5 → `used: 2`; rasgo con recuperación de Foundry `[{ period: "sr", type: "recoverAll" }]` → `short: "all"`; con `{ period: "sr", type: "formula", formula: "1" }` → `short: 1`; Bardo 1 → Inspiración bárdica `short: "none"`, Bardo 5 → `short: "all"`; multiclase Bárbaro 3 / Guerrero 1 → la escala de Furia usa el nivel 3.
- [ ] **Step 2:** `npx vitest run tests/dnd2024/derive` → FAIL.
- [ ] **Step 3:** implementar (parser recursivo propio: números, `@ruta`, `+ - * /`, paréntesis, `max`, `min`, `floor`).
- [ ] **Step 4:** verde.
- [ ] **Step 5: Commit** `feat(ficha): usos de los rasgos desde Foundry y tabla propia`

### Task 3: Guardar usos y recuperarlos al descansar

**Files:**
- Modify: `lib/rules/dnd2024/sheet/status.ts` (op `featureUse`; `applyStatus(sheet, op, ctx?: { useMax: (key: string) => number | null })`; `statusOf` incluye `featureUses`)
- Modify: `lib/rules/dnd2024/sheet/rest.ts` (`RestCtx.featureUses: FeatureUse[]`; largo → todos 0; corto → `short`)
- Modify: `lib/server/characters/sheetEdits.ts` (`applyStatusOperation` pasa `useMax` de `derive(...).featureUses`; `STATUS_FIELDS.featureUse = "featureUses"`; `applyRestOperation` pasa `featureUses` y `featureUses` entra en `REST_FIELDS`)
- Test: `tests/dnd2024/sheet/status.test.ts`, `tests/dnd2024/sheet/rest.test.ts`, `tests/server/status.test.ts`

**Interfaces:**
- Consumes: `FeatureUse`, `Derived.featureUses` (Task 2).
- Produces: `StatusOp` gana `{ op: "featureUse"; key: string; used: number }`; `statusOf(sheet).featureUses: Record<string, number>`.

- [ ] **Step 1: Pruebas que fallan:**
  - `applyStatus` con `featureUse` Furia `used: 1` (máx 2) → `featureUses["…rage…"] = 1`; `used: 3` → «Los usos van de 0 a 2.»; `-1` o `1.5` → el mismo error; clave sin usos (`useMax` → null) → «Ese rasgo no tiene usos.»; sin `ctx` → «Ese rasgo no tiene usos.».
  - Descanso largo con Furia 2 usadas y Recuperación arcana 1 → ambas 0; corto → Furia 1, Recuperación arcana 1; Oleada de acción (`short: "all"`) 1 → 0; hoja sin `featureUses` → los descansos funcionan y no crean el campo vacío innecesariamente.
  - Servicio: el dueño marca un uso y se guarda; otro usuario falla; uso fuera de rango → 400.
- [ ] **Step 2:** ejecutar → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** verde.
- [ ] **Step 5: Commit** `feat(ficha): marcar usos de rasgos y recuperarlos al descansar`

### Task 4: Cuadrados y lista de acciones

**Files:**
- Create: `app/components/characters/sheet/UseBoxes.tsx` (cuadrados genéricos: `count`, `used`, `onSet(used) | null`, `busy`, `label` accesible; >10 → «n / máx» con − y +)
- Create: `app/components/characters/sheet/FeatureUsesControl.tsx` (cliente: `UseBoxes` + «/ Descanso largo|corto», PATCH `featureUse`, una petición a la vez y `router.refresh()` en transición, vuelta atrás si falla, como `InspirationBox`)
- Modify: `app/components/characters/spells/SpellSlotBoxes.tsx` (usa `UseBoxes`: misma API para `SlotsBar` y `SpellTable`, nueva convención hueco = libre)
- Modify: `lib/rules/dnd2024/derive/actions.ts` (`ActionsInput.featureUses`; los ítems `feature` llevan `uses?: FeatureUse` y `special: boolean`; rasgos con usos de especie, linaje, dote o sin activación de acción/adicional/reacción → grupo `other`; `group` del tipo `feature` admite `other`)
- Modify: `app/components/characters/sheet/ActionsTab.tsx` (fila limpia: nombre como botón que abre la descripción en el diálogo de `ActionsDialogs`, «(Especial)», origen, `FeatureUsesControl` debajo; fuera el `<details>` largo)
- Modify: `app/components/characters/sheet/ActionsDialogs.tsx` (diálogo de rasgo con su descripción, como el de las acciones básicas)
- Modify: `app/components/characters/sheet/FeaturesTab.tsx` (los rasgos con usos muestran `FeatureUsesControl`)
- Modify: `app/(main)/characters/[id]/page.tsx` lo justo para pasar `d.featureUses`, `characterId` e `isOwner`
- Test: `tests/dnd2024/derive/actions.test.ts` (o el existente de acciones)

**Interfaces:**
- Consumes: Tasks 2–3.
- [ ] **Step 1: Pruebas que fallan** (`actionsSummary`): Furia del Bárbaro en `bonus` con `uses.max` 2; Aguante incansable (especie con usos) en `other`; un rasgo sin usos ni activación no aparece (como hoy).
- [ ] **Step 2:** implementar la UI; vitest, tsc y eslint en verde.
- [ ] **Step 3: Commit** `feat(ficha): cuadrados de uso y lista de acciones limpia`

### Task 5: Daño de conjuros e iconos de escuela

**Files:**
- Modify: `lib/rules/dnd2024/spells/spellTable.ts` (función `spellDamageAt(data: SpellData, level: number): string | null` — trucos: el último escalón con `level ≤ nivel de personaje`; nivel ≥1: `dice`)
- Modify: `lib/rules/dnd2024/derive/actions.ts` (`damage` de los conjuros con `spellDamageAt` y el nivel total)
- Modify: `app/components/characters/sheet/ActionsTab.tsx`, `app/components/characters/spells/SpellTable.tsx`, `app/components/characters/spells/SpellList.tsx` (icono de la escuela con `iconSrc("darkSchool", school)` donde hoy va `cast-spell` o un icono genérico; si no hay icono, el de hoy)
- Test: `tests/dnd2024/spells/spellTable.test.ts`

**Interfaces:**
- Consumes: `SpellData.damage` (Task 1).
- [ ] **Step 1: Pruebas que fallan:** Descarga de fuego a nivel 1 → «1d10», 5 → «2d10», 17 → «4d10»; Manos ardientes → «3d6»; sin `damage` → null; en `actionsSummary`, Descarga de fuego lleva `damage: "1d10"`.
- [ ] **Step 2:** `npx vitest run tests/dnd2024` → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** verde.
- [ ] **Step 5: Commit** `feat(ficha): dados de daño de los conjuros e iconos de escuela`

### Task 6: Comprobación (controlador)

- [ ] `next build` con el servidor de desarrollo parado.
- [ ] Pedir permiso y reimportar (`--dry-run` primero); borrar `.next/dev/cache/fetch-cache` y reiniciar el servidor.
- [ ] Navegador: Bárbaro de prueba (Furia □□ en Acción adicional, marcar, descanso corto y largo), Mago de prueba (Recuperación arcana, espacios en cuadrados, «1d10» en Descarga de fuego, iconos de escuela); «Elara Prueba» en solo lectura; 375 px; borrar los personajes de prueba.
