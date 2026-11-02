# Tabla de conjuros con búsqueda y filtros — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pestaña Conjuros con cabecera por clase, búsqueda y filtros en la URL, tabla por niveles con espacios y botón Lanzar, y la gestión actual detrás de «Gestionar conjuros».

**Architecture:** Filas, filtros y opciones de lanzamiento son funciones puras en `lib/rules/dnd2024/spells/` con pruebas; la vista (`SpellsTab` y componentes nuevos) solo pinta y llama a la operación `slot` existente.

**Tech Stack:** Next.js 16.3, React, TypeScript, Tailwind 4, vitest.

**Spec:** `docs/superpowers/specs/2026-11-02-conjuros-tabla-design.md`

## Global Constraints

- Rama `feat/conjuros-tabla` desde `main`; un commit por tarea; mensajes en español con `Co-Authored-By`. Sin push.
- Interfaz y comentarios en español; identidad de Roll2Go; iconos `iconSrc("darkSchool")` y `iconSrc("damageType")` con `MaskIcon`.
- Regla de capas: `lib/rules` sin `lib/server`, `lib/models`, mongoose ni next; `app/components/**` sin `lib/server`.
- En verde en cada commit: `npx vitest run`, `npx tsc --noEmit`, `npx eslint app lib tests scripts`. `next build` lo ejecuta el controlador.
- Textos exactos de la spec §3 («Buscar por nombre, daño, estado o tiempo», «Gestionar conjuros», «Ver lista», «Volver a la tabla», «Lanzar como ritual», «Ningún conjuro coincide con la búsqueda.», «Quitar filtros»).
- No reimportar.

## Review Focus

- Personaje sin espacios libres de ningún nivel: el botón Lanzar queda desactivado con el motivo «Sin espacios libres», salvo ritual (Task 2 prueba `castOptions` vacío; Task 4 lo pinta).
- `?nivel=` con valores no numéricos o fuera de 0–9: se ignoran (Task 2).
- Brujo multiclase con pacto y espacios normales: las dos fuentes aparecen en Lanzar (Task 2).
- Visitante no dueño: ve la tabla, sin Lanzar ni casillas editables (Task 4).
- Búsqueda con tildes y mayúsculas («FUEGO», «asúst»): encuentra igual (Task 2).

---

### Task 1: Filas de la tabla

**Files:**
- Create: `lib/rules/dnd2024/spells/spellTable.ts`
- Modify: `lib/rules/dnd2024/derive/actions.ts` (extraer a `spellTable.ts` lo común: conjuros utilizables, `hit`, tipo de daño desde etiquetas; `deriveActions` pasa a usarlo, sin cambiar su resultado)
- Test: `tests/dnd2024/spells/spellTable.test.ts` (y las pruebas de `actions.test.ts` siguen pasando)

**Interfaces:**
- Produces: `SpellRow` exactamente como spec §2.1 y `spellTableRows(spells: SpellsSummary, entries: Map<string, CatalogEntry>): SpellRow[]`; `timeShort(time: string): string`.
- `effect`: primer «Daño de …» (`damageTypeId` + nombre en español), si no primer «Estado: X» (`label` X), si no la primera etiqueta que no sea de salvación, área, ataque, concentración ni ritual; si nada, `null`.
- `limited`: de `LimitedSpell` (`key`, `max`, `used`).

- [ ] **Step 1: Pruebas que fallan:** trucos, preparados y `other` presentes, libro sin preparar ausente; `hit` «+5» para Descarga de fuego y «CD 13 SAB» para Amigos (con el bloque de la prueba); `effect` de Descarga de fuego `{ damageTypeId: "fire", label: "Fuego" }`, de Amigos `{ damageTypeId: null, label: "Hechizado" }`; `timeShort`: «1 acción» → «1A», «1 acción adicional» → «1AA», «1 reacción, que tomas…» → «1R», «10 minutos» → «10 min», «1 hora» → «1 h», «8 horas» → «8 h»; un arcano trae `limited`.
- [ ] **Step 2:** `npx vitest run tests/dnd2024/spells/spellTable.test.ts` → FAIL.
- [ ] **Step 3:** implementar y refactorizar `deriveActions` para reutilizarlo.
- [ ] **Step 4:** verde (incluido `tests/dnd2024/derive/actions.test.ts`).
- [ ] **Step 5: Commit** `feat(conjuros): filas de la tabla de conjuros`

### Task 2: Filtros, agrupado y opciones de lanzamiento

**Files:**
- Create: `lib/rules/dnd2024/spells/spellTableFilter.ts`, `lib/rules/dnd2024/spells/castOptions.ts`
- Test: `tests/dnd2024/spells/spellTableFilter.test.ts`, `tests/dnd2024/spells/castOptions.test.ts`

**Interfaces:**
- Consumes: `SpellRow` (Task 1), `Slots` y `SpellsSummary.used` (derive/spells.ts).
- Produces: `SpellTableFilter`, `Tri`, `EMPTY_SPELL_TABLE_FILTER`, `matchesSpellTable(row, f): boolean`, `parseSpellTableFilter(query: Record<string, string | string[] | undefined>): SpellTableFilter`, `spellTableHref(query, patch: Partial<SpellTableFilter>): string`, `groupByLevel(rows): { level: number; rows: SpellRow[] }[]` — spec §2.2 (claves de URL `q`, `tipo`, `nivel`, `conc`, `ritual`; `si|no`; mantiene `tab`, quita `spell` y `saved`).
- Produces: `CastOption` y `castOptions(row: SpellRow, slots: Slots, used: Record<string, number>): CastOption[]` — spec §2.3, con etiquetas «Nivel N», «Magia de pacto (nivel N)», «Lanzar como ritual».

- [ ] **Step 1: Pruebas que fallan:**
  - búsqueda: «fuego» y «FUEGO» encuentran Descarga de fuego; «asust» encuentra un conjuro con «Estado: Asustado»; «reacción» encuentra Escudo; «fire bolt» (inglés) encuentra Descarga de fuego;
  - `kind` trucos/conjuros; `levels` [1]; concentración sí/no; ritual sí/no;
  - URL: `parseSpellTableFilter({ q: "fuego", tipo: "trucos", nivel: "1,x,12", conc: "si", ritual: "raro" })` → `{ q: "fuego", kind: "cantrips", levels: [1], concentration: "yes", ritual: "any" }`; `spellTableHref` conserva `tab` y quita `spell` y `saved`;
  - `groupByLevel` ordena por nivel y nombre y omite niveles vacíos;
  - `castOptions`: nivel 1 con 1 libre → `[Nivel 1, …superiores con libres]`; nivel 1 sin libres y nivel 2 con libres → empieza por «Nivel 2»; pacto nivel 2 con 1 libre y conjuro nivel 1 → incluye «Magia de pacto (nivel 2)»; ritual sin espacios → solo «Lanzar como ritual»; truco → `[]`; `limited` → `[]`.
- [ ] **Step 2:** ejecutar → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** verde.
- [ ] **Step 5: Commit** `feat(conjuros): búsqueda, filtros y opciones de lanzamiento`

### Task 3: Tabla, cabecera y filtros en la pestaña

**Files:**
- Create en `app/components/characters/spells/`: `SpellTable.tsx` (grupos por nivel con casillas de espacios, filas), `SpellTableFilters.tsx` (búsqueda con espera de 300 ms y chips/selectores que cambian la URL), `CastButton.tsx` (botón y menú)
- Modify: `app/components/characters/spells/SpellsTab.tsx` (cabecera por clase, tabla por defecto, `?vista=gestionar` muestra la vista actual de `CasterBlockView`; las casillas de espacios pasan de `SlotsBar` a la cabecera de cada nivel — quitar `SlotsBar` si queda sin uso)
- Modify: `app/(main)/characters/[id]/page.tsx` (pasar `query` para los filtros y la vista; calcular `spellTableRows`)

**Interfaces:**
- Consumes: Tasks 1–2; la operación existente `PATCH /api/characters/[id]/spells` `{ op: "slot", level, used }` y su manejo optimista en `SpellsTab`.
- `CastButton({ options, onCast })`: con una opción, botón «Lanzar»; con varias, «Lanzar ▾» con menú (`role="menu"`, foco, Escape); sin opciones (y no truco) desactivado con `title` «Sin espacios libres». Ritual → aviso `role="status"` «Lanzado como ritual».
- Textos exactos y columnas: spec §3.1. Visitante no dueño: sin Lanzar ni casillas editables. Impresión: todas las filas, sin botones ni filtros.

- [ ] **Step 1:** implementar; vitest, tsc y eslint en verde.
- [ ] **Step 2: Commit** `feat(conjuros): tabla por niveles con espacios, filtros y lanzar`

### Task 4: Comprobación (controlador)

- [ ] `next build` con el servidor de desarrollo parado (borrar `.next/dev/cache/fetch-cache` al reiniciar).
- [ ] Navegador: «Elara Prueba» en solo lectura (búsquedas «fuego», «asustado», «reacción»; filtros; `?vista=gestionar` y volver); personaje de prueba propio que lance un conjuro (espacio gastado), uno con nivel superior y uno como ritual (borrado al terminar; restaurar el borrador del creador); 375 px sin desbordes.
