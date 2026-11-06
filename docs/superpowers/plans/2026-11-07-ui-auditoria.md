# Auditoría UI/UX, mejoras P0 y P1 — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir la navegación rota, la ficha móvil y las tablas, y mejorar objetivos táctiles, legibilidad, contraste de controles, uso del rojo y traducciones, con cambios localizados.

**Architecture:** Cambios de presentación sobre los componentes actuales, sin rediseño. Un solo DOM para móvil y escritorio siempre que se pueda (CSS responsive en lugar de duplicar filas).

**Tech Stack:** Next.js 16.3, React, TypeScript, Tailwind 4, vitest.

**Spec:** este documento recoge lo aprobado por el usuario en la auditoría (puntos 1 a 12, P0 y P1). No hay otro documento de diseño.

## Global Constraints

- Rama `feat/ui-auditoria`; un commit por tarea; mensajes en español con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sin push. `git add` con rutas explícitas.
- No tocar `public/assets/icons/light/`. No reimportar a Atlas ni conectarse a la base de datos.
- Regla de capas: `lib/rules` sin `lib/server`, `lib/models`, mongoose ni next; `app/components/**` sin `lib/server`.
- En verde en cada commit: `npx vitest run`, `npx tsc --noEmit`, `npx eslint app lib tests scripts`. `next build` lo ejecuta el controlador.
- Sin desplazamiento horizontal de la página a 375 px. La impresión de la ficha sigue saliendo completa y sin controles. Visitantes sin controles.
- UI en español. Sin dependencias nuevas.

## Review Focus

- Cambiar de pestaña en móvil no debe devolver la página arriba: las pestañas fijas no servirían de nada (Tarea 2).
- Impresión: paneles plegados y tablas en tarjetas deben imprimirse completos (Tareas 2 y 3).
- Zona pulsable ampliada: dos casillas contiguas no pueden solaparse, y marcar una no debe gastar otra (Tarea 4).
- Tarjeta entera pulsable: el enlace de campaña dentro de la tarjeta sigue llevando a la campaña (Tarea 5).
- Catálogo sin reimportar: los nombres sin traducción salen con «EN» sin errores (Tarea 6).

---

### Task 1: Navegación, Inicio y pie (auditoría 1, 2, 3)

**Files:** `app/components/layout/Navbar.tsx`, `app/components/layout/SystemsGrid.tsx`, `lib/utils/systems.*`, `app/(main)/layout.tsx`.

- [ ] Quitar «Sistemas» y «Biblioteca» del menú (escritorio y móvil). No crear páginas nuevas.
- [ ] `SystemsGrid`: el sistema disponible (D&D 5.5 2024) enlaza a `/characters/new?system=dnd-2024`. Los otros 5 son `div` sin cursor de mano ni hover de enlace, con la etiqueta «Próximamente» y opacidad del 70 %. Reutilizar el dato de disponibilidad que usa el diálogo de crear personaje (`NewCharacterDialog`), sin duplicar la lista.
- [ ] Pie: quitar «Work In Progress» y «Añadir Licencia Wizard of the Coast aqui más tarde.». Dejar solo «Roll2Go». No inventar texto legal ni enlaces a páginas que no existen.
- [ ] Prueba si la disponibilidad pasa por una función pura; si no, comprobación en el informe.
- [ ] Commit `fix(navegación): quita enlaces rotos, tarjetas falsas y texto provisional`

### Task 2: Ficha móvil con pestañas fijas (auditoría 4)

**Files:** `app/components/characters/sheet/SheetTabs.tsx`, `SectionChips.tsx` si aplica, el layout de la ficha (componente que recibe `tabs=` desde `app/(main)/characters/[id]/page.tsx`), un componente nuevo `MobileCollapse.tsx`.

- [ ] Barra de pestañas fija al desplazarse (`sticky`), justo bajo la barra superior (medir su altura real; si la barra superior no es fija, `top-0`), con fondo opaco `bg-surface` y `z` por debajo de los diálogos. `print:hidden` se mantiene.
- [ ] Los enlaces de pestañas y chips usan `scroll={false}`, de modo que al cambiar de pestaña la barra sigue a la vista. Si la barra está por encima del contenido nuevo, llevarla al inicio del panel.
- [ ] `MobileCollapse({ title, children })`: por debajo del punto de ruptura en que la ficha pasa a una columna, botón con `aria-expanded` y contenido plegado por defecto; a partir de ahí, siempre visible y sin botón; al imprimir, siempre visible (`hidden lg:block print:block` o equivalente con el punto de ruptura real). Sin desajuste de hidratación.
- [ ] Plegar en móvil Salvaciones, Sentidos, Competencias y Habilidades. Características, PG, CA, iniciativa y pestañas quedan arriba.
- [ ] Commit `feat(ficha): pestañas fijas y paneles plegables en móvil`

### Task 3: Tablas de Acciones y Conjuros (auditoría 5, 6)

**Files:** `app/components/characters/sheet/ActionsTab.tsx`, `app/components/characters/spells/SpellTable.tsx`.

- [ ] Un solo DOM: por debajo de `md`, cada fila se muestra como tarjeta mediante CSS (`max-md:block`/`grid` en `tr` y `td`, `thead` con `max-md:sr-only`). Sin el contenedor con desplazamiento horizontal en móvil. No duplicar filas: los botones de lanzar y sus diálogos tienen estado.
- [ ] Tarjeta de ataque: nombre y notas a la izquierda; Golpe/CD y Daño a la derecha, en `text-xl` de `font-heading`; Alcance debajo en `text-xs`. Cada dato lleva su rótulo visible en móvil («Golpe», «Daño», «Alcance»).
- [ ] Tarjeta de conjuro: lo mismo, más el botón «Lanzar» y las casillas de uso.
- [ ] Desde `md`: quitar la columna Notas; las notas van bajo el nombre en `text-xs text-muted`. Ninguna de las dos tablas debe recortarse a 1440 px.
- [ ] Impresión: se mantiene la tabla normal, sin estilos de tarjeta (usar `max-md:` junto con `print:` para anularlos si hace falta) y con los datos completos.
- [ ] Commit `feat(ficha): ataques y conjuros en tarjetas en móvil`

### Task 4: Objetivos táctiles y texto mínimo (auditoría 7, 8)

**Files:** `UseBoxes.tsx`, `InventoryTable.tsx` (casilla «Equipar»), `ActionsTab.tsx`, `SpellTable.tsx`, `AbilityStrip.tsx`, `CombatBox.tsx`, `HpEditor.tsx`, `InspirationBox.tsx`, `SkillsBox.tsx`, `statUi.tsx`.

- [ ] Casillas de uso, espacio de conjuro y «Equipar»: la casilla visual sigue en 16 px; zona pulsable de 24 px de ancho y 32 px de alto con `relative` y `after:absolute`; separación entre casillas de 8 px para que no se solapen.
- [ ] Nombres-enlace de armas, conjuros, objetos y acciones básicas: mínimo 24 px de alto con padding vertical, sin cambiar su aspecto.
- [ ] Texto: mínimo 12 px; 11 px solo en mayúsculas con `tracking-wide`. Eliminar `text-[8px]`, `text-[9px]` y `text-[10px]` de la ficha. Quitar «Bonificador» y «a pie». Si un rótulo no cabe, usar `break-words` o abreviar sin desbordar.
- [ ] Commit `fix(ficha): objetivos táctiles de 24 px y texto legible`

### Task 5: Tarjetas, bordes de control y uso del rojo (auditoría 9, 10, 11)

**Files:** `app/globals.css`, `app/components/ui/formStyles.ts`, la tarjeta de personaje en `app/(main)/characters/page.tsx` o su componente, los filtros de personajes y campañas, tarjetas de amigos en `app/components/social/`, sección «Falta por completar» del creador.

- [ ] Token `--color-line-strong: #6b6b70`; `field` y demás controles (select, textarea, entradas de filtros) lo usan como borde. `--color-line` queda para separadores. Comprobar 3:1 sobre `panel` y `surface`; si no llega, subir el tono y anotarlo.
- [ ] Tarjeta de personaje pulsable entera: `::after` absoluto sobre el enlace del nombre; el enlace de campaña con `relative z-10`. Foco visible en toda la tarjeta.
- [ ] `secondaryButton` en `formStyles.ts` (fondo `panel`, borde `line-strong`, sin rojo). Lo usan «Buscar» y «Enviar mensaje».
- [ ] `sheetCard`: `border border-line` en lugar del marco rojo; la barra de marca de los títulos se mantiene. Nombres de amigos y de campaña en tarjeta, con `text-fg`.
- [ ] «Falta por completar»: icono `AlertCircle` junto al título. Los mensajes de error conservan color y texto.
- [ ] Se mantiene `brand` en la acción principal, la pestaña activa y los puntos de competencia.
- [ ] Commit `style(ui): bordes de control con contraste y rojo reservado`

### Task 6: Traducciones y etiqueta EN (auditoría 12)

**Files:** `lib/rules/i18n/es.json`, `app/components/characters/sheet/FeaturesTab.tsx`, `ActionsTab.tsx`, `lib/rules/dnd2024/derive/features.ts` si no usa `nameEs`, pruebas de `tests/rules/i18n.test.ts`.

- [ ] Añadir a `es.json` el nombre en español de los rasgos de clase de nivel 1 a 5 de las 12 clases de XPHB, con la clave real de cada uno (`classFeature:rage|barbarian|xphb|1`). Fuente de nombres ingleses y claves: `C:/Users/Usuario/Documents/GitHub/5etools/5etools-src/data/class/` (solo lectura). Usar la terminología del Manual del Jugador 2024 en español: Furia, Defensa sin armadura, Maestría con armas, Sentido del peligro, Ataque temerario, Ataque adicional, Movimiento rápido, Mejora de característica…
- [ ] Comprobar que `Rage` en la ficha sale de `nameEs` y que la derivación no fija el inglés. Si lo fija, corregirlo.
- [ ] Componente `UntranslatedTag`: etiqueta «EN» en `text-xs`, con `title` y `aria-label` «Solo disponible en inglés», junto a los nombres de rasgo sin `nameEs` y junto a «Descripción» cuando la descripción no tiene versión en español. Sin dependencia de reimportar para no romperse.
- [ ] Prueba: las claves nuevas existen en el catálogo normalizado y ningún valor está vacío.
- [ ] Commit `feat(i18n): nombres de rasgos de nivel 1 a 5 y etiqueta EN`

### Task 7: Comprobación (controlador)

- [ ] Revisión final de la rama y `next build` con el servidor de desarrollo parado.
- [ ] Navegador a 375 y 1440 px: Inicio, pie, ficha (pestañas fijas al cambiar, paneles plegados, tarjetas, casillas), personajes y Social.
- [ ] Pedir permiso para reimportar (las traducciones de la Tarea 6 lo necesitan).
