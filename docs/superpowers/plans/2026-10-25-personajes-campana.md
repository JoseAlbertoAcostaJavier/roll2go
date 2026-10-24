# Personajes de la campaña — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una campaña muestre sus personajes como en Nivel20 y gestione su ciclo de vida: crear desde la campaña, solicitar unir un personaje externo (el DM acepta o deniega), quitar o cancelar, y avisos al DM y al jugador.

**Architecture:** Un campo `campaignStatus` en `Character` distingue aprobados de pendientes. Una regla pura (`canRequestJoin` + `booksUsedBy`) decide si se puede solicitar. Rutas nuevas para el jugador (`/api/characters/[id]/campaign`) y para el DM (`/api/campaigns/[id]/characters/[characterId]` …), con escrituras condicionales y avisos con `notify`. La interfaz de la campaña y la cabecera de la ficha llaman a esas rutas.

**Tech Stack:** Next.js 16.3 (app router), React 19, Mongoose 9, Tailwind 4, vitest.

**Spec:** `docs/superpowers/specs/2026-10-25-personajes-campana-design.md`

## Global Constraints

- Antes de usar cualquier API de Next, leer su guía en `node_modules/next/dist/docs/`.
- Interfaz, errores y avisos en español, con los textos exactos de la spec §4 y §7.
- Consultas de «aprobados»: `campaignStatus: { $ne: "pending" }` (los antiguos sin el campo cuentan como aprobados; sin migración).
- «Quitar», «denegar» y «cancelar» = `$unset: { campaign: "", origin: "", campaignStatus: "" }`; nunca se borra el personaje.
- Rutas nuevas: sesión obligatoria, `rateLimit("campaign_characters", userId, 60, 3600)`, errores `{ error }` con 400/403/404/409.
- Reglas puras (`lib/CampaignRules.ts`, `lib/rules/dnd2024/**`) sin Next ni mongoose, probadas con vitest.
- Tokens de Tailwind del proyecto; tema oscuro; sin desplazamiento horizontal a 375 px; iconos de estado con `StatusIcon`.
- Un commit por tarea, en la rama `feat/personajes-campana`.

## Review Focus

- **Dos solicitudes simultáneas del mismo personaje a campañas distintas** → solo una queda; la otra recibe 409 «Este personaje ya está en una campaña.». Prueba en la Tarea 2.
- **El DM acepta una solicitud que el jugador acaba de cancelar** → 409 «La solicitud ya no está pendiente.» y nada cambia. Prueba en la Tarea 2.
- **Otro miembro abre por URL la ficha de un personaje pendiente** → 404. Prueba en la Tarea 1.
- **Jugador expulsado con un personaje pendiente** → el personaje sale de la campaña y no queda `campaignStatus` suelto. Prueba en la Tarea 1.
- **Personaje sin libros propios guardados (`Character.books` vacío) en campaña con libros limitados** → la regla mira los libros que usa su hoja, no la lista guardada. Prueba en la Tarea 1.

---

### Tarea 1: Datos, reglas y acceso

**Files:**
- Modify: `lib/Character.ts`, `lib/CampaignRules.ts`, `lib/characterAccess.ts`, `app/api/characters/route.ts`, `app/api/campaigns/[id]/members/[userId]/route.ts`
- Create: `lib/rules/dnd2024/booksUsed.ts`
- Test: `tests/rules/campaignRules.test.ts`, `tests/dnd2024/booksUsed.test.ts`, `tests/api/characterAccess.test.ts`

**Interfaces:**
- Produces:
  - `Character.campaignStatus?: "approved" | "pending"` (enum en el esquema, sin defecto).
  - `booksUsedBy(sheet: Dnd2024SheetV2): string[]` — `book` distintos de todas las referencias (`isRef`) de la hoja: especie, legado, trasfondo, `levels[].class/subclass` y valores de `choices` (recorrido recursivo), `inventory.items[].ref`, `prepared`, `spellbookExtra`, `weaponMasteries`.
  - `canRequestJoin(input: { campaign: { systemId: string; status: string; characters: { allowed: boolean; external: boolean }; restrictBooks: boolean; allowedBooks: string[] }; character: { systemId: string; campaign: string | null; books: string[] }; isMember: boolean }): { ok: true } | { ok: false; error: string; disallowed?: string[] }` con los textos de la spec §4 (el de libros sin nombres: «Este personaje usa libros que la campaña no permite.»; la ruta añade los nombres).

- [ ] **Paso 1: Pruebas que fallan**:
  - `canRequestJoin`: un caso válido y uno por cada error de la spec §4 (no miembro, campaña no activa, otro sistema, no admite externos — `allowed: false` y `external: false` —, ya en campaña, libros no permitidos con `disallowed` igual a los ids fuera de `allowedBooks`); con `restrictBooks: false` los libros no importan.
  - `booksUsedBy`: una hoja con especie del libro A, una dote elegida en `levels[1].choices` del libro B, un objeto del inventario del libro C y un conjuro preparado del libro D → `["A","B","C","D"]` (sin duplicados, en cualquier orden).
  - `loadCharacterFor(userId, id, "read")` con mocks de Mongoose: personaje pendiente → el dueño y el DM lo leen; otro miembro → `null`; aprobado → cualquier miembro.
  - Expulsar miembro: el `$unset` incluye `campaignStatus`.
  - Crear con `campaign` → se guarda `campaignStatus: "approved"`.
- [ ] **Paso 2: Ejecutar** → FAIL.
- [ ] **Paso 3: Implementar** según las interfaces.
- [ ] **Paso 4: Ejecutar** suite, `npx tsc --noEmit` (ignorar `.next/`), `npx eslint app lib tests` → limpios.
- [ ] **Paso 5: Commit** `feat(campaigns): estado de los personajes en la campaña y reglas para unirlos`.

### Tarea 2: Rutas y avisos

**Files:**
- Create: `app/api/characters/[id]/campaign/route.ts` (`POST`, `DELETE`), `app/api/campaigns/[id]/characters/[characterId]/route.ts` (`DELETE`), `…/[characterId]/approve/route.ts` (`POST`), `…/[characterId]/reject/route.ts` (`POST`)
- Modify: `lib/notificationText.ts`, `lib/Notification.ts` (si el enum no sale de `NOTIFICATION_TYPES`)
- Test: `tests/api/characterCampaign.test.ts`, `tests/api/campaignCharacters.test.ts`, `tests/notificationText.test.ts`

**Interfaces:**
- Consumes: `canRequestJoin`, `booksUsedBy`, `campaignStatus` (Tarea 1); `requireMember`, `requireDm`, `sessionOf` (`lib/campaignApi.ts`); `notify` (`lib/notify.ts`).
- Produces:
  - `POST /api/characters/[id]/campaign` `{ campaignId }` → 200 `{ status: "pending" | "approved" }` | 400/404/409 `{ error }`. Escritura condicional `{ _id, owner: session.id, campaign: { $exists: false } }`. Nombres de libros no permitidos desde `Book` (`name`), unidos con «, ».
  - `DELETE /api/characters/[id]/campaign` → 200 `{ ok: true }`; solo el dueño.
  - `POST …/approve` y `POST …/reject` → solo DM; solo si `campaignStatus === "pending"` en esa campaña (escritura condicional con `campaignStatus: "pending"`; si no coincide, 409 «La solicitud ya no está pendiente.»).
  - `DELETE /api/campaigns/[id]/characters/[characterId]` → solo DM; aprobado o pendiente.
  - Tipos de aviso nuevos `character_approved`, `character_rejected`, `character_removed`, `character_left`, con los textos, enlaces y preferencias de la spec §7; `character_import_request` se emite al solicitar (si quien solicita no es el DM). El nombre del personaje va en `text`.

- [ ] **Paso 1: Pruebas que fallan** (mocks como `tests/api/deleteLevel.test.ts`):
  - Solicitud válida de un jugador → 200 `pending`, `updateOne` con el filtro condicional y aviso `character_import_request` al DM; solicitud del DM → `approved` y sin aviso; `canRequestJoin` falla → 400 con el texto; libros → 400 con «…: Libro X, Libro Y.»; filtro sin coincidencia → 409.
  - `DELETE …/characters/[id]/campaign`: pendiente → sin aviso; aprobado de un jugador → aviso `character_left` al DM; no dueño → 404.
  - Aprobar/denegar: no DM → 403; no pendiente → 409 «La solicitud ya no está pendiente.»; correcto → aviso `character_approved` / `character_rejected` al dueño.
  - Quitar (DM) → `$unset` y aviso `character_removed` (no si el dueño es el DM).
  - `describeNotification` para los cuatro tipos nuevos (texto y enlace) y `emailPrefFor` (`invites`, `removals`, `removals`, `dm`).
- [ ] **Paso 2: Ejecutar** → FAIL.
- [ ] **Paso 3: Implementar.**
- [ ] **Paso 4: Ejecutar** suite, tsc y eslint → limpios.
- [ ] **Paso 5: Commit** `feat(campaigns): solicitar, aceptar, denegar y quitar personajes de una campaña`.

### Tarea 3: Sección Personajes de la campaña

**Files:**
- Modify: `app/(main)/campaigns/[id]/(view)/characters/page.tsx`
- Create: `app/components/campaigns/CampaignCharacterCard.tsx`, `app/components/campaigns/AddCharacterDialog.tsx`, `app/components/campaigns/CharacterActions.tsx` (menú «⋮» y botones ✓/✕, cliente)

**Interfaces:**
- Consumes: rutas de la Tarea 2; `canRequestJoin`, `booksUsedBy` (Tarea 1) para la elegibilidad en el diálogo; `StatusIcon` (`app/components/characters/sheet/StatusBadge.tsx`); `classesSummary`/`classesOf` para «Especie Clase N».

- [ ] **Paso 1: Implementar** según la spec §8.1:
  - Consulta: DM → todos los de la campaña; resto → aprobados + los propios pendientes. Pendientes primero, luego por `createdAt`.
  - Tarjeta: retrato redondo (`/api/images/<portraitId>` o silueta) con `StatusIcon` arriba a la izquierda; nombre `text-brand-soft` enlazado; «Especie Clase N» (multiclase «Clase N / Clase M»); nombre de usuario en texto enlazado al perfil (sin avatar); sin Interno/Externo.
  - Pendiente: dueño → `grayscale opacity-60` y «Pendiente de aprobación»; DM → botones ✓ «Aceptar» (verde) y ✕ «Denegar» (rojo), con `aria-label` que incluye el nombre del personaje.
  - Menú «⋮» (`aria-haspopup="menu"`): DM → «Quitar de la campaña» (confirmación con el nombre); dueño → «Quitar de la campaña» o «Cancelar solicitud».
  - Cabecera con «Crear personaje» (si `allowed && internal`, a `/characters/new?system=<sistema>&campaign=<id>`) y «Añadir personaje» (si `allowed && external`): el diálogo lista los personajes del usuario del mismo sistema sin campaña, con los no elegibles desactivados y su motivo; al elegir, `POST /api/characters/[id]/campaign`.
  - Texto de ayuda según lo que admita la campaña; estado vacío «Aún no hay personajes en esta campaña.».
  - Tras cada acción, `router.refresh()` y mensaje de éxito o el error del servidor (`role="status"` / `role="alert"`).
- [ ] **Paso 2: Verificar**: suite, tsc y eslint limpios; navegador (servidor «roll2go-dev», sesión del usuario ya iniciada; nunca iniciar sesión ni tocar personajes ajenos): en una campaña de la que el usuario es DM, crear «… Prueba Campaña» desde «Crear personaje», añadir otro personaje de prueba con «Añadir personaje» (queda aprobado al momento por ser DM), quitarlo desde «⋮»; tarjetas a 375 px sin desplazamiento horizontal. Borrar los personajes de prueba al final y dejar la campaña como estaba.
- [ ] **Paso 3: Commit** `feat(campaigns): sección Personajes con retratos, solicitudes y acciones del DM`.

### Tarea 4: Unir, cancelar y quitar desde la ficha

**Files:**
- Modify: `app/components/characters/sheet/SheetHeader.tsx`, `app/(main)/characters/[id]/page.tsx` (datos de la campaña y de las campañas elegibles para el dueño)
- Create: `app/components/characters/sheet/JoinCampaignDialog.tsx`

**Interfaces:**
- Consumes: rutas de la Tarea 2; `canRequestJoin`, `booksUsedBy` (Tarea 1).

- [ ] **Paso 1: Implementar** según la spec §8.2: dueño sin campaña → «Unir a una campaña» (diálogo con sus campañas activas del mismo sistema y su elegibilidad); pendiente → «Pendiente de aprobación en <campaña>» y «Cancelar solicitud»; aprobado → enlace a la campaña y «Quitar de la campaña» (confirmación). Los demás no ven estos controles. Mismo patrón de diálogo accesible que `StatDialog`/`SpellDialog`.
- [ ] **Paso 2: Verificar**: suite, tsc y eslint limpios; navegador: con un personaje de prueba propio, unirlo a la campaña del usuario desde la ficha (aprobado al momento), quitarlo, y comprobar que una campaña que limita libros bloquea un personaje con libros no permitidos mostrando sus nombres (si el usuario no tiene una, comprobarlo solo con las pruebas de la Tarea 2 y decirlo). Borrar los personajes de prueba.
- [ ] **Paso 3: Commit** `feat(characters): unir un personaje a una campaña desde su ficha`.
