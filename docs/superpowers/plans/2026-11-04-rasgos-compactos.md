# Rasgos compactos — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Los rasgos se ven como filas compactas con su referencia «Libro, pág. N» y la descripción se despliega al pulsar.

**Architecture:** El importador guarda la página de cada entrada; el catálogo la expone; una función pura arma la referencia; `FeaturesTab` pasa a filas plegables.

**Tech Stack:** Next.js 16.3, React, TypeScript, Tailwind 4, vitest.

**Spec:** `docs/superpowers/specs/2026-11-04-rasgos-compactos-design.md`

## Global Constraints

- Rama `feat/rasgos-compactos` desde `main`; un commit por tarea; mensajes en español con `Co-Authored-By`. Sin push.
- Regla de capas: `lib/rules` sin `lib/server`, `lib/models`, mongoose ni next; `app/components/**` sin `lib/server`.
- En verde en cada commit: `npx vitest run`, `npx tsc --noEmit`, `npx eslint app lib tests scripts`. `next build` lo ejecuta el controlador.
- Textos exactos: «{Libro}, pág. {N}», «Descripción».
- Catálogo sin reimportar (sin `page`): la referencia es solo el libro; nada falla.

## Review Focus

- Entrada sin libro conocido o sin entrada en el catálogo: sin referencia y sin error (Task 1 y 2).
- Rasgo con contador de usos: pulsar los cuadrados no despliega ni pliega la fila (Task 2).
- Impresión: todas las descripciones salen desplegadas (Task 2).
- 375 px: la referencia no desborda (Task 2).

---

### Task 1: Página en el catálogo y referencia

**Files:**
- Modify: `lib/rules/import/normalize.ts` (`NormalizedEntry.page`, `header()`; herencia en `_copy`)
- Modify: `lib/models/BookEntry.ts`, `scripts/import-5etools.ts` (guardar `page`), `lib/server/catalog/catalog.ts` (exponer `page`), `lib/rules/catalog/types.ts` (`CatalogEntry.page: number | null`)
- Modify: `lib/rules/dnd2024/sheet/labels.ts` (`featureReference(entry: CatalogEntry | undefined): string | null`)
- Modify: `README.md` («Despliegue»: «Tras desplegar los rasgos compactos: vuelve a ejecutar `npm run import:5etools -- --data <carpeta data de 5etools>` y reinicia el servidor tras borrar la caché de datos de Next.»)
- Test: `tests/rules/normalize.test.ts`, `tests/dnd2024/sheet/labels.test.ts`

- [ ] **Step 1: Pruebas que fallan:** normalizar una entrada con `page: 165` → `page: 165`; sin `page` o con `page: 0` → `null`; una entrada con `_copy` sin página hereda la del original; `featureReference({ bookName: "Manual del Jugador 2024", page: 165 })` → «Manual del Jugador 2024, pág. 165»; con `page: null` → «Manual del Jugador 2024»; `undefined` → `null`.
- [ ] **Step 2:** ejecutar → FAIL.
- [ ] **Step 3:** implementar (los objetos `CatalogEntry` construidos en tests y fixtures necesitan `page: null`).
- [ ] **Step 4:** verde.
- [ ] **Step 5: Commit** `feat(catálogo): página de cada entrada y referencia de rasgos`

### Task 2: Filas compactas en «Rasgos y dotes»

**Files:**
- Modify: `app/components/characters/sheet/FeaturesTab.tsx` (filas plegables con referencia; cabeceras de grupo con referencia y descripción plegada; `ClampedText` ya no se usa aquí)

**Interfaces:**
- Consumes: `featureReference` (Task 1).
- Spec §3: fila = botón con `aria-expanded` (nombre, elegido, valor, «· Nivel N», chevron) + referencia debajo + contador fuera del botón; descripción completa al desplegar; cabeceras de grupo con referencia y «Descripción» plegada (también especie y legado); impresión desplegada sin chevrons.

- [ ] **Step 1:** implementar; vitest, tsc y eslint en verde.
- [ ] **Step 2: Commit** `feat(ficha): rasgos compactos con referencia y descripción al pulsar`

### Task 3: Comprobación (controlador)

- [ ] `next build` con el servidor de desarrollo parado.
- [ ] Pedir permiso y reimportar (`--dry-run` primero); borrar `.next/dev/cache/fetch-cache` y reiniciar.
- [ ] Navegador: «Elara Prueba» (referencias, desplegar/plegar, teclado), Bárbaro de prueba (Furia con contador), 375 px; borrar el personaje.
