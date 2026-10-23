# Ficha de personaje (parte 3) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ficha completa con pestañas en `/characters/[id]`, inventario real con equipar/monedas/peso, ataques y CA calculados, PG editables, página de edición y borrado — sobre la hoja v2 con historial de niveles.

**Architecture:** La hoja pasa a `version: 2` (`levels[]` + `inventory`) con una función pura `upgradeSheet` que también usa el script de migración. `derive` se divide en módulos (`derive/*.ts`) y recorre `levels[]` e `inventory`. Las ediciones rápidas van por rutas `PATCH` pequeñas con funciones puras `apply*` probadas en vitest; la página carga las entradas del catálogo en lote en el servidor.

**Tech Stack:** Next.js 16.3 (app router, sin Cache Components), React 19, Mongoose 9, Tailwind 4, lucide-react, vitest, tsx.

**Spec:** `docs/superpowers/specs/2026-10-23-ficha-personaje-design.md` (y §2 y §5 de `2026-10-23-subir-nivel-design.md`, que este plan adelanta).

## Global Constraints

- Antes de usar cualquier API de Next, leer su guía en `node_modules/next/dist/docs/` (`AGENTS.md`).
- Interfaz y errores en español; nombres de reglas `nameEs ?? name`; velocidades «30 pies (9 m)»; pesos en lb y kg.
- Estilo: tokens de `app/globals.css` (`surface`, `panel`, `line`, `fg`, `muted`, `brand`, `brand-soft`, `success`), `formStyles`, animaciones `animate-fade-up`/`animate-fade-in`/`animate-pop`; tema oscuro, no el claro de Nivel20.
- Ver: dueño o miembros de la campaña del personaje; resto 404. Escribir: solo dueño; resto 404.
- Rutas de escritura: `sessionOf`, `rateLimit("character_edit", userId, 300, 3600)`, `cleanText`, límites de §2 de la spec (cantidad 0–9999, monedas 0–9 999 999, nombre de línea ≤ 80, notas ≤ 500, otras posesiones ≤ 5000, ≤ 300 líneas).
- `lib/rules/dnd2024/**` sin imports de Next ni mongoose (puro, probado con vitest).
- Commits: uno por tarea en la rama `feat/ficha-personaje`, con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Ruling: la hoja v2 y su migración (spec parte 4 §2.2 y §5) se implementan en este plan porque la ficha las necesita; el plan de la parte 4 las da por hechas.

## Review Focus

- **Personaje v1 abierto antes de migrar** → la ficha y las rutas lo convierten en memoria con `upgradeSheet` y funcionan igual. Prueba en la Tarea 1.
- **Equipar una segunda armadura o escudo por la API saltándose la interfaz** → el servidor desequipa la anterior. Prueba en la Tarea 3.
- **PG actuales por encima del máximo o negativos** → 400. Prueba en la Tarea 3.
- **Añadir un objeto de un libro que el personaje no puede usar** → 400. Prueba en la Tarea 3.
- **Compañero de campaña intenta escribir** → 404 en todas las rutas. Prueba en la Tarea 3.

---

### Tarea 1: Hoja v2, inventario inicial y migración

**Files:**
- Modify: `lib/rules/dnd2024/sheet.ts` (tipos v2), `lib/rules/dnd2024/validate.ts` (devuelve v2), `app/api/characters/route.ts` (guarda v2), y todos los lectores de `sheet.classes`, que pasan a `sheet.classesSummary` (con `upgradeSheet` para v1): `app/(main)/characters/page.tsx` (búsqueda por `sheet.classesSummary.class.name`), `app/components/characters/CharacterCard.tsx`, `app/(main)/campaigns/[id]/(view)/characters/page.tsx` (localizarlos con `grep -rn "sheet.classes\|classes\[0\]" app lib`)
- Create: `lib/rules/dnd2024/upgrade.ts`, `lib/rules/dnd2024/inventory.ts`, `scripts/migrate-levels.ts` (+ script npm `"migrate:levels": "tsx scripts/migrate-levels.ts"`)
- Test: `tests/dnd2024/upgrade.test.ts`, `tests/dnd2024/inventory.test.ts`

**Interfaces:**
- Produces:
  - `type Choice` y `type LevelEntry` exactamente como en la spec de la parte 4 §2.1 (con `SpellChoice` como `unknown` hasta la parte 5: `{ type: "spells"; source: string; value: unknown }`).
  - `type InventoryItem`, `type Inventory = { items: InventoryItem[]; coins: Coins; other: string }`, `type Coins = { cp; sp; ep; gp; pp }` (spec parte 3 §2).
  - `type Dnd2024SheetV2` = v1 sin `classes`, con `version: 2`, `levels: LevelEntry[]`, `classesSummary: { class: Named; level: number; subclass: Named | null }[]`, `inventory: Inventory`, `prepared: Record<string, Ref[]>` (vacío), `spellbookExtra: Named[]` (vacío), `slotsUsed: Record<string, number>` (vacío). `levels[0]` lleva además `equipment: string` (opción de clase).
  - `type AnySheet = Dnd2024Sheet | Dnd2024SheetV2`.
  - `upgradeSheet(sheet: AnySheet, entries: Map<string, CatalogEntry>): Dnd2024SheetV2` — v2 la devuelve igual; v1: `levels[0] = { n: 1, class, classLevel: 1, hp: { method: "max", value: hitDie }, choices: [{ type: "skills", source: "class:skills", value: classes[0].skills }], equipment: classes[0].equipment }`, `classesSummary`, `inventory = startingInventory(...)`.
  - `startingInventory(choices: { pack: Pack[] }[], entries): Inventory` — despliega `contents`, suma cantidades por `ref`, monedas desde `value` (pc → gp/sp/cp), marca `equipped` la armadura de mayor CA, el primer escudo y todas las armas; nombres `nameEs ?? name ?? displayName`; ids con `new ObjectId().toHexString()` vía parámetro `makeId: () => string`.
  - `summarizeClasses(levels: LevelEntry[]): Dnd2024SheetV2["classesSummary"]`.

- [ ] **Paso 1: Pruebas que fallan**
  - Personaje v1 (Bárbaro A + Acólito A, fixtures de `tests/fixtures/5etools/`) → `levels.length === 1`, `levels[0].hp.value === 12`, `inventory.coins.gp === 23`, hacha a dos manos y 4 hachas de mano equipadas, mochila no equipada, `classesSummary[0].level === 1`.
  - Guerrero opción C → inventario sin objetos, `coins.gp === 155`.
  - Dos líneas del mismo objeto se suman (paquetes con antorchas + antorchas sueltas).
  - `upgradeSheet` sobre una v2 la devuelve sin cambios (idempotente).
- [ ] **Paso 2: Ejecutar** `npx vitest run tests/dnd2024/upgrade.test.ts tests/dnd2024/inventory.test.ts` → FAIL.
- [ ] **Paso 3: Implementar** tipos, `startingInventory`, `upgradeSheet`, `summarizeClasses`; `validateSheet` construye y devuelve v2 (con `upgradeSheet` sobre el resultado v1 actual); `POST /api/characters` guarda v2 cargando las entradas de equipo con `resolveRef`.
- [ ] **Paso 4: Implementar `scripts/migrate-levels.ts`**: carga `.env.local` (`process.loadEnvFile` en try/catch), recorre `Character` con `sheet.version !== 2`, resuelve las entradas necesarias desde el catálogo, guarda `upgradeSheet`; imprime «N personajes convertidos, M ya estaban en v2».
- [ ] **Paso 5: Verificar** pruebas PASS; `npx tsc --noEmit -p .` (salvo `.next/`) y `npx eslint app lib scripts tests` sin errores; `npm run migrate:levels` dos veces → la segunda convierte 0.
- [ ] **Paso 6: Commit** `feat(characters): hoja v2 con historial de niveles e inventario`.

---

### Tarea 2: `derive` v2 por módulos (CA, ataques, PG, peso)

**Files:**
- Create: `lib/rules/dnd2024/derive/index.ts` (`derive`), `derive/abilities.ts`, `derive/hp.ts`, `derive/ac.ts`, `derive/attacks.ts`, `derive/weight.ts`, `derive/features.ts`
- Delete: `lib/rules/dnd2024/derive.ts` (sustituido; reexportar desde `derive/index.ts` para no romper imports)
- Test: `tests/dnd2024/derive.test.ts` (ampliar), `tests/dnd2024/ac.test.ts`, `tests/dnd2024/attacks.test.ts`

**Interfaces:**
- Consumes: `AnySheet`, `upgradeSheet` (Tarea 1).
- Produces:
  - `derive(sheet: AnySheet, entries: Map<string, CatalogEntry>): Derived` — convierte con `upgradeSheet` si hace falta.
  - `Derived` amplía el actual con: `level: number`, `classes: { name: string; level: number; subclass: string | null; ref: Ref }[]`, `saves: { ability: Ability; proficient: boolean; total: number }[]`, `skills: { id: string; ability: Ability; proficiency: 0 | 1 | 2; total: number }[]` (las 18), `languages: string[]`, `attacks: Attack[]`, `weight: { total: number; capacity: number; over: boolean }`, `features: FeatureGroup[]`, `armorWarning: string | null`, `hp: { max: number; current: number; temp: number }`. Se conservan `abilities`, `proficiencyBonus`, `ac`, `initiative`, `speed`, `darkvision`, `missing`.
  - `type Attack = { name: string; bonus: number; damage: string; damageType: string; properties: string[]; mastery: string | null }`.
  - `type FeatureGroup = { title: string; source: "species" | "lineage" | "class" | "subclass" | "feat"; ref: Ref | null; level?: number; features: { ref: Ref; name: string; level: number; value?: string }[] }`.
  - `armorClass(input: { dex: number; con: number; wis: number; armor: ArmorData | null; shield: boolean; unarmored: ("barbarian" | "monk")[] }): number` (en `derive/ac.ts`).
  - `weaponAttack(weapon: ItemData & { name: string }, mods: Record<Ability, number>, profBonus: number, proficient: boolean, mastery: boolean): Attack` (en `derive/attacks.ts`).

- [ ] **Paso 1: Pruebas que fallan**
  - `armorClass`: cota de malla (16, sin DES) → 16; cuero tachonado (12) con DES +4 → 16; intermedia escamas (14, tope 2) con DES +4 → 16; escudo +2; Bárbaro sin armadura DES 2 CON 1 → 13 y con escudo 15; Monje DES 3 SAB 2 → 15 y con escudo → 10 + 3 + 2 = 15 (regla 3 + escudo).
  - `weaponAttack`: hacha a dos manos FUE 17 competente → `bonus === 5`, `damage === "1d12+3"`; estoque (sutil) con FUE 0 y DES 3 → usa DES; arco largo → DES; espada larga versátil → `"1d8+3 / 1d10+3 (dos manos)"`; maestría solo si `mastery === true`.
  - `derive`: sin armas siempre presente (`1+FUE` contundente); Monje nivel 1 usa su dado de Artes marciales (tabla) y la mejor de FUE/DES; peso de la mochila de explorador + hacha; capacidad FUE 15 → 225 (tamaño Grande → 450); `over` cuando se supera; habilidades devuelve 18 con pericia `2`.
  - El caso Elfa Drow Bárbara Acólito existente sigue dando PG 13, CA 13 (ahora sin armadura en el inventario).
- [ ] **Paso 2: Ejecutar** → FAIL.
- [ ] **Paso 3: Implementar** módulos. Competencia de armas: categoría (`simple`/`martial`) o arma concreta en las competencias. Monje: dado de Artes marciales desde la tabla de clase si existe (`data.table`) o `1d6` a nivel 1. Rasgos por clase y nivel desde `ClassData.features` (y subclase) filtrados por nivel de clase; valor de tabla vacío por ahora (la tabla llega en la parte 4).
- [ ] **Paso 4: Ejecutar** → PASS; tsc y eslint limpios.
- [ ] **Paso 5: Commit** `feat(characters): cálculos de la ficha por módulos`.

---

### Tarea 3: Rutas de edición (PG, inventario, datos, borrado)

**Files:**
- Create: `lib/rules/dnd2024/edits.ts` (puras), `app/api/characters/[id]/hp/route.ts`, `app/api/characters/[id]/inventory/route.ts`, `app/api/characters/[id]/route.ts` (`PATCH`, `DELETE`), `lib/characterAccess.ts`
- Test: `tests/dnd2024/edits.test.ts`

**Interfaces:**
- Consumes: tipos y `derive` (Tareas 1–2), `usableBooks`, `resolveRef`.
- Produces:
  - `loadCharacterFor(userId: string, id: string, mode: "read" | "write"): Promise<{ character, sheet: Dnd2024SheetV2, books: string[] } | null>` en `lib/characterAccess.ts` (null = 404; `read` admite miembros de la campaña).
  - `applyHp(sheet, input: unknown, maxHp: number): { ok: true; sheet } | { ok: false; error: string }` (`current` entero 0..maxHp, `temp` 0–9999).
  - `type InventoryOp` (spec parte 3 §4.1) y `applyInventoryOp(sheet, op: unknown, resolveItem: (ref: Ref) => CatalogEntry | null, makeId: () => string): { ok: true; sheet } | { ok: false; error: string }` — valida límites, `equipped` solo para armas/armaduras/escudos, una armadura y un escudo equipados (equipar otra desequipa la anterior), `ref` resuelto (si `resolveItem` devuelve null → «Ese objeto no está disponible para este personaje.»).
  - `PATCH /api/characters/[id]/hp` → `{ hp }`; `PATCH /api/characters/[id]/inventory` → `{ inventory }`; `PATCH /api/characters/[id]` con los campos editables de la spec §3.4 → `{ ok: true }` (imágenes por multipart como el alta); `DELETE /api/characters/[id]` → `{ ok: true }` y borra `portraitId`/`imageId`.

- [ ] **Paso 1: Pruebas que fallan** (`edits.test.ts`):
  - `applyHp`: `current` 14 con máximo 13 → error; −1 → error; `temp` 3 → ok.
  - `applyInventoryOp`: `add` con ref válido → línea nueva con `quantity`; `add` con ref no disponible → error; `add` personalizado (`name`) → `ref: null`; `update` equipped de una segunda armadura → la primera queda `equipped: false`; `equipped` en una mochila → error; `quantity` 10000 → error; `remove` de id inexistente → error; `coins` negativas → error; `other` de 5001 caracteres → error; 301 líneas → error.
- [ ] **Paso 2: Ejecutar** → FAIL.
- [ ] **Paso 3: Implementar** funciones puras y rutas (rutas: `loadCharacterFor(..., "write")` → 404 si null; `rateLimit`; `resolveItem` con `resolveRef` sobre los libros del personaje (`books` vacío = `usableBooks` de su sistema y campaña); guardar y devolver).
- [ ] **Paso 4: Ejecutar** → PASS; tsc/eslint limpios.
- [ ] **Paso 5: Commit** `feat(characters): edición de PG, inventario y datos del personaje`.

---

### Tarea 4: Ficha con pestañas (Información, Trasfondo, Rasgos)

**Files:**
- Modify: `app/(main)/characters/[id]/page.tsx` (servidor: acceso, carga en lote, pestaña por `?tab=`)
- Create: `lib/rules/dnd2024/sheetEntries.ts` (`loadSheetEntries`), `app/components/characters/sheet/SheetHeader.tsx`, `SheetTabs.tsx`, `InfoTab.tsx`, `BackgroundTab.tsx`, `FeaturesTab.tsx`, `HpEditor.tsx` (cliente), `StatusBadge.tsx`
- Modify: `app/globals.css` (`@media print`: ocultar navegación y botones, mostrar todas las pestañas)

**Interfaces:**
- Consumes: `derive`, `loadCharacterFor`, `PATCH .../hp`.
- Produces: `loadSheetEntries(sheet: Dnd2024SheetV2, books: string[]): Promise<Map<string, CatalogEntry>>` — resuelve en lote especie, legado, trasfondo, dote de origen, clases, subclases, sus rasgos y los objetos del inventario (una consulta `BookEntry.find({ $or: [{book, key}…] })` por lote de 200).

- [ ] **Paso 1: Implementar** la página según la spec §3.2–3.3: cabecera (retrato + `StatusBadge` con tooltip, nombre, «Especie (Legado) Clase N / Clase M», campaña, «Nivel T»; botones del dueño **Subir de nivel** (enlace a `/characters/[id]/level-up`, oculto a nivel 20; la página llega en la parte 4), **Editar**, **Imprimir**); pestañas `info`, `trasfondo`, `rasgos`, `equipo`, `conjuros` (esta última oculta por ahora) en `?tab=`; Información con características, valores (PG con `HpEditor` para el dueño), salvaciones, 18 habilidades con marca de competencia/pericia, Ataques (de `derive.attacks`), Otras competencias; Trasfondo; Rasgos con `FeatureGroup` plegables (primero abierto); aviso descartable `?saved=1` → «Cambios guardados».
- [ ] **Paso 2: Verificar** tsc/eslint limpios; en el navegador integrado (con la sesión del usuario): la ficha de los personajes de prueba muestra las 5 secciones; el DM/compañero ve sin controles; `?tab=rasgos` abre la pestaña; impresión con `window.print()` muestra todo; móvil 375 px sin desbordes.
- [ ] **Paso 3: Commit** `feat(characters): ficha con pestañas`.

---

### Tarea 5: Pestaña Equipo

**Files:**
- Create: `app/components/characters/sheet/EquipmentTab.tsx` (cliente), `app/components/characters/sheet/AddItemDialog.tsx`
- Modify: `app/(main)/characters/[id]/page.tsx` (montar la pestaña con inventario, pesos y competencias)

**Interfaces:**
- Consumes: `PATCH .../inventory` (Tarea 3), `RuleSelect` (remoto con `GET /api/rules/entries?kind=item&system=…&campaign=…&books=…&q=`), `derive.weight`, `derive.armorWarning`.

- [ ] **Paso 1: Implementar** según la spec §4.1: tabla (nombre con enlace a la ficha del objeto si tiene `ref`, cantidad editable, peso unitario/total, casilla Equipado solo para armas/armaduras/escudos, notas, quitar), **Añadir** (diálogo: catálogo o personalizado), monedas (5 campos + total en po), peso frente a capacidad con aviso, aviso «Sin competencia con esta armadura», **Otras posesiones**. Actualización optimista y vuelta atrás si la respuesta no es 200; tras cada cambio `router.refresh()` para recalcular CA y ataques.
- [ ] **Paso 2: Verificar** en el navegador: añadir cota de malla y equiparla → CA 16 y desequipa la armadura anterior; equipar estoque → aparece en Ataques; monedas; superar la capacidad muestra el aviso; vista del DM sin controles.
- [ ] **Paso 3: Commit** `feat(characters): pestaña de equipo`.

---

### Tarea 6: Editar y borrar personaje

**Files:**
- Create: `app/(main)/characters/[id]/edit/page.tsx`, `app/components/characters/CharacterEditForm.tsx`, `app/components/characters/DeleteCharacter.tsx`
- Modify: `app/components/characters/CharacterCreator.tsx` (extraer `InfoFields` y `ImageFields` reutilizables a `app/components/characters/fields/` si no lo están)

**Interfaces:**
- Consumes: `PATCH`/`DELETE /api/characters/[id]` (Tarea 3).

- [ ] **Paso 1: Implementar** la página (solo dueño; otros 404): nombre, estado, retrato, imagen, alineamiento, edad, apariencia, idiomas, historia, notas y PX; **Guardar** → vuelve a la ficha con `?saved=1`. **Borrar personaje** con confirmación escribiendo el nombre (como `DeleteCampaign`) → `/characters`.
- [ ] **Paso 2: Verificar** tsc/eslint limpios; en el navegador editar estado y retrato y ver la ficha; borrar un personaje de prueba.
- [ ] **Paso 3: Commit** `feat(characters): editar y borrar personaje`.

---

### Tarea 7: Verificación de extremo a extremo

- [ ] **Paso 1:** `npm run migrate:levels` en la base local (los 4 personajes de prueba) → «4 convertidos»; segunda vez → 0.
- [ ] **Paso 2:** `npx vitest run`, `npx tsc --noEmit -p .`, `npx eslint app lib scripts tests` limpios.
- [ ] **Paso 3:** en el navegador integrado con la sesión del usuario: ficha de los 4 personajes (valores iguales a antes de migrar: Nyx PG 13 CA 13; Borin PG 13 CA 16; Elara PG 7; Kael PG 8 CA 16), cada pestaña, inventario (añadir/equipar/quitar/monedas), PG actuales, editar, impresión, móvil.
- [ ] **Paso 4:** informar al usuario de lo verificado y de lo que no se pudo verificar.
