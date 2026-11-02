# Ficha: fidelidad visual, inspiración heroica y estados — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La vista general de la ficha calca la disposición de «Mejora UI» con la identidad de Roll2Go, y gana Inspiración heroica y Estados con agotamiento.

**Architecture:** Reglas puras de estado en `lib/rules/dnd2024/sheet/status.ts` y `conditions.ts`; un servicio y una ruta propios como los de descanso; la UI redistribuye `AbilityStrip`, `SavesBox`, `SkillsBox`, `CombatBox` y una caja nueva «Defensas y estados».

**Tech Stack:** Next.js 16.3, React, TypeScript, Tailwind 4, vitest.

**Spec:** `docs/superpowers/specs/2026-11-02-ficha-visual-design.md`

## Global Constraints

- Rama `feat/ficha-visual` desde `main`; un commit por tarea; mensajes en español con `Co-Authored-By`. Sin push.
- Identidad de Roll2Go: tema oscuro, rojo de marca atenuado en los marcos, tipografía e iconos propios (`iconSrc("condition", …)` con `MaskIcon`); nada de D&D Beyond.
- Regla de capas: `lib/rules` sin `lib/server`, `lib/models`, mongoose ni next; `app/components/**` sin `lib/server`.
- En verde en cada commit: `npx vitest run`, `npx tsc --noEmit`, `npx eslint app lib tests scripts`. `next build` lo ejecuta el controlador.
- Textos exactos: «Inspiración heroica», «Curar», «Daño», «Actuales», «Máximos», «Temporales», «COMP · MOD · HABILIDAD · BONIF.», «Defensas y estados», «Sin defensas», «Sin estados», «Gestionar estados», «Agotamiento N»; errores «Petición no válida.», «Estado desconocido.», «El agotamiento va de 0 a 6.».
- Sin desplazamiento horizontal a 375 px; impresión sin botones de gestión.

## Review Focus

- Hoja antigua sin los campos nuevos: inspiración apagada, sin estados, agotamiento 0 (Task 1).
- Descanso largo con agotamiento 0: sigue en 0 (Task 1).
- `exhaustion` no entero, negativo o 7 → error; `condition` con `exhaustion` como clave → «Estado desconocido.» (Task 1).
- Visitante no dueño: ve inspiración y estados sin botones; la ruta le responde 403/404 (Task 2 y 4).
- Dos cambios de estado seguidos rápidos: el segundo no pisa el primero (Task 2, `unchangedFilter` con reintentos como los demás servicios).

---

### Task 1: Reglas de estado y agotamiento

**Files:**
- Modify: `lib/rules/dnd2024/sheet/sheet.ts` (campos opcionales `heroicInspiration?: boolean`, `conditions?: string[]`, `exhaustion?: number`)
- Create: `lib/rules/dnd2024/sheet/status.ts`, `lib/rules/dnd2024/sheet/conditions.ts`
- Modify: `lib/rules/dnd2024/sheet/rest.ts` (descanso largo: `exhaustion − 1`, mínimo 0)
- Test: `tests/dnd2024/sheet/status.test.ts`, `tests/dnd2024/sheet/rest.test.ts`

**Interfaces:**
- Produces: `StatusOp`, `applyStatus(sheet, op: unknown): { ok: true; sheet: Dnd2024SheetV2 } | { ok: false; error: string }` (spec §2); `CONDITION_KEYS: string[]` (orden de `CONDITION_NAMES` sin `exhaustion`), `CONDITION_RULES`, `exhaustionEffect(level: number): string`; `statusOf(sheet): { heroicInspiration: boolean; conditions: string[]; exhaustion: number }` (valores por defecto para hojas antiguas).

- [ ] **Step 1: Pruebas que fallan:** `statusOf` de una hoja sin campos → `{ false, [], 0 }`; `inspiration true`; `condition poisoned true` dos veces → `["poisoned"]`; añadir `prone` y luego `blinded` → `["blinded", "prone"]` (orden de `CONDITION_NAMES`); quitar uno que no está → sin cambios; `condition` `"zzz"` y `"exhaustion"` → «Estado desconocido.»; `exhaustion` 3 → 3; −1, 7 y 2.5 → «El agotamiento va de 0 a 6.»; op raro → «Petición no válida.»; `exhaustionEffect(2)` → «Nivel 2: −4 a las pruebas de d20 y −3 m de velocidad»; `exhaustionEffect(6)` → «Muerte»; descanso largo con `exhaustion: 2` → 1, con 0 → 0, y no toca `heroicInspiration` ni `conditions`.
- [ ] **Step 2:** `npx vitest run tests/dnd2024/sheet` → FAIL.
- [ ] **Step 3:** implementar (`CONDITION_RULES`: un resumen propio y breve en español de cada estado 2024, sin copiar texto de 5etools).
- [ ] **Step 4:** verde.
- [ ] **Step 5: Commit** `feat(ficha): reglas de inspiración, estados y agotamiento`

### Task 2: Servicio y ruta de estado

**Files:**
- Modify: `lib/server/characters/sheetEdits.ts` (`applyStatusOperation(userId, id, body)`)
- Create: `app/api/characters/[id]/status/route.ts` (PATCH)
- Test: `tests/server/status.test.ts` (como `tests/server/rest.test.ts`)

**Interfaces:**
- Consumes: `applyStatus`, `statusOf` (Task 1).
- Produces: `applyStatusOperation(userId: string, id: string, body: unknown): Promise<Result<{ status: ReturnType<typeof statusOf> }>>`; la ruta responde `{ ok: true, status }` o el error con `failureResponse`, con `rateLimit("sheet_status", session.id, 300, 3600)`.

- [ ] **Step 1: Pruebas que fallan:** el dueño marca la inspiración y añade `poisoned` (se guardan); otro usuario falla; op inválida → 400 con el mensaje de Task 1.
- [ ] **Step 2:** ejecutar → FAIL.
- [ ] **Step 3:** implementar (mismo patrón de `unchangedFilter` y reintentos que `applyRestOperation`).
- [ ] **Step 4:** verde.
- [ ] **Step 5: Commit** `feat(ficha): ruta de inspiración y estados`

### Task 3: Franja superior

**Files:**
- Modify: `app/components/characters/sheet/AbilityStrip.tsx`, `app/components/characters/sheet/HpEditor.tsx`
- Create: `app/components/characters/sheet/InspirationBox.tsx`
- Modify: `app/(main)/characters/[id]/page.tsx` y `SheetLayout.tsx`/`types.ts` lo justo para pasar `statusOf(sheet)` e `isOwner`

**Interfaces:**
- Consumes: Task 1 (`statusOf`), Task 2 (ruta, op `inspiration`).
- Spec §3.1: características con modificador grande y puntuación en píldora sobre el borde; Competencia y Velocidad del mismo alto; Inspiración heroica (`aria-pressed`, solo lectura para otros, optimista con vuelta atrás si falla y `router.refresh()`); PG con «Curar» · cantidad · «Daño» a la izquierda y «Actuales / Máximos» + «Temporales» a la derecha, misma lógica que el editor actual; «Dados de golpe» debajo.

- [ ] **Step 1:** implementar; vitest, tsc y eslint en verde.
- [ ] **Step 2: Commit** `feat(ficha): franja superior como «Mejora UI» con inspiración heroica`

### Task 4: Columnas, Iniciativa/CA y Defensas y estados

**Files:**
- Modify: `app/components/characters/sheet/SavesBox.tsx` (rejilla 2×3), `SkillsBox.tsx` (cabecera), `CombatBox.tsx` (Iniciativa y CA con forma de escudo), `SheetLayout.tsx`
- Create: `app/components/characters/sheet/StatusBox.tsx` (sustituye a `DefensesBox` en la disposición; reutiliza su contenido) y `ConditionsDialog.tsx` (casillas por estado y selector 0–6, guardado al momento)
- Modify: `app/components/characters/sheet/useStatDialog.tsx`/`types.ts` si el diálogo de un estado usa `StatDialog` (`Stat` gana `{ kind: "condition"; key: string }`)

**Interfaces:**
- Consumes: Tasks 1–3.
- Spec §3.2–3.3: textos exactos de Global Constraints; cada estado activo con su icono abre su texto; agotamiento con icono, «Agotamiento N» y `exhaustionEffect`; «Gestionar estados» solo para el dueño; impresión sin botones; 375 px sin desbordes.

- [ ] **Step 1:** implementar; vitest, tsc y eslint en verde.
- [ ] **Step 2: Commit** `feat(ficha): salvaciones, iniciativa, CA y caja de defensas y estados`

### Task 5: Comprobación (controlador)

- [ ] `next build` con el servidor de desarrollo parado.
- [ ] Navegador: «Elara Prueba» en solo lectura a 1640, 768 y 375 px comparando con «Mejora UI»; personaje de prueba propio: inspiración, estados, agotamiento, descanso largo, curar/daño; borrado al terminar.
