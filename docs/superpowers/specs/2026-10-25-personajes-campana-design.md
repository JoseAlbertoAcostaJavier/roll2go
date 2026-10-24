# Personajes de la campaña — diseño

Fecha: 2026-10-25.

## 1. Objetivo

La sección **Personajes** de una campaña (`app/(main)/campaigns/[id]/(view)/characters/page.tsx`) muestra hoy una lista simple con la foto de perfil del jugador y una etiqueta Interno/Externo, y no permite crear ni añadir personajes ni moderarlos. Debe parecerse a la de Nivel20 y cerrar el ciclo de vida de un personaje en una campaña:

- crear un personaje desde la campaña (si admite personajes internos), con sus libros permitidos;
- solicitar unir un personaje creado fuera (externo), que el DM acepta o deniega;
- que el jugador saque su personaje o cancele su solicitud, y que el DM quite personajes;
- avisos al DM (y al jugador) por la red social y por correo.

Decisiones del usuario:
- «Eliminar» del DM = **sacar de la campaña**; el personaje sigue existiendo en «Mis personajes» del jugador.
- Si la campaña limita los libros, una solicitud de un personaje con libros no permitidos se **bloquea**, indicando cuáles.
- El jugador puede **quitar** su personaje de la campaña o **cancelar** su solicitud.

Fuera de alcance: equipos y personajes desactivados por sesión (Nivel20), cambiar el DM, borrar personajes ajenos.

## 2. Situación actual (relevante)

- `Character.campaign` (ObjectId opcional) y `Character.origin` (`"internal" | "external"`). Solo la creación (`POST /api/characters` con `campaign`) asigna campaña, siempre `internal` y sin aprobación; avisa al DM con `character_created`.
- `PATCH /api/characters/[id]` no toca `campaign`.
- `loadCharacterFor(userId, id, "read")` deja leer a cualquier miembro de la campaña del personaje.
- Expulsar a un miembro (`DELETE /api/campaigns/[id]/members/[userId]`) desvincula sus personajes (`$unset campaign, origin`).
- Avisos: `character_import_request` existe en `lib/notificationText.ts` pero no se emite; `emailPrefFor` lo asocia a la preferencia `dm`.
- `lib/CampaignRules.ts` (`canAddCharacter`, `booksAreValid`, `booksForCharacter`) existe pero no se usa en la app.

## 3. Datos

`lib/Character.ts`: campo nuevo `campaignStatus: "approved" | "pending"` (sin valor por defecto; solo existe junto a `campaign`).

- Crear desde la campaña → `campaign`, `origin: "internal"`, `campaignStatus: "approved"`.
- Solicitud de un externo → `campaign`, `origin: "external"`, `campaignStatus: "pending"`; si quien la hace es el DM de esa campaña → `"approved"` directamente.
- Aprobar → `campaignStatus: "approved"`.
- Denegar, cancelar, quitar → `$unset: { campaign, origin, campaignStatus }`.
- Personajes ya existentes con `campaign` y sin `campaignStatus` cuentan como aprobados: toda consulta de «aprobados» usa `campaignStatus: { $ne: "pending" }`. No hace falta migración.
- Expulsar a un miembro también quita `campaignStatus` (se añade al `$unset` existente).

## 4. Reglas (puras)

`lib/CampaignRules.ts` gana `canRequestJoin(input): { ok: true } | { ok: false; error: string; field?: string }` con:

```ts
input: {
  campaign: { systemId: string; status: string; characters: { allowed: boolean; external: boolean }; restrictBooks: boolean; allowedBooks: string[] };
  character: { systemId: string; campaign: string | null; books: string[] }; // books = booksUsedBy(sheet)
  isMember: boolean;
}
```

Errores (texto exacto):
- no miembro → «No eres miembro de esta campaña.»
- campaña no activa → «Esta campaña no está activa.»
- otro sistema → «La campaña es de otro sistema de juego.»
- `!characters.allowed || !characters.external` → «Esta campaña no admite personajes creados fuera de ella.»
- ya en una campaña (aprobado o pendiente) → «Este personaje ya está en una campaña.»
- `restrictBooks` y algún libro del personaje fuera de `allowedBooks` → «Este personaje usa libros que la campaña no permite: <nombres>.» (los nombres los pone la ruta; la regla devuelve los ids en `disallowed: string[]`).

Los libros del personaje son los que **usa de verdad**: los `book` distintos de todas las referencias de su hoja (especie, legado, trasfondo, y en `levels` las clases, subclases y los valores de cada elección; objetos del inventario; `prepared` y `spellbookExtra`). Una función pura `booksUsedBy(sheet: Dnd2024SheetV2): string[]` en `lib/rules/dnd2024/` los recoge recorriendo los valores con `isRef`. `Character.books` no se usa para esto (puede estar vacío, que significa «todos»).

## 5. Acceso

- `loadCharacterFor(..., "read")`: un personaje **pendiente** solo lo leen su dueño y el DM de la campaña; el resto de miembros recibe 404. Uno aprobado lo leen todos los miembros (como hoy).
- Escritura de la hoja: solo el dueño (sin cambios).

## 6. API

Todas con sesión, `rateLimit("campaign_characters", userId, 60, 3600)`, respuestas de error `{ error }` con 400/403/404/409.

**Jugador (dueño del personaje)**
- `POST /api/characters/[id]/campaign` `{ campaignId }` → `canRequestJoin`; escritura condicional `{ _id, owner, campaign: { $exists: false } }` (409 «Este personaje ya está en una campaña.» si no coincide). Respuesta `{ status: "pending" | "approved" }`. Aviso al DM `character_import_request` (si no es el propio DM).
- `DELETE /api/characters/[id]/campaign` → saca o cancela (409 «Este personaje no está en ninguna campaña.» si no tiene; 409 «El personaje ha cambiado; recarga la página.» si el DM lo acaba de aceptar o quitar). Si estaba aprobado y el dueño no es el DM, aviso al DM `character_left` (texto «{who} ha sacado a {personaje} de {campaña}»); si estaba pendiente, sin aviso.

**DM**
- `POST /api/campaigns/[id]/characters/[characterId]/approve` → solo si está pendiente en esa campaña (si no, 409). Aviso al dueño `character_approved`.
- `POST /api/campaigns/[id]/characters/[characterId]/reject` → solo pendiente; `$unset`. Aviso al dueño `character_rejected`.
- `DELETE /api/campaigns/[id]/characters/[characterId]` → aprobado o pendiente; `$unset`. Aviso al dueño `character_removed` (si el dueño no es el DM).

Usan `requireDm` / `requireMember` de `lib/campaignApi.ts`.

## 7. Avisos

`lib/notificationText.ts` gana `character_approved`, `character_rejected`, `character_removed` (al jugador) y `character_left` (al DM), con textos:
- `character_import_request`: «{who} solicita unir a {personaje} a {campaña}» → `/campaigns/{id}/characters` (ya existe el tipo; ahora se emite).
- `character_approved`: «{who} ha aceptado a {personaje} en {campaña}» → `/campaigns/{id}/characters`.
- `character_rejected`: «{who} ha denegado a {personaje} en {campaña}» → `/characters/{id}`.
- `character_removed`: «{who} ha sacado a {personaje} de {campaña}» → `/characters/{id}`.
- `character_left`: «{who} ha sacado a {personaje} de {campaña}» → `/campaigns/{id}/characters`.

Preferencias de correo (`emailPrefFor`): `character_approved` → `invites`; `character_rejected` y `character_removed` → `removals`; `character_left` e `character_import_request` → `dm`. El nombre del personaje va en `text`. Los avisos pendientes de un personaje se borran al borrarlo (ya se hace por `character`). El `character_import_request` del DM se borra también cuando la solicitud se resuelve (aceptar, denegar, cancelar o quitar estando pendiente).

## 8. Interfaz

### 8.1 Campaña → Personajes

- Cabecera «Personajes» con dos botones a la derecha (como «Añadir» de Nivel20):
  - **Crear personaje**: si `characters.allowed && characters.internal`; lleva a `/characters/new?system=<sistema>&campaign=<id>` (el creador ya aplica los libros permitidos).
  - **Añadir personaje**: si `characters.allowed && characters.external`; abre un diálogo con los personajes del usuario del mismo sistema y sin campaña, cada uno con su estado de elegibilidad (los bloqueados, desactivados con el motivo de `canRequestJoin`); al elegir uno, `POST …/campaign`.
- Texto de ayuda breve bajo el título según lo que admita la campaña.
- Lista de tarjetas (una columna en móvil, cuadrícula en escritorio):
  - retrato redondo del personaje (`/api/images/<portraitId>`, o silueta) con el icono de estado (`StatusIcon`) en la esquina superior izquierda;
  - nombre en color de enlace (`text-brand-soft`) a `/characters/<id>`;
  - «Especie Clase N» (con multiclase: «Clase N / Clase M»);
  - nombre de usuario del jugador en texto (sin avatar), enlazado a su perfil;
  - sin etiqueta Interno/Externo.
- Pendientes: el dueño ve su tarjeta en gris (`grayscale opacity-60`) con «Pendiente de aprobación»; el DM la ve normal con un botón ✓ verde «Aceptar» y ✕ roja «Denegar»; el resto de miembros no la ve.
- Menú «⋮» por tarjeta (botón con `aria-haspopup="menu"`): DM → «Quitar de la campaña» (con confirmación); dueño → «Quitar de la campaña» o «Cancelar solicitud».
- Orden: pendientes primero (para el DM y el dueño), luego aprobados por fecha de creación.
- Tras una acción, la lista se refresca (`router.refresh()`), con mensaje de éxito o el error del servidor.

### 8.2 Ficha del personaje

En `SheetHeader`, para el dueño:
- sin campaña → **Unir a una campaña**: diálogo con sus campañas activas del mismo sistema, cada una con su elegibilidad; envía `POST …/campaign`;
- pendiente → texto «Pendiente de aprobación en <campaña>» y **Cancelar solicitud**;
- aprobado → enlace a la campaña y **Quitar de la campaña** (con confirmación).

### 8.3 Notificaciones

El DM ve los avisos nuevos en la campana y por correo según «Avisos del DM»; el jugador según «Invitaciones» y «Expulsiones».

## 9. Errores y casos límite

- Dos solicitudes a la vez del mismo personaje: la escritura condicional deja pasar solo una (409 la otra).
- El DM acepta una solicitud ya cancelada: 409 «La solicitud ya no está pendiente.»
- El jugador abandona la campaña o es expulsado: sus personajes (aprobados y pendientes) salen de ella.
- Campaña archivada: no admite solicitudes; los personajes siguen vinculados.
- El DM no puede tener «Aceptar/Denegar» sobre sus propios personajes porque se aprueban al momento.

## 10. Pruebas

- Unitarias: `canRequestJoin` con cada error y el caso válido; libros: con `restrictBooks` y un libro fuera → bloqueado con `disallowed`.
- Rutas (con mocks, como `tests/api/*`): solicitud (pendiente / aprobado si es DM / 409 en conflicto), cancelar, aprobar y denegar solo DM y solo pendientes, quitar; avisos emitidos con el tipo correcto; pendiente invisible para otro miembro en `loadCharacterFor`.
- Navegador (sesión del usuario, personajes de prueba propios que se borran al final): crear desde la campaña, añadir un personaje propio (el usuario es DM de su campaña → aprobado al momento), quitarlo desde la tarjeta y desde la ficha, tarjetas a 375 px. La aprobación de un jugador distinto del DM no se puede probar sin una segunda cuenta: se cubre con las pruebas de rutas.

## 11. Archivos

- Modificar: `lib/Character.ts`, `lib/CampaignRules.ts`, `lib/characterAccess.ts`, `lib/notificationText.ts`, `lib/Notification.ts` (enum), `app/api/characters/route.ts` (`campaignStatus: "approved"`), `app/api/campaigns/[id]/members/[userId]/route.ts` (`$unset campaignStatus`), `app/(main)/campaigns/[id]/(view)/characters/page.tsx`, `app/components/characters/sheet/SheetHeader.tsx`.
- Crear: `app/api/characters/[id]/campaign/route.ts`, `app/api/campaigns/[id]/characters/[characterId]/route.ts`, `…/approve/route.ts`, `…/reject/route.ts`, componentes `CampaignCharacterCard.tsx`, `AddCharacterDialog.tsx`, `JoinCampaignDialog.tsx`, y sus pruebas.
