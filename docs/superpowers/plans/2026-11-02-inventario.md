# Inventario: tabla, búsqueda, filtros y contenedores — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La pestaña Inventario pasa a una tabla con búsqueda, chips de filtro, peso cargado y contenedores con su capacidad importada de 5etools.

**Architecture:** El importador guarda `ItemData.container`; las reglas puras (`edits.ts`, `inventory.ts`, un módulo nuevo `inventoryTable.ts`) añaden la operación `move`, el peso por contenedor y el filtrado; la página arma la información de cada línea y `EquipmentTab` la pinta repartida en componentes más pequeños.

**Tech Stack:** Next.js 16.3, React, TypeScript, Tailwind 4, vitest.

**Spec:** `docs/superpowers/specs/2026-11-02-inventario-design.md`

## Global Constraints

- Rama `feat/inventario` desde `main`; un commit por tarea; mensajes en español con `Co-Authored-By`. Sin push.
- Regla de capas: `lib/rules` sin `lib/server`, `lib/models`, mongoose ni next; `app/components/**` sin `lib/server`.
- En verde en cada commit: `npx vitest run`, `npx tsc --noEmit`, `npx eslint app lib tests scripts`. `next build` lo ejecuta el controlador.
- Textos exactos: «Peso cargado», «Supera la capacidad de carga», «Buscar por nombre, tipo, rareza o propiedades», chips «Todo», «Equipado», «Otras posesiones», columnas «Activo · Nombre · Peso · Cant. · Coste · Notas», sección «Equipo», «Sobrecargado», «No cuenta para el peso cargado», «Mover a…», «Sin objetos.»; errores «Ese objeto no es un contenedor.», «Un contenedor no puede ir dentro de otro.», «Ese objeto no está en el inventario.», «Petición no válida.».
- Pesos en lb con kg entre paréntesis (`weightText` de `EquipmentTab`); coste en po (el catálogo guarda pc).
- Sin desplazamiento horizontal de la página a 375 px (la tabla se desplaza dentro de su caja); al imprimir, todas las secciones y sin buscador, chips, selectores ni botones.

## Review Focus

- Hoja antigua sin `container` en ninguna línea: todo en «Equipo» y el mismo peso que antes (Task 2).
- Antes de reimportar ningún objeto es contenedor: sin chips de contenedor ni selector «Mover a…», y las líneas que ya estuvieran dentro de un contenedor cuentan como sueltas (Task 2 y 3, `effectiveContainer`).
- Quitar un contenedor con cosas dentro: el contenido vuelve a «Equipo» y sigue contando para el peso (Task 2).
- `?seccion=` con el id de un contenedor ya quitado → «Todo» (Task 3).
- «arrojadiza» encuentra un arma con la propiedad «Arrojadiza»; «pocion» encuentra «Poción de curación» (Task 3).

---

### Task 1: Capacidad de los contenedores en el catálogo

**Files:**
- Modify: `lib/rules/types.ts` (`ContainerData`, `ItemData.container?`)
- Modify: `lib/rules/schemas.ts` (forma de `item`: `"container?"`)
- Modify: `lib/rules/import/normalize.ts` (`normalizeItem` lee `containerCapacity`)
- Modify: `README.md` («Despliegue»: «Tras desplegar el inventario: vuelve a ejecutar `npm run import:5etools -- --data <carpeta data de 5etools>` para tener la capacidad de mochilas, bolsas y cofres, y reinicia el servidor.»)
- Test: `tests/rules/normalize.test.ts`, `tests/rules/schemas.test.ts`

**Interfaces:**
- Produces: `export type ContainerData = { weight: number | null; volume: number | null; items: { ref: Ref; count: number }[]; weightless: boolean }` y `ItemData.container?: ContainerData`.

- [ ] **Step 1: Pruebas que fallan** (`normalizeItem` con `containerCapacity` de 5etools):
  - Mochila `{ weight: [30] }` → `{ weight: 30, volume: null, items: [], weightless: false }`.
  - Bolsa de contención `{ weight: [500], weightless: true }` → `weight: 500, weightless: true`.
  - Mochila práctica de Heward `{ weight: [200, 200, 500], weightless: true }` → `weight: 900`.
  - Cofre `{ volume: [12] }` → `{ weight: null, volume: 12, … }`.
  - Estuche de virotes `{ item: [{ "bolt|xphb": 20 }] }` → `items: [{ ref: <ref de objeto "bolt|xphb">, count: 20 }]` (la ref se construye como las de `packContents`, con `BOOK_PLACEHOLDER`).
  - Frasco `{ volume: [0.0625] }` (solo volumen < 1) → sin `container`; objeto sin `containerCapacity` → sin `container`.
  - `validateEntryData("item", …)` acepta un objeto con `container` y rechaza `container: { weight: "30" }`.
- [ ] **Step 2:** `npx vitest run tests/rules` → FAIL.
- [ ] **Step 3:** implementar. Las refs de `container.items` deben resolverse a su libro en la importación igual que las de `contents`: localizar dónde se sustituye `BOOK_PLACEHOLDER` en `contents` y tratar `container.items` del mismo modo (si la sustitución es genérica, no hay que tocar nada; añadir una prueba que lo demuestre).
- [ ] **Step 4:** verde (vitest, tsc, eslint).
- [ ] **Step 5: Commit** `feat(inventario): capacidad de los contenedores en el catálogo`

### Task 2: Mover a contenedores y peso cargado

**Files:**
- Modify: `lib/rules/dnd2024/sheet/sheet.ts` (`InventoryItem.container?: string | null`, comentado: id de la línea contenedora; sin campo = suelto)
- Modify: `lib/rules/dnd2024/sheet/edits.ts` (op `move`; `remove` y `update equipped` según abajo)
- Modify: `lib/rules/dnd2024/sheet/inventory.ts` (`inventoryWeights`, `effectiveContainer`)
- Modify: `lib/rules/dnd2024/derive/weight.ts` (`carriedWeight` usa `inventoryWeights`, para que la franja y la pestaña den el mismo total)
- Modify: `app/api/characters/[id]/inventory/route.ts` (solo el comentario: añade `move`)
- Test: `tests/dnd2024/sheet/edits.test.ts`, `tests/dnd2024/sheet/inventory.test.ts`, el test existente de `carriedWeight`

**Interfaces:**
- Consumes: `ItemData.container` (Task 1).
- Produces:
  - `InventoryOp` gana `{ op: "move"; id: string; container: string | null }`.
  - `export type WeightInfo = { weight: number; container: { weightless: boolean } | null }`.
  - `export function effectiveContainer(line: InventoryItem, items: InventoryItem[], info: Record<string, WeightInfo | undefined>): string | null` — el id del contenedor solo si existe esa línea y su `info` tiene `container`; si no, `null` (suelta).
  - `export function inventoryWeights(items: InventoryItem[], info: Record<string, WeightInfo | undefined>): { carried: number; byContainer: Record<string, number> }` — `byContainer[id]` = peso × cantidad del contenido de cada contenedor efectivo (también los vacíos, con 0); `carried` = líneas sueltas + contenido de los contenedores no `weightless`. Redondeo a 2 decimales como hoy.

- [ ] **Step 1: Pruebas que fallan:**
  - `move` a una mochila → la línea gana `container: <id mochila>` y `equipped: false` aunque estuviera equipada.
  - `move` con `container: null` → la línea queda sin campo `container`.
  - `move` a una línea sin datos de contenedor → «Ese objeto no es un contenedor.»; a una línea inexistente o con `id` inexistente → «Ese objeto no está en el inventario.»; `container: 5` → «Petición no válida.».
  - `move` de una mochila a otra mochila, o a sí misma → «Un contenedor no puede ir dentro de otro.».
  - `remove` de la mochila con dos líneas dentro → ambas quedan sin `container`.
  - `update` con `equipped: true` de una espada dentro de la mochila → equipada y sin `container`.
  - `inventoryWeights`: mochila (5 lb) con raciones 2 × 2 lb y cuerda 5 lb sueltas → `carried 14`, `byContainer { mochila: 4 }`; bolsa de contención (15 lb, `weightless`) con 10 lb dentro → cuenta 15, `byContainer` 10; línea con `container` de una línea que ya no existe o que no es contenedor → suelta; hoja sin ningún `container` → mismo total que la suma simple.
  - `carriedWeight` con una bolsa de contención llena da el total sin su contenido.
- [ ] **Step 2:** `npx vitest run tests/dnd2024` → FAIL.
- [ ] **Step 3:** implementar. Un contenedor es una línea cuyo objeto del catálogo (vía `resolveItem`) tiene `container`.
- [ ] **Step 4:** verde.
- [ ] **Step 5: Commit** `feat(inventario): mover objetos a contenedores y peso cargado`

### Task 3: Búsqueda, chips y secciones (módulo puro)

**Files:**
- Create: `lib/rules/dnd2024/sheet/inventoryTable.ts`
- Modify: `lib/rules/dnd2024/sheet/labels.ts` (`itemTypeName`, `rarityName`)
- Test: `tests/dnd2024/sheet/inventoryTable.test.ts`, `tests/dnd2024/sheet/labels.test.ts`

**Interfaces:**
- Consumes: `effectiveContainer`, `inventoryWeights`, `WeightInfo` (Task 2); `parseSection`, `sectionHref` (`sheetSections.ts`); `weaponPropertyName` (`labels.ts`).
- Produces:
  - `itemTypeName(code: string): string` — códigos de tipo de 5etools: `M` «Arma cuerpo a cuerpo», `R` «Arma a distancia», `A` «Munición», `LA` «Armadura ligera», `MA` «Armadura intermedia», `HA` «Armadura pesada», `S` «Escudo», `G` «Equipo de aventurero», `AT` «Herramientas de artesano», `T` «Herramienta», `GS` «Juego», `INS` «Instrumento musical», `SCF` «Canalizador mágico», `P` «Poción», `SC` «Pergamino», `RD` «Vara», `RG` «Anillo», `WD` «Varita», `FD` «Comida y bebida», `TG` «Bien comercial», `MNT` «Montura», `TAH` «Arreos», `VEH` «Vehículo», `EXP` «Explosivo», `$G` «Gema», `$A` «Objeto de arte»; desconocido u `OTH` → «Objeto».
  - `rarityName(id: string): string` — `common` «Común», `uncommon` «Poco común», `rare` «Raro», `very rare` «Muy raro», `legendary` «Legendario», `artifact` «Artefacto», `varies` «Variable»; desconocido → tal cual.
  - `export type ContainerInfo = { weight: number | null; text: string | null; weightless: boolean }` — `text` es la capacidad que no va en peso: «12 pies cúbicos» o «20 × Virote» (formato con «×» para no inventar plurales; la página lo compone).
  - `export type ItemInfo = WeightInfo & { equippable: boolean; nameEn: string | null; type: string | null; rarity: string | null; properties: string[]; value: number; container: ContainerInfo | null }` (`value` en pc; `properties` son códigos de 5etools). `ItemInfo` pasa a vivir aquí; `EquipmentTab` lo reexporta para la página.
  - `searchText(s: string): string` — minúsculas y sin tildes (`normalize("NFD")` sin marcas).
  - `matchesItem(line: InventoryItem, info: ItemInfo | undefined, q: string): boolean` — `q` vacío → `true`; si no, busca en el nombre, `nameEn`, `itemTypeName(type)`, `rarityName(rarity)` y `weaponPropertyName` de cada propiedad.
  - `inventoryChips(items, info): { id: string; label: string }[]` — `todo` «Todo», `equipado` «Equipado», un chip por línea contenedora (id de la línea, nombre de la línea) en el orden del inventario, `otras` «Otras posesiones».
  - `export type InventoryGroup = { id: string; title: string; lines: InventoryItem[]; container: { line: InventoryItem; weight: number; capacity: ContainerInfo; over: boolean } | null }` — grupo «Equipo» con `id: "equipo"`, `container: null`.
  - `inventoryGroups(items, info, section: string, q: string): InventoryGroup[]` — `todo`: «Equipo» (líneas sueltas, contenedores incluidos) y un grupo por contenedor (vacíos también); `equipado`: un solo grupo «Equipo» con las equipadas; id de contenedor: solo ese grupo; `otras`: `[]`. Con `q`, cada grupo conserva solo las líneas que casan y se omiten los grupos que quedan vacíos. `over` = peso del contenido > `capacity.weight` (falso sin capacidad en peso).
  - `inventoryHref(query, patch: { q?: string }): string` — como `spellTableHref` para `q`: conserva el resto de parámetros salvo `spell` y `saved`, sin `q` si queda vacío.
  - La sección activa se obtiene con `parseSection(query.seccion, inventoryChips(…).map((c) => c.id))`, y los chips enlazan con `sectionHref`.

- [ ] **Step 1: Pruebas que fallan:** con un inventario de ejemplo (daga con propiedades `F`, `L`, `T`; poción `P` rara; mochila con raciones; espada equipada):
  - `matchesItem` con «arrojadiza», «ARROJADIZA», «pocion», «raro», «Dagger» (nombre en inglés) → sí; «zzz» → no.
  - `inventoryChips` → `["todo", "equipado", <id mochila>, "otras"]`; sin contenedores → sin chip intermedio.
  - `inventoryGroups` con `todo`, `equipado`, `<id mochila>`, `otras` y con `q` «raciones» (solo el grupo de la mochila).
  - `parseSection` con el id de una mochila que ya no está → `todo`.
  - `over` cuando el contenido pasa de 30 lb.
  - `inventoryHref({ tab: "inventario", seccion: "equipado", saved: "1" }, { q: " daga " })` → `?tab=inventario&seccion=equipado&q=daga`.
  - `itemTypeName("M")`, `itemTypeName("XYZ")`, `rarityName("very rare")`.
- [ ] **Step 2:** `npx vitest run tests/dnd2024/sheet` → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** verde.
- [ ] **Step 5: Commit** `feat(inventario): búsqueda, chips y secciones del inventario`

### Task 4: Pestaña Inventario

**Files:**
- Modify: `app/(main)/characters/[id]/page.tsx` (arma `ItemInfo` completo; pasa `base` y `query` a `EquipmentTab`; nombres de los objetos admitidos por los contenedores con `getEntries` de las refs de `container.items`)
- Modify: `app/components/characters/sheet/EquipmentTab.tsx` (orquesta: cola de envíos de hoy, cabecera, tarjetas)
- Create: `app/components/characters/sheet/InventoryFilters.tsx` (búsqueda con espera de 300 ms y `router.replace(…, { scroll: false })` como `SpellTableFilters`; chips con `SectionChips`)
- Create: `app/components/characters/sheet/InventoryTable.tsx` (tabla por grupos y controles de cada fila)

**Interfaces:**
- Consumes: Tasks 2–3 (`inventoryWeights`, `inventoryGroups`, `inventoryChips`, `matchesItem`, `inventoryHref`, `ItemInfo`), op `move`.
- Spec §3:
  - Cabecera: «Peso cargado: N lb (X kg)» de la capacidad (`d.weight.capacity`), con «Supera la capacidad de carga» si se pasa, y a la derecha «Monedas: N po». El peso se calcula en el cliente con `inventoryWeights` sobre el estado optimista.
  - Chips y búsqueda debajo de la cabecera, `print:hidden`. La búsqueda vive en `?q=`, la sección en `?seccion=`.
  - Tabla «Activo · Nombre · Peso · Cant. · Coste · Notas» (+ «Quitar» y «Mover a…» para el dueño). Nombre con `itemTypeName` debajo en pequeño; peso unitario y total como hoy; coste `value / 100` po o «—»; notas: propiedades en español, rareza y las notas de la línea (editables por el dueño como hoy).
  - Cabecera de cada contenedor: «{Nombre} ({n.º de líneas}) — {peso del contenido} lb ({contenido}/{capacidad} lb)»; sin capacidad en peso, `capacity.text`; «Sobrecargado» con `TriangleAlert` si `over`; «No cuenta para el peso cargado» si `weightless`.
  - Casilla «Activo»: solo equipables fuera de un contenedor (en un contenedor, «—»).
  - «Mover a…»: `<select>` con «Equipo» y cada contenedor salvo el suyo; no aparece en las líneas contenedoras ni cuando no hay contenedores. Optimista: `container` y `equipped: false`.
  - Sección `otras`: solo la tarjeta «Otras posesiones». En el resto de secciones distintas de `todo`, solo la tabla. Lo oculto por el filtro lleva `hidden print:block` (sale al imprimir); al imprimir, todas las secciones sin filtro de búsqueda.
  - Visitantes: misma tabla en solo lectura, sin «Mover a…» ni «Quitar».

- [ ] **Step 1:** implementar; vitest, tsc y eslint en verde.
- [ ] **Step 2: Commit** `feat(inventario): tabla con búsqueda, filtros y contenedores`

### Task 5: Comprobación (controlador)

- [ ] `next build` con el servidor de desarrollo parado.
- [ ] Pedir permiso y reimportar (`--dry-run` primero); borrar `.next/dev/cache/fetch-cache` y reiniciar el servidor.
- [ ] Navegador: «Elara Prueba» en solo lectura; personaje de prueba propio: meter raciones en la mochila, filtrar por «Equipado» y por la mochila, buscar «arrojadiza», bolsa de contención fuera del peso, quitar la mochila con cosas dentro; 1640 y 375 px; borrar el personaje al terminar y restaurar el borrador del creador.
