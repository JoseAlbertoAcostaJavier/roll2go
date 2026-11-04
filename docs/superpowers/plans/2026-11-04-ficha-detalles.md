# Detalles de la ficha — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pericia con círculo doble, estrella de maestría, notas de armas y conjuros en Acciones, conjuros de dote/especie con tirada y daño, Características editables con el género de la creación, y fichas de objeto y arma como D&D Beyond (también desde Acciones).

**Architecture:** Reglas puras para notas, característica de conjuros de dote/especie, pronombres y filas de la ficha; la UI (SkillsBox, ActionsTab, BackgroundTab, ItemDialog) consume esas reglas.

**Tech Stack:** Next.js 16.3, React, TypeScript, Tailwind 4, vitest.

**Spec:** `docs/superpowers/specs/2026-11-04-ficha-detalles-design.md`

## Global Constraints

- Rama `feat/ficha-detalles` (ya creada, parte de `fix/key-rasgos`); un commit por tarea; mensajes en español con `Co-Authored-By`. Sin push.
- Regla de capas: `lib/rules` sin `lib/server`, `lib/models`, mongoose ni next; `app/components/**` sin `lib/server`.
- En verde en cada commit: `npx vitest run`, `npx tsc --noEmit`, `npx eslint app lib tests scripts`. `next build` lo ejecuta el controlador.
- Textos exactos: «Pericia», «Competencia», «Sin competencia», «Maestría: {nombre}», «Sencilla», «Marcial», «Concentración», «Ritual», «Él», «Ella», «Elle», «Competente», «Tipo de ataque», «Cuerpo a cuerpo», «A distancia», «Alcance», «Daño», «Tipo de daño», «Peso», «Coste», «Propiedades», «CA», «Sigilo», «Capacidad», «Fuente», «En Equipo», «Cantidad», «Mover», «Quitar».
- Sin desplazamiento horizontal a 375 px; impresión sin controles.

## Review Focus

- Conjuro de dote sin característica elegida en hojas antiguas: usa la del catálogo o Inteligencia, sin romper (Task 2).
- Arma en Acciones sin línea en el inventario (ataque sin armas, arma de un rasgo): el nombre no es un botón (Task 4).
- Personaje sin pronombres: «Género» muestra «—» (Task 3).
- Visitante: Características y ficha de objeto sin campos ni controles (Task 3 y 4).
- 375 px: las notas largas de armas y la ficha no desbordan (Task 2 y 4).

---

### Task 1: Pericia en Habilidades

**Files:** Modify `app/components/characters/sheet/SkillsBox.tsx` (y `statUi.tsx` si el marcador vive ahí).
- [ ] Implementar el marcador único (punto, punto con anillo, anillo atenuado) con su texto accesible; vitest, tsc y eslint en verde.
- [ ] Commit `feat(ficha): pericia con círculo dentro de círculo`

### Task 2: Acciones — notas, maestría y conjuros de dote/especie

**Files:**
- Modify: `lib/rules/dnd2024/derive/attacks.ts` (`Attack.notes` con categoría, propiedades, maestría y alcance)
- Modify: `lib/rules/dnd2024/derive/spells.ts` (`OtherSpell.ability?: Ability` desde la elección de la dote/legado o la concesión)
- Modify: `lib/rules/dnd2024/spells/spellTable.ts` (`hitOf` acepta la característica de un conjuro sin bloque: `{ attack, dc }` de `bonificador + mod`), `lib/rules/dnd2024/derive/actions.ts` (notas de conjuro: componentes, «Concentración», «Ritual»; el origen en un campo `subtitle`)
- Modify: `app/components/characters/sheet/ActionsTab.tsx` (estrella de maestría sobre el icono, subtítulo bajo el nombre, notas nuevas)
- Test: `tests/dnd2024/derive/attacks.test.ts`, `tests/dnd2024/derive/actions.test.ts`, `tests/dnd2024/spells/spellTable.test.ts`

**Interfaces:**
- Produces: `ActionItem` de conjuro gana `subtitle: string` y `notes` = componentes/marcas; `Attack.notes` nuevo formato.
- [ ] **Step 1: Pruebas que fallan:** Daga con maestría → notas «Sencilla, Sutil, Ligera, Arrojadiza, Mellar, Alcance 6/18 m»; Bastón sin maestría → «Sencilla, Versátil»; Descarga de fuego → notas «V, S», subtítulo «Truco · Mago»; Detectar magia → «V, S · Concentración · Ritual»; Agarre electrizante de Iniciado en la magia (int +3, competencia +2) → `hit` «+5», `damage` «1d8» y va a la tabla; Rociada venenosa de un legado con Sabiduría → CD «CD 13 CON» con sab +3.
- [ ] **Step 2:** ejecutar → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** verde.
- [ ] **Step 5: Commit** `feat(ficha): notas de armas y conjuros, maestría y conjuros de dote en Acciones`

### Task 3: Características

**Files:**
- Modify: `app/components/characters/sheet/BackgroundTab.tsx` (Género desde pronombres; campos de texto visibles), `app/components/characters/sheet/InlineText.tsx` si necesita una variante de campo visible
- Modify: `app/(main)/characters/[id]/page.tsx` (pasa `character.pronouns`)
- Modify: `lib/rules/dnd2024/sheet/labels.ts` (`pronounsText(p: string[]): string` → «Él / Ella», «—»)
- Test: `tests/dnd2024/sheet/labels.test.ts`
- [ ] **Step 1: Pruebas que fallan:** `pronounsText(["he"])` «Él»; `["she","they"]` «Ella / Elle»; `[]` «—».
- [ ] **Step 2–4:** implementar y verde.
- [ ] **Step 5: Commit** `feat(ficha): género de la creación y características editables`

### Task 4: Ficha de objeto y arma

**Files:**
- Modify: `lib/rules/dnd2024/sheet/itemDetails.ts` (filas de la spec §5; `itemDetails(line, entry, ctx: { capacityText; attack?: Attack; proficient?: boolean; location: string; bookName?: string })`), `lib/rules/dnd2024/sheet/labels.ts` (`MASTERY_TEXTS`: texto propio de las 8 maestrías)
- Modify: `app/components/characters/sheet/ItemDialog.tsx` (cabecera con icono `Items.svg`/`Melee Weapons.svg`, subtítulo en cursiva, filas en negrita, descripción, sección «★ Maestría», controles del dueño: cantidad −/+, «Mover», «Quitar»)
- Modify: `app/components/characters/sheet/EquipmentTab.tsx` (pasa acciones a la ficha), `app/components/characters/sheet/ActionsTab.tsx` y `ActionsDialogs.tsx` (el nombre de un arma con línea de inventario abre la misma ficha), `app/(main)/characters/[id]/page.tsx` (datos de la ficha para las armas de Acciones)
- Test: `tests/dnd2024/sheet/itemDetails.test.ts`
- [ ] **Step 1: Pruebas que fallan:** Gran hacha con el ataque del personaje → filas «Competente: Sí», «Tipo de ataque: Cuerpo a cuerpo», «Alcance: 1,5 m», «Daño: 1d12+5», «Tipo de daño: Cortante», «Peso», «Coste: 30 po», «Propiedades: Pesada, A dos manos», «Fuente»; subtítulo «Arma, común» y ubicación «En Equipo»; Raciones → «Peso», «Coste», «Fuente»; los 8 `MASTERY_TEXTS` existen y no están vacíos.
- [ ] **Step 2–4:** implementar y verde.
- [ ] **Step 5: Commit** `feat(inventario): ficha de objeto y arma como D&D Beyond, también desde Acciones`

### Task 5: Comprobación (controlador)

- [ ] `next build` con el servidor de desarrollo parado.
- [ ] Navegador: «Elara Prueba» (Acciones con notas y conjuros de dote con daño, Características, fichas de Daga y Mochila), Pícaro de prueba con pericia y maestría (círculo doble, estrella, ficha desde Acciones); 375 px; borrar el personaje.
