# Descanso corto con dados de golpe — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Descanso corto siempre disponible que gasta dados de golpe por clase (tirada de Roll2Go o total manual) y descanso largo que los recupera.

**Architecture:** Reglas puras en `lib/rules/dnd2024/sheet/rest.ts` (dados disponibles y aplicación de los descansos); servicio y ruta propios (`PATCH /api/characters/[id]/rest`) que calculan el contexto con `derive`; el diálogo de `RestButtons` llama a esa ruta.

**Tech Stack:** Next.js 16.3, React, TypeScript, Mongoose 9, vitest.

**Spec:** `docs/superpowers/specs/2026-11-01-descanso-corto-design.md`

## Global Constraints

- Rama `feat/descanso-corto` desde `main`; un commit por tarea; mensajes en español con `Co-Authored-By`. Sin push.
- Interfaz y comentarios en español con el estilo del código que rodea.
- Regla de capas: `lib/rules` sin `lib/server`, `lib/models`, mongoose ni next; `app/components/**` sin `lib/server`.
- En verde en cada commit: `npx vitest run`, `npx tsc --noEmit`, `npx eslint app lib tests scripts`. `next build` lo ejecuta el controlador (comparte `.next` con el servidor de desarrollo).
- Textos exactos de la spec §5 (diálogo, errores, confirmación del descanso largo, «Dados de golpe: …»).

## Review Focus

- Una hoja antigua sin `hitDiceUsed` no rompe nada: todos los dados libres (Task 1).
- `hitDiceUsed` con más gastados que el nivel actual (tras borrar un nivel): `used` se recorta a `total` (Task 1).
- `healing` manual con 0 dados elegidos → error, no curación gratis (Task 1).
- Un visitante que no es dueño recibe 403/404 en la ruta (Task 2).
- Doble clic en «Hacer descanso corto»: el botón queda desactivado mientras se envía (Task 3).

---

### Task 1: Reglas de los descansos

**Files:**
- Create: `lib/rules/dnd2024/sheet/rest.ts`
- Modify: `lib/rules/dnd2024/sheet/sheet.ts` (`Dnd2024SheetV2.hitDiceUsed: Record<string, number>`), `lib/rules/dnd2024/sheet/upgrade.ts` (rellena `{}`), y donde se cree una hoja nueva (`validateSheet`) para que nazca con `{}`
- Modify: `lib/rules/dnd2024/spells/spellOps.ts` (quitar `longRest`/`shortRest` y `shortRestRestores` si queda sin usos; exportar `recoversOnShortRest` y `PACT_SLOT` si `rest.ts` los necesita)
- Test: `tests/dnd2024/sheet/rest.test.ts`, ajustar `tests/dnd2024/spells/spellOps.test.ts`

**Interfaces:**
- Produces: `type HitDicePool = { classKey: string; name: string; die: number; total: number; used: number }`; `hitDicePools(sheet: Dnd2024SheetV2, entries: Map<string, CatalogEntry>): HitDicePool[]` (orden del historial; `used = min(hitDiceUsed[classKey] ?? 0, total)`; clase sin datos fuera).
- Produces: `type RestOp = { op: "longRest" } | { op: "shortRest"; spend?: Record<string, number>; healing?: number }`; `type RestCtx = { pools: HitDicePool[]; conMod: number; maxHp: number; roll: (die: number) => number }`; `applyRest(sheet: Dnd2024SheetV2, op: unknown, ctx: RestCtx): RestResult` con `RestResult = { ok: true; sheet: Dnd2024SheetV2; healed: number; rolls: number[] } | { ok: false; error: string }`.
- Produces: `healingRange(dice: number[], conMod: number): { min: number; max: number }` (para el diálogo y la validación).
- Reglas y textos: spec §3.

- [ ] **Step 1: Pruebas que fallan** (`rest.test.ts`):
  - `hitDicePools` Guerrero 3 / Mago 1 → `[{ die: 10, total: 3 }, { die: 6, total: 1 }]`; `hitDiceUsed: { guerrero: 5 }` con total 3 → `used: 3`; hoja sin `hitDiceUsed` → `used: 0`.
  - corto automático, 1d10, conMod +2, `roll` → 4: `healed: 6`, `rolls: [4]`, `hitDiceUsed` +1; conMod −3, roll 1 → `healed: 1`.
  - PG 5/12 + curación 10 → `current: null`; temporales intactos.
  - manual: 2d6 con conMod 0 → rango 2–12; `healing: 13` → «Con esos dados recuperas entre 2 y 12 puntos de golpe.»; `healing` con 0 dados → error.
  - gastar 2 con 1 libre → «No te quedan tantos dados de golpe de Mago.»; clase desconocida → mismo error con el nombre crudo.
  - corto con 0 dados: recupera pacto (`slotsUsed.pact` fuera) y no toca `hp` ni `hitDiceUsed`.
  - largo: `hitDiceUsed: {}`, `hp.current: null`, `temp: 0`, `slotsUsed: {}`, `limitedUsed: {}`.
  - `upgradeSheet` de una hoja sin `hitDiceUsed` → `{}`.
- [ ] **Step 2:** `npx vitest run tests/dnd2024/sheet/rest.test.ts` → FAIL.
- [ ] **Step 3:** implementar; mover las pruebas de descansos de `spellOps.test.ts` a `rest.test.ts`.
- [ ] **Step 4:** verde (vitest, tsc, eslint).
- [ ] **Step 5: Commit** `feat(ficha): reglas del descanso corto con dados de golpe`

### Task 2: Ruta y servicio de descanso

**Files:**
- Create: `app/api/characters/[id]/rest/route.ts` (PATCH)
- Modify: `lib/server/characters/sheetEdits.ts` (nuevo `applyRestOperation(userId, id, body)`; quitar `longRest`/`shortRest` de `FIELDS` de conjuros)
- Modify: `app/api/characters/[id]/spells/route.ts` (comentario de operaciones)
- Test: `tests/server/characters.test.ts` (o un archivo nuevo en `tests/server/` con `fakeDb`)

**Interfaces:**
- Consumes: `hitDicePools`, `applyRest`, `RestOp` (Task 1).
- Produces: `applyRestOperation(userId: string, id: string, body: unknown): Promise<Result<{ healed: number; rolls: number[] }>>` — solo el dueño (`loadCharacterFor(..., "write")`), contexto con `derive` (`conMod` de `abilities.con.mod`, `maxHp` de `hp.max`), `roll` con `crypto.randomInt(1, die + 1)`, una sola actualización con `unchangedFilter` sobre `slotsUsed`, `limitedUsed`, `hp`, `hitDiceUsed`.
- Ruta: mismo patrón de sesión, límite de peticiones (`rateLimit("sheet_rest", session.id, 60, 3600)`) y `failureResponse` que la ruta de conjuros; responde `{ ok: true, healed, rolls }`.

- [ ] **Step 1: Pruebas que fallan:** el servicio con un personaje falso guarda `hp` e `hitDiceUsed` tras un corto con 1 dado; un usuario que no es el dueño falla; el descanso largo deja `hitDiceUsed: {}`.
- [ ] **Step 2:** ejecutar la prueba → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** verde.
- [ ] **Step 5: Commit** `feat(ficha): ruta de descansos`

### Task 3: Diálogo y dados de golpe en la ficha

**Files:**
- Modify: `app/components/characters/sheet/RestButtons.tsx`
- Modify: `app/components/characters/sheet/AbilityStrip.tsx` (línea «Dados de golpe: …» bajo los PG)
- Modify: `app/(main)/characters/[id]/page.tsx` y `SheetLayout`/`types.ts` (pasar `pools` y `conMod`; quitar `shortRestRestores` si deja de usarse, salvo para la línea «También recuperas…»: pasar `recoversOther: boolean`)

**Interfaces:**
- Consumes: `HitDicePool`, `healingRange` (Task 1); la ruta (Task 2).
- `RestButtons({ characterId, pools, conMod, recoversOther })`. Diálogo §5.1: selector por clase (0..libres, − y +, desactivado sin libres), casilla «Aplicar automáticamente la tirada» (marcada), campo «PG recuperados» con «entre {min} y {max}» cuando está desmarcada y hay dados, línea de «También recuperas…» si `recoversOther`, botones «Hacer descanso corto» (desactivado mientras envía) y «Cancelar»; tras éxito con tirada automática: «Has recuperado {n} PG ({dados}).» con «Cerrar» (`{dados}` p. ej. «d10: 4, d6: 3»); siempre `router.refresh()`. Descanso largo con el texto de §5.2 y la ruta nueva.
- «Dados de golpe: 2d10 · 1d6» con los libres por clase (`{total-used}d{die}`), solo lectura.

- [ ] **Step 1:** implementar; vitest, tsc y eslint en verde.
- [ ] **Step 2: Commit** `feat(ficha): diálogo de descanso corto con dados de golpe`

### Task 4: Comprobación (controlador)

- [ ] `next build` con el servidor de desarrollo parado.
- [ ] Navegador, personaje de prueba propio (borrado al terminar; restaurar el borrador del creador): dañar, descanso corto automático (ver resultado y PG), descanso corto manual (rango y error fuera de rango), «Dados de golpe» bajan, descanso largo los recupera; móvil 375 px sin desbordes en el diálogo.
