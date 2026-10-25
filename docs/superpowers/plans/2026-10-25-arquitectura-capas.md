# Reorganización en capas — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar Roll2Go en capas (modelos, servidor por dominio, reglas puras, vista por dominio) sin cambiar el comportamiento, con rutas y páginas que solo llaman a la capa de servidor.

**Architecture:** Primero movimientos mecánicos de archivos con `git mv` y reescritura de imports por un script de mapeo; después la partición de dos archivos grandes; después la extracción de servicios desde páginas y rutas, dominio a dominio; por último una regla de ESLint que impide volver atrás.

**Tech Stack:** Next.js 16.3 (app router), React 19, Mongoose 9, TypeScript, vitest, ESLint.

**Spec:** `docs/superpowers/specs/2026-10-25-arquitectura-capas-design.md`

## Global Constraints

- **Sin cambios de comportamiento ni de interfaz**: mismas URL, rutas de API, respuestas, textos y datos.
- Cada commit deja en verde `npx vitest run`, `npx tsc --noEmit` (ignorar `.next/`), `npx eslint app lib tests scripts` y `npx next build`.
- Movimientos con `git mv` (conservan historial); imports con el alias `@/…` y rutas nuevas exactas de la spec §2.
- Archivos de `lib/server/**` empiezan con `import "server-only"` (añadir la dependencia `server-only` si no está).
- `lib/rules/**` sin imports de Next, Mongoose, `lib/models` ni `lib/server`.
- Las claves de `unstable_cache` y las etiquetas de `revalidateTag` no cambian.
- No mover nada de `app/` que sea ruta de Next (páginas, layouts, `route.ts`); `app/components/proxy.ts` se deja donde está y se informa (activarlo cambiaría el comportamiento).
- Un commit por tarea (o varios commits dentro de una tarea, uno por capa movida), en la rama `refactor/capas`.

## Review Focus

- **Un componente cliente que importa por error algo de `lib/server`** → `next build` falla por `server-only`. Comprobación en las Tareas 2 y 6.
- **Una prueba con `vi.mock("@/lib/…")` que apunta a la ruta antigua** → la prueba pasaría sin mockear de verdad; todas las rutas de `vi.mock` se actualizan y se revisan. Comprobación en cada tarea de movimiento.
- **Importaciones dinámicas o rutas en cadenas** (`import()`, `require`, scripts de `package.json`, `scripts/*.ts`) → se actualizan también. Comprobación en cada tarea de movimiento (`grep` de las rutas antiguas sin resultados).
- **Un servicio extraído que cambia una respuesta** (código de estado, texto, forma) → las pruebas de rutas existentes siguen pasando sin tocar sus expectativas. Tareas 5 y 6.
- **Una página que pierde datos al pasar a servicio** (campo no seleccionado) → recorrido en el navegador de la Tarea 7.

---

### Tarea 1: Modelos y utilidades

**Files:** mover los 16 modelos y `mongodb.ts` a `lib/models/`; `bbcode.ts`, `timeAgo.ts`, `utils.ts`, `icons.ts`, `systems.ts`, `unchangedFilter.ts`, `rateLimit.ts` a `lib/utils/`; actualizar todos los imports en `app/`, `lib/`, `tests/`, `scripts/`.

**Interfaces:**
- Produces: `@/lib/models/<Modelo>`, `@/lib/models/mongodb` (`connectDB`), `@/lib/utils/<archivo>`.
- Herramienta: un script en el scratchpad `move.mjs <mapa.json>` que hace `git mv` de cada entrada `{ "from": "lib/x.ts", "to": "lib/models/x.ts" }` y reescribe en todos los `.ts/.tsx/.mjs` los especificadores `@/lib/x` → `@/lib/models/x` (y los relativos que apunten a esos archivos), incluidas las rutas de `vi.mock`. Se reutiliza en las Tareas 2–4.

- [ ] **Paso 1:** Escribir el script y el mapa; ejecutarlo.
- [ ] **Paso 2:** `grep` de cada ruta antigua (`@/lib/User"`, `../User"`…) → 0 resultados.
- [ ] **Paso 3:** vitest, tsc, eslint, `next build` → verde.
- [ ] **Paso 4: Commit** `refactor: modelos en lib/models y utilidades en lib/utils`.

### Tarea 2: Capa de servidor por dominio

**Files:** mover los archivos de la tabla de la spec §2.2 a `lib/server/<dominio>/`; `lib/rules/catalog.ts`, `books.ts`, `migrateBookIds.ts` y lo que consulta Mongo de `spellRows.ts` a `lib/server/catalog/` (lo puro de `spellRows.ts` y `pickBooks.ts` a `lib/rules/catalog/`); añadir `import "server-only"` a cada archivo de `lib/server/**` y la dependencia `server-only`.

**Interfaces:**
- Produces: `@/lib/server/<dominio>/<archivo>` con las mismas exportaciones que antes.

- [ ] **Paso 1:** Mapa y script (Tarea 1); separar lo puro de `spellRows.ts`/`catalog.ts` sin cambiar exportaciones (si un archivo puro y uno de servidor necesitan el mismo tipo, el tipo va al puro).
- [ ] **Paso 2:** Las pruebas que importaban estos módulos se actualizan; las que no pueden cargar `server-only` en vitest usan un alias de vitest a un módulo vacío (`server-only` → `tests/stubs/server-only.ts`).
- [ ] **Paso 3:** `grep` de rutas antiguas → 0; vitest, tsc, eslint, `next build` → verde (este último detecta `server-only` en el cliente).
- [ ] **Paso 4: Commit** `refactor: capa de servidor por dominio en lib/server`.

### Tarea 3: Reglas de D&D en subcarpetas y archivos grandes partidos

**Files:** `lib/rules/dnd2024/**` según la spec §2.4; partir `validate.ts` y `levels.ts` según §2.5.

**Interfaces:**
- Produces: `@/lib/rules/dnd2024/{sheet,creation,levels,spells,derive}/…`; `validateSheet`, `checkChoices`, `pendingChoices`, `heldFeats`, `heldPicks`, `heldOptionalFeatures` y el resto de exportaciones con el mismo nombre y firma.

- [ ] **Paso 1:** Mover con el script (commit `refactor: reglas de D&D 2024 en subcarpetas`).
- [ ] **Paso 2:** Partir `validate.ts` en `creation/validateSheet.ts`, `checkChoices.ts`, `checkSpells.ts`, `checkFeatSpells.ts`, y `levels.ts` en `levels/pendingChoices.ts`, `held.ts`, `spellPending.ts`; ningún archivo nuevo > ~400 líneas; sin ciclos de import (comprobar con `npx madge --circular lib/rules` o equivalente).
- [ ] **Paso 3:** vitest (sin tocar expectativas), tsc, eslint, `next build` → verde.
- [ ] **Paso 4: Commit** `refactor: partir validate.ts y levels.ts`.

### Tarea 4: Componentes por dominio

**Files:** `app/components/**` según la tabla de la spec §2.6.

- [ ] **Paso 1:** Mover con el script; `characters/` gana `creator/` y `hooks/`.
- [ ] **Paso 2:** `grep` de rutas antiguas → 0; vitest, tsc, eslint, `next build` → verde.
- [ ] **Paso 3: Commit** `refactor: componentes por dominio`.

### Tarea 5: Servicios de campañas y personajes

**Files:**
- Create: `lib/server/campaigns/queries.ts` (o un archivo por función), `lib/server/characters/queries.ts`
- Modify: páginas de `app/(main)/campaigns/**` y `app/(main)/characters/**` y sus rutas de API que consultan modelos
- Test: `tests/server/campaigns.test.ts`, `tests/server/characters.test.ts`

**Interfaces:**
- Produces (ejemplos; los nombres finales en el informe): `listMyCampaigns(userId)`, `campaignOverview(session, id)`, `listCampaignCharacters(session, id)`, `listMembers`, `listLogEntries`, `listMyCharacters(userId, filtros)`, `loadSheetPage(session, id, tab)`, `loadCreatorPage(session, params)`, `loadLevelUpPage(session, id)`. Devuelven datos planos; los errores, `{ ok: false, status, error }` o `notFound()`/`redirect()` solo en la página.

- [ ] **Paso 1: Pruebas** de cada servicio con mocks de modelos (permisos: no miembro → no encontrado; DM ve pendientes y los demás no; filtros de «Mis personajes»).
- [ ] **Paso 2:** Extraer, dejando páginas y rutas sin imports de `lib/models`.
- [ ] **Paso 3:** vitest (las pruebas de rutas existentes sin cambiar expectativas), tsc, eslint, `next build` → verde.
- [ ] **Paso 4: Commit** `refactor: servicios de campañas y personajes`.

### Tarea 6: Resto de servicios y regla de ESLint

**Files:** páginas y rutas de foro, mensajes, social, notificaciones, ajustes, perfil, admin, libros, invitaciones, autenticación; `eslint.config.*`.

- [ ] **Paso 1:** Extraer servicios con pruebas, como en la Tarea 5.
- [ ] **Paso 2:** Regla `no-restricted-imports` para `app/**`: prohibido `@/lib/models/*` y `mongoose`; `grep` de `connectDB` en `app/` → 0.
- [ ] **Paso 3:** vitest, tsc, eslint, `next build` → verde.
- [ ] **Paso 4: Commit** `refactor: servicios del resto de dominios y regla de capas`.

### Tarea 7: Verificación de extremo a extremo

- [ ] Recorrer en el navegador integrado (sesión del usuario, sin modificar datos): inicio, mis personajes (con filtros), una ficha (todas las pestañas y un diálogo de conjuro y de característica), creador (elegir clase), subir de nivel (sin confirmar), una campaña y sus pestañas (personajes, foro y un hilo, registro, miembros), social, mensajes, notificaciones, ajustes, perfil y admin si el usuario es admin; consola sin errores.
- [ ] Informe: lo verificado, lo no verificado, árbol final de carpetas (`lib/`, `app/components/`) y el estado de `app/components/proxy.ts` (sin moverlo).
