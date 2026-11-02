# Rasgos, Trasfondo y Notas — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rasgos y Trasfondo con filtros y secciones al estilo de D&D Beyond, pestaña Notas nueva y campos de trasfondo y notas editables en la propia pestaña.

**Architecture:** Campos de texto opcionales en la hoja, guardados por la ruta de edición existente; agrupado y filtros como funciones puras en `lib/rules/dnd2024/sheet/` con pruebas; la UI solo pinta y llama a la ruta.

**Tech Stack:** Next.js 16.3, React, TypeScript, Tailwind 4, vitest.

**Spec:** `docs/superpowers/specs/2026-11-02-rasgos-trasfondo-notas-design.md`

## Global Constraints

- Rama `feat/rasgos-trasfondo` desde `main`; un commit por tarea; mensajes en español con `Co-Authored-By`. Sin push.
- Interfaz y comentarios en español; identidad de Roll2Go (`card`, `cardTitle`, chips como `ActionsFilters`).
- Regla de capas: `lib/rules` sin `lib/server`, `lib/models`, mongoose ni next; `app/components/**` sin `lib/server`.
- En verde en cada commit: `npx vitest run`, `npx tsc --noEmit`, `npx eslint app lib tests scripts`. `next build` lo ejecuta el controlador.
- Límites (spec §2): `gender`, `eyes`, `hair`, `skin`, `height`, `weight`, `faith` 100; `personality`, `ideals`, `bonds`, `flaws` 2000; `organizations`, `allies`, `enemies` 5000; `notes` 10000 (sin cambios).
- Textos exactos: chips «Todo · Rasgos de clase · Rasgos de especie · Dotes» y «Todo · Trasfondo · Características · Aspecto»; secciones «Rasgos de clase», «Rasgos de especie», «Dotes», «Trasfondo», «Características», «Aspecto», «Organizaciones», «Aliados», «Enemigos», «Otras notas»; «+ Añadir {label en minúsculas}», «Ver más» / «Ver menos», «Editar {label}», «Máximo N caracteres.».

## Review Focus

- Hoja antigua sin los campos nuevos: se muestran vacíos y se pueden añadir (Task 1 prueba que la edición los acepta en una hoja sin ellos).
- Creador: no pide ni acepta los campos nuevos (Task 1).
- `?seccion=` desconocida o repetida (array) → `todo` (Task 2).
- Visitante no dueño: sin botones de edición; Notas oculta si todo está vacío (Task 4).
- Guardar un campo con solo espacios lo deja vacío y vuelve a «+ Añadir …» (Task 1 prueba el `trim`; Task 4 lo pinta).

---

### Task 1: Campos nuevos y su guardado

**Files:**
- Modify: `lib/rules/dnd2024/sheet/sheet.ts` (`Dnd2024SheetV2`: campos opcionales `gender?`, `eyes?`, `hair?`, `skin?`, `height?`, `weight?`, `faith?`, `personality?`, `ideals?`, `bonds?`, `flaws?`, `organizations?`, `allies?`, `enemies?`: `string`)
- Modify: `lib/rules/dnd2024/creation/validateSheet.ts` (exportar `SHEET_TEXT_LIMITS = { ...TEXT_LIMITS, gender: 100, … }`; `TEXT_LIMITS` sin cambios para el creador)
- Modify: `lib/server/characters/editCharacter.ts` (recorrer `SHEET_TEXT_LIMITS` en lugar de `TEXT_LIMITS`)
- Test: `tests/server/characters.test.ts` (bloque «alta y edición»)

**Interfaces:**
- Produces: `SHEET_TEXT_LIMITS: Record<SheetTextField, number>` y `type SheetTextField = keyof typeof SHEET_TEXT_LIMITS`; los campos nuevos de la hoja.

- [ ] **Step 1: Pruebas que fallan:** `updateCharacter` con `FormData` `gender=" Mujer "` → guarda `sheet.gender: "Mujer"` en una hoja que no lo tenía; `allies` de 5001 caracteres → error `allies: "Máximo 5000 caracteres."`; `personality="   "` → guarda `""`; crear un personaje con `gender` en la hoja del creador no lo guarda (o `validateSheet` lo ignora).
- [ ] **Step 2:** `npx vitest run tests/server/characters.test.ts` → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** verde (vitest, tsc, eslint).
- [ ] **Step 5: Commit** `feat(ficha): campos de trasfondo y notas en la hoja`

### Task 2: Secciones y filtros (puros)

**Files:**
- Create: `lib/rules/dnd2024/sheet/sheetSections.ts`
- Test: `tests/dnd2024/sheet/sheetSections.test.ts`

**Interfaces:**
- Consumes: `FeatureGroup` (`lib/rules/dnd2024/derive/features.ts`).
- Produces:
  - `type FeatureSection = "todo" | "clase" | "especie" | "dotes"`; `FEATURE_SECTION_CHIPS: { id: FeatureSection; label: string }[]` (labels de Global Constraints).
  - `featureSections(groups: FeatureGroup[], section: FeatureSection): { id: Exclude<FeatureSection, "todo">; title: string; groups: FeatureGroup[] }[]` — `clase` = `class|subclass|option`, `especie` = `species|lineage`, `dotes` = `feat`; en ese orden, sin vacías, conservando el orden de los grupos.
  - `type BackgroundSection = "todo" | "trasfondo" | "caracteristicas" | "aspecto"`; `BACKGROUND_SECTION_CHIPS`.
  - `parseSection<T extends string>(raw: unknown, ids: readonly T[]): T` (array → primer valor; desconocido → `"todo"`).
  - `sectionHref(query: Query, section: string): string` — `?tab=…` con `seccion` (omitido si `todo`), conserva el resto y quita `saved` y `spell` (como `actionFilterHref`).

- [ ] **Step 1: Pruebas que fallan:** grupos `[species, class, subclass, option, feat, lineage]` con `todo` → `["clase", "especie", "dotes"]` y en `clase` los grupos `class, subclass, option`; `especie` → solo esa sección; sin dotes → sin sección `dotes`; `parseSection("x", ids)` y `parseSection(["dotes","clase"], ids)` → `"todo"` y `"dotes"`; `sectionHref({ tab: "rasgos", seccion: "clase", saved: "1" }, "todo")` → `"?tab=rasgos"`.
- [ ] **Step 2:** ejecutar → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** verde.
- [ ] **Step 5: Commit** `feat(ficha): secciones y filtros de Rasgos y Trasfondo`

### Task 3: Pestaña Rasgos y dotes

**Files:**
- Modify: `app/components/characters/sheet/FeaturesTab.tsx` (chips + secciones; reutiliza `GroupHeading`, `Description`)
- Create: `app/components/characters/sheet/SectionChips.tsx` (chips genéricos `{ chips, active, query }` con `sectionHref`, reutilizados en Task 4) y `ClampedText.tsx` (recorte a ~8 líneas con degradado y «Ver más»/«Ver menos», `aria-expanded`; sin recorte al imprimir)
- Modify: `app/(main)/characters/[id]/page.tsx` (pasar `query` a `FeaturesTab`)

**Interfaces:**
- Consumes: Task 2.
- Spec §3: título de sección en `text-brand-soft` mayúsculas; cada rasgo con nombre, `· Nivel N`, `value` y `chosen`; descripción abierta en `ClampedText`; «Descripción» plegada de clase/subclase se mantiene. Lo que el filtro oculta sigue en el DOM con `hidden print:block`.

- [ ] **Step 1:** implementar; vitest, tsc y eslint en verde.
- [ ] **Step 2: Commit** `feat(ficha): Rasgos y dotes por secciones con filtros`

### Task 4: Trasfondo, Notas y edición en la pestaña

**Files:**
- Create: `app/components/characters/sheet/InlineText.tsx` (`InlineText` e `InlineSelect`, spec §6)
- Modify: `app/components/characters/sheet/BackgroundTab.tsx` (chips + secciones Trasfondo / Características / Aspecto, spec §4)
- Create: `app/components/characters/sheet/NotesTab.tsx` (spec §5)
- Modify: `lib/rules/dnd2024/sheet/sheetTabs.ts` (`SheetTabId` gana `"notas"`), `app/components/characters/sheet/SheetTabs.tsx` (pestaña «Notas», icono de lucide `NotebookPen`), `app/(main)/characters/[id]/page.tsx` (`notas` en las pestañas: siempre para el dueño, para los demás solo si alguna nota tiene texto; pasar `isOwner`, `characterId`, `query`)
- Test: `tests/dnd2024/sheet/sheetTabs.test.ts` (si existe; si no, crear) — `normalizeSheetTab("notas", […, "notas"])` → `"notas"` y sin ella → `"acciones"`

**Interfaces:**
- Consumes: Task 1 (campos, `SHEET_TEXT_LIMITS` para `max`), Task 2 (`BACKGROUND_SECTION_CHIPS`, `parseSection`), Task 3 (`SectionChips`).
- `InlineText({ characterId, field: SheetTextField, label, value, multiline?, editable })`: `max = SHEET_TEXT_LIMITS[field]`; `FormData` `{ [field]: value }` a `PATCH /api/characters/${characterId}`; error del campo de la respuesta (`errors[field]` o `error`) bajo el campo con `role="alert"`; éxito → `router.refresh()`. Enter guarda en `input`; en `textarea`, Ctrl/Cmd+Enter; blur guarda; Escape cancela y devuelve el foco al botón.
- Alineamiento: `InlineSelect` con `ALIGNMENTS` (y «—» vacío). Tamaño: `sizeName(sheet.speciesChoices.size ?? …)`, solo lectura.

- [ ] **Step 1:** prueba de `normalizeSheetTab` → FAIL; implementar; vitest, tsc y eslint en verde.
- [ ] **Step 2: Commit** `feat(ficha): Trasfondo con características editables y pestaña Notas`

### Task 5: Comprobación (controlador)

- [ ] `next build` con el servidor de desarrollo parado (borrar `.next/dev/cache/fetch-cache` al reiniciar).
- [ ] Navegador: «Elara Prueba» en solo lectura (chips de Rasgos y Trasfondo, `?seccion=` raro, «Ver más», Notas); personaje de prueba propio: añadir, cambiar, vaciar con espacios, cancelar con Escape, error por límite, alineamiento; borrar al terminar; 375 px sin desbordes.
