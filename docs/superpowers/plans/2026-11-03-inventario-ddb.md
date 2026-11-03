# Inventario como D&D Beyond — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tabla de inventario de consulta con ficha de objeto al pulsar, y un panel «Gestionar inventario» como el de D&D Beyond para añadir, mover, cambiar cantidad y notas, y quitar.

**Architecture:** Un módulo puro arma las filas de la ficha de objeto desde el catálogo; la página pasa esas fichas y descripciones al cliente; `EquipmentTab` conserva la cola de envíos y reparte la UI entre la tabla (consulta), un diálogo de ficha y un panel lateral de gestión.

**Tech Stack:** Next.js 16.3, React, TypeScript, Tailwind 4, vitest.

**Spec:** `docs/superpowers/specs/2026-11-03-inventario-ddb-design.md`

## Global Constraints

- Rama `feat/inventario-ddb` desde `main`; un commit por tarea; mensajes en español con `Co-Authored-By`. Sin push.
- Regla de capas: `lib/rules` sin `lib/server`, `lib/models`, mongoose ni next; `app/components/**` sin `lib/server`.
- En verde en cada commit: `npx vitest run`, `npx tsc --noEmit`, `npx eslint app lib tests scripts`. `next build` lo ejecuta el controlador.
- Textos exactos: «Gestionar inventario», «Añadir objeto», «Mover», «Equipo», «Quitar», «Detalles del contenedor», «Quitar contenedor», «Cerrar», «Sin descripción.», «Sobrecargado», «No cuenta para el peso cargado».
- Sin cambios de reglas ni de rutas del inventario. Sin desplazamiento horizontal a 375 px; al imprimir, la tabla completa sin botones ni panel.

## Review Focus

- Visitante: ve la tabla y abre fichas de objeto, pero no hay «Gestionar inventario» ni casillas activas (Task 2 y 3).
- Objeto personalizado (sin `ref`) o con `ref` que ya no está en el catálogo: la ficha no falla y muestra «Sin descripción.» (Task 1 y 2).
- Varios cambios seguidos en el panel (mover y luego quitar el contenedor): la cola de envíos mantiene el orden y la tabla acaba con el estado del servidor (Task 3).
- Abrir y cerrar el panel o la ficha devuelve el foco al botón que los abrió (Task 2 y 3).
- Panel en 375 px: a pantalla completa, sin desbordes y con el botón de cerrar visible (Task 3).

---

### Task 1: Datos de la ficha de objeto

**Files:**
- Create: `lib/rules/dnd2024/sheet/itemDetails.ts`
- Test: `tests/dnd2024/sheet/itemDetails.test.ts`

**Interfaces:**
- Produces: `export type ItemDetails = { name: string; subtitle: string | null; rows: { label: string; value: string }[] }` y `itemDetails(line: InventoryItem, entry: CatalogEntry | undefined, capacityText: string | null): ItemDetails`.
  - `subtitle`: `itemTypeName(type)` y, si tiene, `rarityName(rarity)`, separados por « · ».
  - Filas, en este orden y solo si aplican: «Peso» (`1 lb (0,45 kg)`), «Coste» (`15 po`, desde pc), «Daño» (`1d8 cortante` con `damageTypeName`), «Propiedades» (con `weaponPropertyName`, unidas por «, »), «Maestría» (`masteryName`), «Alcance» (`range` en pies tal cual con « pies»), «CA» (`armor.ac`; escudo como `+2`), «Sigilo» («Desventaja» si `stealthDisadvantage`), «Capacidad» (`capacityText`, o `N lb` si el contenedor tiene peso), «Cantidad», «Notas» (si no están vacías).
  - Sin `entry`: `subtitle: null` y solo «Cantidad» y «Notas».

- [ ] **Step 1: Pruebas que fallan:** espada larga (`M`, 3 lb, 1500 pc, `1d8` `S`, propiedades `V`, maestría `sap`) → subtítulo «Arma cuerpo a cuerpo» y filas Peso, Coste «15 po», Daño «1d8 cortante», Propiedades «Versátil», Maestría «Debilitar»; cota de malla (`HA`, ac 16, sigilo) → CA «16», Sigilo «Desventaja»; escudo → CA «+2»; mochila con `container.weight` 30 → Capacidad «30 lb»; cofre con `capacityText` «12 pies cúbicos»; poción `P` rara → subtítulo «Poción · Raro»; línea sin `entry` con notas «Regalo» → `{ subtitle: null, rows: [Cantidad, Notas] }`.
- [ ] **Step 2:** `npx vitest run tests/dnd2024/sheet/itemDetails.test.ts` → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** verde.
- [ ] **Step 5: Commit** `feat(inventario): datos de la ficha de objeto`

### Task 2: Tabla de consulta y ficha de objeto

**Files:**
- Modify: `app/(main)/characters/[id]/page.tsx` (por línea: `ItemDetails` y la descripción del objeto, igual que se pasan hoy las de rasgos o acciones)
- Modify: `app/components/characters/sheet/InventoryTable.tsx` (fuera «Mover a…», campos de cantidad y notas y «Quitar»: cantidad y notas como texto; nombre como botón que abre la ficha; la casilla «Activo» se queda para el dueño)
- Create: `app/components/characters/sheet/ItemDialog.tsx` (ficha con el patrón de `StatDialog`: título, subtítulo, filas y descripción; devuelve el foco al abrir)
- Modify: `app/components/characters/sheet/EquipmentTab.tsx` (estado de la ficha abierta; «Añadir» se quita de la cabecera en esta tarea solo si la Task 3 lo sustituye en el mismo commit — si no, se deja hasta la Task 3)

**Interfaces:**
- Consumes: `itemDetails` (Task 1).
- Produces: `ItemDialog({ details, description, onClose, opener })`; `EquipmentTab` recibe `details: Record<string, ItemDetails>` y `descriptions: Record<string, …>` por id de línea (el tipo de descripción, el mismo que usen los diálogos de rasgos).

- [ ] **Step 1:** implementar; vitest, tsc y eslint en verde.
- [ ] **Step 2: Commit** `feat(inventario): tabla de consulta y ficha de objeto`

### Task 3: Panel «Gestionar inventario»

**Files:**
- Create: `app/components/characters/sheet/ManageInventory.tsx` (panel lateral; a pantalla completa por debajo de `sm`)
- Modify: `app/components/characters/sheet/EquipmentTab.tsx` (botón «Gestionar inventario» junto al buscador para el dueño, sustituye a «Añadir»; pasa al panel `inv`, `info`, `send` y los parches optimistas existentes)
- Modify: `app/components/characters/sheet/InventoryFilters.tsx` si el botón va en su fila

**Interfaces:**
- Consumes: `inventoryGroups`, `inventoryWeights`, `effectiveContainer` (inventario), `AddItemDialog`, `QuantityField`/`NotesField` (moverlos a un archivo propio si hace falta compartirlos), la cola `send` de `EquipmentTab`.
- Spec §4: «Añadir objeto» arriba; secciones «Equipo (n) — N lb» y por contenedor con «({contenido}/{capacidad} lb)» y «Sobrecargado»; fila con casilla de equipar, nombre, «Mover» (menú con «Equipo» y los demás contenedores; no en contenedores ni sin contenedores) y desplegable con cantidad, notas y «Quitar»; cabecera de contenedor desplegable con «Detalles del contenedor», capacidad, «No cuenta para el peso cargado» y «Quitar contenedor». Foco atrapado, Escape cierra, el foco vuelve al botón.

- [ ] **Step 1:** implementar; vitest, tsc y eslint en verde.
- [ ] **Step 2: Commit** `feat(inventario): panel para gestionar el inventario`

### Task 4: Comprobación (controlador)

- [ ] `next build` con el servidor de desarrollo parado.
- [ ] Navegador: personaje de prueba propio (añadir, mover a la mochila, equipar, cantidad, notas, quitar, quitar la mochila con cosas); fichas de espada, armadura y mochila; «Elara Prueba» en solo lectura; 375 px; borrar el personaje.
