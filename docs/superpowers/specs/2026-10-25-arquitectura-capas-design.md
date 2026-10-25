# Reorganización en capas (modelo, servidor, vista) — diseño

Fecha: 2026-10-25.

## 1. Objetivo

Roll2Go (Next.js 16.3, app router, Mongoose) tiene hoy 54 archivos sueltos en `lib/`, 46 componentes sueltos en `app/components/`, 63 rutas de API y unas 19 páginas que consultan Mongo directamente. El objetivo es una estructura por capas y por dominio, **sin cambiar el comportamiento**:

- **Modelo**: esquemas de Mongoose.
- **Servidor** («controlador»): lógica de servidor por dominio — consultas, permisos, avisos, escrituras condicionales. Las rutas de API y las páginas solo leen la petición, llaman a esta capa y responden o pintan.
- **Reglas**: lógica pura de juego (`lib/rules`), sin Next ni Mongo.
- **Vista**: componentes de React por dominio.

Éxito: misma funcionalidad, pruebas, `tsc` y `eslint` en verde en cada commit; ningún archivo de `app/` importa un modelo de Mongoose ni llama a `connectDB`; cada carpeta tiene un único propósito.

Fuera de alcance: cambios de comportamiento o de interfaz, cambiar de ORM, cambiar las URL públicas o las rutas de API.

## 2. Estructura de destino

### 2.1 `lib/models/` (modelo)

Todos los modelos de Mongoose y la conexión: `User`, `Campaign`, `CampaignImage`, `CampaignInvite`, `CampaignLogEntry`, `Character`, `Book`, `BookEntry`, `HomebrewEntry`, `ForumPost`, `ForumReaction`, `Friendship`, `Message`, `Notification`, `Block`, `BannedEmail`, y `mongodb.ts` (`connectDB`). Un `index.ts` no es obligatorio; se importan por archivo (`@/lib/models/Character`).

### 2.2 `lib/server/<dominio>/` (servidor)

Solo se importa desde código de servidor (rutas, páginas, server actions); cada archivo empieza con `import "server-only"` (el paquete ya lo trae Next; si no, se añade como dependencia).

| dominio | contenido actual que se mueve | servicios nuevos (ejemplos) |
| --- | --- | --- |
| `auth` | `auth.ts`, `currentUser.ts`, `verification.ts`, `ban.ts` | — |
| `account` | `accountCleanup.ts`, `userProfile.ts`, `userCards.ts`, `images.ts` | `updateProfile`, `deleteAccount` |
| `campaigns` | `campaignAccess.ts`, `campaignApi.ts`, `campaignContext.ts`, `campaignEligibility.ts`, `campaignInput.ts`, `CampaignRules.ts`, `joinCampaign.ts`, `members.ts`, `logInput.ts` | `listCampaignCharacters`, `campaignOverview`, `listLogEntries`, `listMembers` |
| `characters` | `characterAccess.ts` | `listMyCharacters`, `loadSheetPage`, `loadLevelUpPage`, `loadCreatorPage` |
| `forum` | `forum.ts`, `forumData.ts` | `listPosts`, `loadPost` |
| `notifications` | `notify.ts`, `notifyMail.ts`, `notificationText.ts`, `mail.ts` | `listNotifications` |
| `social` | `friends.ts`, `blocks.ts` | `listConversations`, `loadThread`, `socialOverview` |
| `books` | `bookAccess.ts` | — |
| `admin` | `adminApi.ts` | `listUsers` |
| `chat` | `rolAssistant.ts` | — |

`lib/rules/catalog.ts` y `lib/rules/books.ts` tocan Mongo: pasan a `lib/server/catalog/` (ver §2.4), y `lib/rules` queda puro.

### 2.3 `lib/utils/`

Utilidades sin dominio, válidas en cliente y servidor salvo que se diga: `bbcode.ts`, `timeAgo.ts`, `utils.ts`, `icons.ts`, `systems.ts`, `unchangedFilter.ts` (servidor), `rateLimit.ts` (servidor).

### 2.4 `lib/rules/` (reglas, puro)

- `lib/rules/types.ts`, `schemas.ts`, `i18n/`, `import/` se quedan.
- `catalog.ts`, `books.ts`, `pickBooks.ts`, `spellRows.ts`, `migrateBookIds.ts`: lo que consulta Mongo va a `lib/server/catalog/`; lo puro (`pickBooks`, la forma de `SpellRow`) se queda en `lib/rules/catalog/`.
- `lib/rules/dnd2024/` se divide en subcarpetas:
  - `sheet/`: `sheet.ts`, `upgrade.ts`, `equipmentRefs.ts`, `edits.ts`, `inventory.ts`, `sheetEntries.ts`, `labels.ts`, `alignments.ts`, `statTexts.ts`;
  - `creation/`: `validate.ts` (partido, §2.5), `recreate.ts`, `assign.ts`, `abilities.ts`, `rolls.ts`, `names.ts`, `booksUsed.ts`;
  - `levels/`: `levels.ts` (partido, §2.5), `validateLevel.ts`, `levelOps.ts`, `featureChoices.ts`, `masteries.ts`;
  - `spells/`: `spellcasting.ts`, `spellcastingModes.ts`, `spellOps.ts`, `spellText.ts`, `spellTextClient.ts`, `spellFilters.ts`, `spellPicks.ts`, `featSpells.ts`;
  - `derive/`: sin cambios.

### 2.5 Archivos que se parten

- `lib/rules/dnd2024/validate.ts` (842 líneas) → `creation/validateSheet.ts` (entrada), `creation/checkChoices.ts`, `creation/checkSpells.ts`, `creation/checkFeatSpells.ts`; las funciones exportadas mantienen nombre y firma.
- `lib/rules/dnd2024/levels.ts` (565 líneas) → `levels/pendingChoices.ts` (entrada), `levels/held.ts` (`heldFeats`, `heldPicks`, `heldOptionalFeatures`, `heldArcana`, `heldBonusSpells`…), `levels/spellPending.ts`.
- Ningún archivo de `lib/` nuevo pasa de ~400 líneas.

### 2.6 `app/components/<dominio>/` (vista)

| carpeta | componentes |
| --- | --- |
| `ui/` | `Avatar`, `Pagination`, `ConfirmAction`, `LocalDate`, `PasswordInput`, `RoundIcon`, `UserLink`, `formStyles.ts`, `useDismiss.ts`, `Bbcode`, `BbcodeEditor`, `DiceRoller` |
| `layout/` | `Navbar`, `UserMenu`, `SettingsNav`, `AuthShell`, `SystemsGrid` |
| `auth/` | `LoginForm`, `RegisterForm`, `ForgotPasswordForm`, `ResetPasswordForm`, `VerifyConfirm`, `VerifyPending` |
| `account/` | `AccountForms`, `ProfileForm`, `ProfileCard`, `DeleteAccountForm`, `NotificationPrefsForm` |
| `admin/` | `AdminUserActions`, `AnnouncementForm` |
| `campaigns/` | `CampaignForm`, `CampaignTabs`, `CampaignInvites`, `DeleteCampaign`, `ExpelMember`, `InviteFriends`, `InviteLink`, `JoinButton`, `LogEntryForm`, y los actuales `AddCharacterDialog`, `CampaignCharacterCard`, `CharacterActions` |
| `forum/` | `ForumMessage`, `ForumPostForm`, `Reactions` |
| `notifications/` | `NotificationBell`, `NotificationItem`, `NotificationList` |
| `social/` | `FriendActions`, `UserSearch`, `ChatThread` |
| `chat/` | `ChatAssistant`, `OpenAssistantButton` |
| `characters/` | se mantiene con sus subcarpetas (`fields`, `levelup`, `sheet`, `spells`) y gana `creator/` (`CharacterCreator`, `AbilityScores`, `ClassFeaturesSection`, `NameGeneratorButton`, `NewCharacterDialog`, `CharacterSummary`, `RuleSelect`) y `hooks/` (`useCatalogEntries`, `useSpellLists`) |

`app/components/proxy.ts` se revisa (si es el `proxy` de Next 16 debe estar en la raíz; si no, a `lib/utils`).

## 3. Rutas y páginas finas

- Ninguna página ni ruta importa `@/lib/models/*` ni llama a `connectDB`: piden los datos a `lib/server/<dominio>` (p. ej. `app/(main)/campaigns/[id]/(view)/characters/page.tsx` llama a `listCampaignCharacters(session, campaignId)` y solo pinta).
- Las rutas de API mantienen su forma: sesión → `rateLimit` → validar entrada → servicio → respuesta. La lógica de permisos, escrituras condicionales y avisos vive en el servicio.
- Los servicios devuelven datos planos (no documentos de Mongoose) y errores tipados (`{ ok: false, status, error }`) que la ruta traduce a respuesta.
- Una regla de ESLint (`no-restricted-imports`) impide importar `@/lib/models/*` y `@/lib/models/mongodb` desde `app/**`, y `@/lib/server/*` desde componentes cliente (`"use client"`) —esto último se comprueba con `server-only` en tiempo de compilación.

## 4. Proceso

1. **Mover sin cambiar lógica**, por capas, con un commit por paso: modelos → utilidades → servidor → reglas → componentes. Cada paso actualiza todos los imports (`@/…`) y deja pruebas, `tsc` y `eslint` en verde. Las pruebas se mueven a una estructura paralela (`tests/server/…`, `tests/rules/…`) si hace falta.
2. **Partir** `validate.ts` y `levels.ts` sin cambiar exportaciones.
3. **Extraer servicios** dominio a dominio desde las páginas y rutas, con pruebas de cada servicio (mocks de modelos como en `tests/api/*`).
4. **Activar** la regla de ESLint del §3 cuando ya no haya importaciones prohibidas.
5. **Comprobar en el navegador** las páginas principales (inicio, mis personajes, ficha, creador, subir de nivel, campaña y sus pestañas, foro, social, mensajes, notificaciones, ajustes, admin) como el usuario, sin modificar datos.

Todo en una rama `refactor/capas`; el usuario no debe tocar el repositorio mientras dure.

## 5. Riesgos

- **Imports rotos** en archivos poco usados: `tsc` y `next build` (además de las pruebas) en cada paso.
- **Código de servidor en el cliente**: `server-only` lo convierte en error de compilación.
- **Caché y `revalidateTag`**: las funciones con `unstable_cache` y sus etiquetas se mueven sin cambiar claves.
- **Rutas de Next** (`app/`, `proxy`/`middleware`) no se mueven: solo cambia lo que importan.

## 6. Pruebas

- Toda la suite, `tsc`, `eslint` y `next build` en verde en cada commit.
- Pruebas nuevas para cada servicio extraído (permisos y casos de error principales).
- Comprobación en el navegador del §4.5.
