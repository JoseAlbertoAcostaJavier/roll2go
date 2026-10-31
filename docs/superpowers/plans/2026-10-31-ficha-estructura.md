# Rework de la ficha, fase 1 (estructura) — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sustituir la pestaña «Información» por una estructura de ficha inspirada en la disposición de D&D Beyond (franja superior, columnas fijas y panel de pestañas), con el tema oscuro de Roll2Go, descansos en la cabecera y ataques con alcance e iconos.

**Architecture:** La lógica nueva va en módulos puros de `lib/rules` y `lib/utils` (alcance y tipo de los ataques, mapa de pestañas, iconos) con pruebas; `InfoTab.tsx` se parte en componentes pequeños de `app/components/characters/sheet/` que la página monta en una rejilla responsiva.

**Tech Stack:** Next.js 16.3 (app router), React, TypeScript, Tailwind 4, Mongoose 9, vitest.

**Spec:** `docs/superpowers/specs/2026-10-31-ficha-estructura-design.md`

## Global Constraints

- Rama `feat/ficha-estructura` desde `main`; un commit por tarea; mensajes en español con `Co-Authored-By`. Sin push.
- Interfaz y comentarios en español, con el estilo del código que rodea.
- Se toma solo la **disposición** de D&D Beyond: tema oscuro, colores, tipografía y estilos de tarjeta de Roll2Go (`card`, `cardTitle`, `statButton`); ningún recurso ni texto de D&D Beyond.
- Regla de capas (ESLint): `lib/rules` y `lib/utils` sin `lib/server`, `lib/models`, mongoose ni next; `app/components/**` sin `lib/server`.
- En verde en cada commit: `npx vitest run`, `npx tsc --noEmit` (ignorar `.next/`), `npx eslint app lib tests scripts`; `npx next build` en la última tarea de código (con el servidor de desarrollo parado).
- Antes de usar una API de Next, leer `node_modules/next/dist/docs/`.
- La impresión sigue funcionando: los botones que muestran valores llevan `data-print="text"`, como hoy.
- Sin desplazamiento horizontal de página a 375, 768 y 1440 px.

## Review Focus

- Un personaje sin conjuros abre `?tab=conjuros`: debe caer en Acciones, no en una pestaña vacía (Task 4).
- Un visitante que no es el dueño no ve los botones de descanso ni puede curar/dañar (Task 3 y Task 5: los componentes reciben `isOwner`).
- Un arma sin `range` en el catálogo (sin reimportar) no rompe la tabla: el alcance a distancia sale «—» (Task 2).
- El ataque sin armas no tiene objeto: `kind` «melee», alcance «1,5 m», `damageTypeId` «bludgeoning» (Task 2).
- El descanso largo con PG actuales por debajo del máximo y temporales > 0 deja la ficha con PG al máximo y 0 temporales (Task 3).

---

### Task 1: Iconos nuevos

**Files:**
- Move: `public/assets/icons/Dark Mode/**` → `public/assets/icons/dark/**` (renombrados, §2 de la spec)
- Modify: `lib/utils/icons.ts`
- Create: `app/components/ui/MaskIcon.tsx`
- Test: `tests/icons.test.ts`

**Interfaces:**
- Produces: `IconKind` gana `"damageType" | "weaponType" | "darkSchool" | "action" | "condition" | "environment"`. `iconSrc("damageType", "fire")` → `/assets/icons/dark/damage-types/fire.svg`; `iconSrc("weaponType", "melee" | "ranged")`; `iconSrc("darkSchool", "V")` → `/assets/icons/dark/schools/evocation.svg`; `iconSrc("action", "opportunity-attack")`; `iconSrc("condition", "blinded")`; `iconSrc("environment", "bright-light")`. Ids desconocidos → `null`.
- Produces: `MaskIcon({ src, size = 16, label, className }: { src: string | null; size?: number; label?: string; className?: string })` — `span` con `bg-current` y máscara; con `label`, `role="img"` y `aria-label`; sin él, `aria-hidden`. `src` null → no pinta nada.

- [ ] **Step 1:** mover y renombrar los 65 archivos con `git mv` no aplica (no están versionados): moverlos con un script de Node en el scratchpad a los nombres de §2 (minúsculas, espacios → guiones; `Quick Interation` → `quick-interaction`, `Offfhand Attack` → `offhand-attack`, `Enviroment Effects` → `environment`, `Weapon Type/Melee Weapon` → `weapon-types/melee`, `Ranged Weapon` → `ranged`, `schools (Without Background)` → `schools`). Borrar la carpeta vacía `Dark Mode`.
- [ ] **Step 2: Pruebas que fallan** en `tests/icons.test.ts`: las rutas de arriba y que existen en disco los 13 tipos de daño, las 8 escuelas (letras `ACDEVINT`), `melee`/`ranged`, los 14 estados del Manual 2024 más `exhaustion`, y `iconSrc("damageType", "banana")` → `null`.
- [ ] **Step 3:** `npx vitest run tests/icons.test.ts` → FAIL.
- [ ] **Step 4:** implementar `iconSrc` y `MaskIcon`; `StatusIcon` puede usar `MaskIcon` si queda igual.
- [ ] **Step 5:** pasan; vitest, tsc y eslint en verde.
- [ ] **Step 6: Commit** `feat(iconos): iconos de tipos de daño, armas, escuelas, acciones y estados` (con los SVG).

### Task 2: Alcance y tipo de los ataques

**Files:**
- Modify: `lib/rules/types.ts` (`ItemData.weapon.range?: string`)
- Modify: `lib/rules/import/normalize.ts` (`normalizeItem`: `range` de 5etools tal cual, p. ej. `"20/60"`)
- Modify: `lib/rules/dnd2024/derive/attacks.ts` (`Attack`, `weaponAttack`, `unarmedAttack`)
- Modify: `README.md` («Despliegue»: reimportar para ver el alcance de las armas)
- Test: `tests/dnd2024/derive/attacks.test.ts`, `tests/rules/normalize.test.ts`

**Interfaces:**
- Produces: `Attack` gana `kind: "melee" | "ranged"`, `range: string`, `damageTypeId: string`.
  - `kind`: `"ranged"` si `ItemData.type === "R"`; si no, `"melee"`; ataque sin armas `"melee"`.
  - `range`: cuerpo a cuerpo `"1,5 m"` (`"3 m"` con la propiedad Alcance, código `R`); a distancia `"{normal}/{largo} m"` convertido con la misma conversión que `metersText` (20/60 pies → `"6/18 m"`); arrojadiza (propiedad `T`) cuerpo a cuerpo: `"1,5 m · 6/18 m"`; a distancia sin `range` en el catálogo: `"—"`.
  - `damageTypeId`: la clave inglesa en minúsculas (`"slashing"`); los códigos de 5etools (`S`, `P`, `B`…) se traducen con el mapa de códigos que ya existe en `labels.ts` (`DAMAGE_CODE_NAMES`, exportar si hace falta una versión código → clave inglesa).

- [ ] **Step 1: Pruebas que fallan:** espada larga (`kind` melee, `"1,5 m"`, `slashing`), arco largo (`ranged`, `"45/180 m"` para 150/600), daga (`"1,5 m · 6/18 m"`, `piercing`), alabarda (`"3 m"`), ataque sin armas (`melee`, `"1,5 m"`, `bludgeoning`), ballesta ligera sin `range` → `"—"`; `normalizeItem` con `range: "20/60"` guarda `weapon.range === "20/60"`.
- [ ] **Step 2:** `npx vitest run tests/dnd2024/derive/attacks.test.ts tests/rules/normalize.test.ts` → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** pasan; vitest, tsc y eslint en verde.
- [ ] **Step 5: Commit** `feat(ficha): alcance, tipo y clave del tipo de daño de los ataques`

### Task 3: Descansos en la cabecera

**Files:**
- Modify: `lib/rules/dnd2024/spells/spellOps.ts:137` (`longRest`)
- Modify: `lib/server/characters/sheetEdits.ts:123` (campos de `longRest`: añadir `hp`)
- Create: `app/components/characters/sheet/RestButtons.tsx`
- Modify: `app/components/characters/sheet/SheetHeader.tsx` (monta `RestButtons`)
- Modify: `app/components/characters/spells/SlotsBar.tsx`, `SpellsTab.tsx` (quitar `onLongRest`, `onShortRest`, `restores` y sus botones)
- Modify: `app/(main)/characters/[id]/page.tsx` (pasa lo que necesita `RestButtons`)
- Test: `tests/dnd2024/spells/spellOps.test.ts`

**Interfaces:**
- Produces: `longRest` devuelve la hoja con `slotsUsed: {}`, `limitedUsed: {}`, `hp: { ...hp, current: null, temp: 0 }`.
- Produces: `RestButtons({ characterId, shortRestRestores }: { characterId: string; shortRestRestores: boolean })` — solo se monta si `isOwner`. Llama a `POST /api/characters/[id]/spells` con `{ op: "longRest" }` / `{ op: "shortRest" }` (la ruta existente), muestra un diálogo de confirmación (patrón de diálogo de la ficha) y hace `router.refresh()` al terminar. `shortRestRestores` se calcula en la página con la misma lógica que hoy usa `SpellsTab` para `restores.short` (moverla a una función pura de `lib/rules/dnd2024/spells` si está en el componente).
- Textos exactos: botones «Descanso corto» y «Descanso largo»; confirmación larga «¿Hacer un descanso largo? Recuperas todos los puntos de golpe y los espacios de conjuro.»; corta «¿Hacer un descanso corto? Recuperas los espacios y usos que se recuperan con un descanso corto.»; sin nada que recuperar: «No tienes nada que se recupere con un descanso corto.» con solo «Cerrar».

- [ ] **Step 1: Pruebas que fallan:** `longRest` con `hp: { max: null, current: 3, temp: 4 }` → `current: null`, `temp: 0`, y conserva lo que ya comprobaban las pruebas de `longRest`; la ruta (`tests/server/characters.test.ts` si cubre `sheetEdits`) guarda `hp`.
- [ ] **Step 2:** `npx vitest run tests/dnd2024/spells/spellOps.test.ts` → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** pasan; vitest, tsc y eslint en verde.
- [ ] **Step 5: Commit** `feat(ficha): descanso corto y largo en la cabecera`

### Task 4: Pestañas nuevas

**Files:**
- Modify: `app/components/characters/sheet/SheetTabs.tsx` (`SHEET_TABS`)
- Create: `lib/rules/dnd2024/sheet/sheetTabs.ts` (`normalizeSheetTab`)
- Modify: `app/(main)/characters/[id]/page.tsx` (usa `normalizeSheetTab`)
- Test: `tests/dnd2024/sheet/sheetTabs.test.ts`

**Interfaces:**
- Produces: `type SheetTabId = "acciones" | "conjuros" | "inventario" | "rasgos" | "trasfondo"`; `normalizeSheetTab(raw: unknown, available: SheetTabId[]): SheetTabId` — `"info"` → `"acciones"`, `"equipo"` → `"inventario"`, desconocida o no disponible → `"acciones"`.
- `SHEET_TABS` en este orden y con estas etiquetas: Acciones, Conjuros, Inventario, Rasgos y dotes, Trasfondo (iconos lucide a elección, como hoy). `SheetTab` = `SheetTabId`.
- En esta tarea, «Acciones» muestra el `InfoTab` actual sin cambios (lo reparte la Task 5) e «Inventario» el `EquipmentTab`.

- [ ] **Step 1: Pruebas que fallan:** los cuatro casos de arriba y `normalizeSheetTab("conjuros", ["acciones","inventario","rasgos","trasfondo"])` → `"acciones"`.
- [ ] **Step 2:** `npx vitest run tests/dnd2024/sheet/sheetTabs.test.ts` → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** pasan; vitest, tsc y eslint en verde.
- [ ] **Step 5: Commit** `feat(ficha): pestañas Acciones, Conjuros, Inventario, Rasgos y dotes, Trasfondo`

### Task 5: Estructura de la página

**Files:**
- Create en `app/components/characters/sheet/`: `useStatDialog.ts`, `AbilityStrip.tsx`, `SavesBox.tsx`, `SensesBox.tsx`, `ProficienciesBox.tsx`, `SkillsBox.tsx`, `CombatBox.tsx`, `DefensesBox.tsx`, `SheetLayout.tsx`, `ActionsTab.tsx`
- Delete: `app/components/characters/sheet/InfoTab.tsx` (su contenido se reparte; `InfoData` pasa a `SheetData` en `SheetLayout.tsx` o en un `types.ts` de la carpeta)
- Modify: `app/(main)/characters/[id]/page.tsx`

**Interfaces:**
- Consumes: `normalizeSheetTab` y `SHEET_TABS` (Task 4), `RestButtons` en la cabecera (Task 3).
- Produces: `useStatDialog()` → `{ open, show(stat) (e) => void, close, detail(stat) }` con el `Stat` y el `detail` que hoy viven en `InfoTab`, y el `StatDialog` montado por quien lo use (un único diálogo en `SheetLayout`, que pasa `show` a las cajas).
- Produces: `SheetLayout({ d, characterId, isOwner, tabs, children })` — `children` es el panel de pestañas que pinta la página; maqueta §4.2 y §4.4 de la spec (1280 px: tres columnas; 768–1279: dos; < 768: una, en el orden de §4.4).
- Produces: `ActionsTab({ attacks }: { attacks: Attack[] })` — de momento la tabla de ataques de `InfoTab` tal cual (la Task 6 la amplía).
- Pasiva = 10 + bonificador de Percepción, Investigación y Perspicacia; visión en la oscuridad con `distanceText` si hay.
- Las cajas usan `card`/`cardTitle`/`statButton` y mantienen `aria-haspopup="dialog"` y `data-print="text"` en los botones de desglose; `HpEditor` dentro de `AbilityStrip` recibe lo mismo que hoy.

- [ ] **Step 1:** implementar los componentes moviendo el JSX y la lógica de `InfoTab` sin cambiar comportamiento; la página monta `SheetLayout` con el panel de pestañas dentro.
- [ ] **Step 2:** vitest, tsc y eslint en verde (no hay lógica nueva pura que probar; si `detail()` se mueve a una función pura, añadir su prueba).
- [ ] **Step 3: Commit** `feat(ficha): estructura en franja superior, columnas y panel de pestañas`

### Task 6: Tabla de ataques con alcance e iconos

**Files:**
- Modify: `app/components/characters/sheet/ActionsTab.tsx`

**Interfaces:**
- Consumes: `Attack.kind`, `range`, `damageTypeId` (Task 2); `iconSrc("weaponType" | "damageType")` y `MaskIcon` (Task 1).
- Columnas en este orden y con estas cabeceras: **Ataque** (icono `weaponType` con `label` «Cuerpo a cuerpo» / «A distancia» + nombre + maestría si la tiene), **Alcance**, **Golpe** (+N con signo), **Daño** (dados + icono `damageType` con `label` = `damageType` en español), **Notas** (propiedades unidas con «, »). La tabla se desplaza en horizontal dentro de su caja en móvil.

- [ ] **Step 1:** implementar; vitest, tsc, eslint y `npx next build` (con el servidor de desarrollo parado) en verde.
- [ ] **Step 2: Commit** `feat(ficha): ataques con alcance e iconos de arma y de tipo de daño`

### Task 7: Comprobación en el navegador (controlador)

- [ ] Reimportar los libros (`npm run import:5etools -- --data <carpeta data>`), reiniciar el servidor y borrar `.next/cache`, con permiso del usuario (base de Atlas compartida).
- [ ] Con un personaje de prueba propio (borrado al terminar): 1440, 768 y 375 px (`resize_window`), estructura y orden; desgloses; curar/dañar; descanso largo (PG al máximo) y corto; pestañas y `?tab=info`, `?tab=equipo`, `?tab=conjuros` sin conjuros; tabla de ataques con iconos y alcance; vista de impresión. Sin desplazamiento horizontal (`document.documentElement.scrollWidth <= innerWidth`).
