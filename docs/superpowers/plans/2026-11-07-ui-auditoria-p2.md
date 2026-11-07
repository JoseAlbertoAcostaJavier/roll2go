# Auditoría UI/UX, mejoras P2 y P3 — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar los puntos 13 a 22 de la auditoría con cambios localizados: portada con sesión, ficha en escritorio, índice del creador, pie, accesibilidad global, textos y filtros.

**Architecture:** Cambios de presentación sobre los componentes actuales. La portada con sesión reutiliza las consultas y tarjetas de los listados.

**Tech Stack:** Next.js 16.3, React, TypeScript, Tailwind 4, vitest.

**Spec:** este documento recoge lo aprobado por el usuario en la auditoría (puntos 13 a 22). No hay otro documento de diseño.

## Global Constraints

- Rama `feat/ui-auditoria-p2`; un commit por tarea; mensajes en español con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sin push. `git add` con rutas explícitas.
- No tocar `public/assets/icons/light/`. No reimportar a Atlas.
- Regla de capas: `lib/rules` sin `lib/server`, `lib/models`, mongoose ni next; `app/components/**` sin `lib/server`.
- En verde en cada commit: `npx vitest run`, `npx tsc --noEmit`, `npx eslint app lib tests scripts`. `next build` lo ejecuta el controlador.
- Sin desplazamiento horizontal a 375 px. La impresión de la ficha sigue completa y sin controles. UI en español. Sin dependencias nuevas.
- Un módulo con `"use client"` solo exporta componentes para los componentes de servidor; las constantes van aparte.

## Review Focus

- Portada: visitante sin sesión y usuario sin personajes no deben ver errores ni huecos (Tarea 2).
- Ficha: el nuevo reparto de escritorio no debe alterar móvil, tableta ni impresión (Tarea 3).
- Creador: abrirlo sin tocar nada no deja borrador, y un borrador real se sigue recuperando (Tarea 4).
- Filtros: escribir rápido no pisa un cambio de selector, y al navegar atrás se adopta la URL (Tarea 5).
- Enlace de salto y botón del Asistente: accesibles por teclado y con nombre (Tarea 1).

---

### Task 1: Pie, logo, salto al contenido y Asistente (auditoría 16, 17, 18, 19)

**Files:** `app/(main)/layout.tsx`, `app/components/layout/Navbar.tsx`, `app/components/chat/ChatAssistant.tsx`.

- [ ] Pie siempre abajo en páginas cortas: contenedor `flex min-h-dvh flex-col`, `main` con `flex-1`. Sin cambios al imprimir.
- [ ] Logo: `aria-label="Roll2Go, ir a inicio"`.
- [ ] Primer elemento enfocable: enlace «Saltar al contenido» a `#main` (`main` con `id="main"` y `tabIndex={-1}`), oculto hasta recibir foco.
- [ ] Botón del Asistente en móvil (por debajo de `sm`): solo icono, 48×48 px, con el nombre accesible «Abrir asistente de rol». `main` con `pb-22 sm:pb-0` para que no tape contenido. Sin cambios desde `sm`. Oculto al imprimir como hasta ahora.
- [ ] Commit `fix(layout): pie abajo, salto al contenido y Asistente compacto en móvil`

### Task 2: Portada con sesión (auditoría 13)

**Files:** `app/(main)/page.tsx`, `app/components/ui/DiceRoller.tsx`, un componente nuevo de la portada si hace falta. Reutilizar las consultas de `app/(main)/characters/page.tsx` y `app/(main)/campaigns/page.tsx`, y `CharacterCard`.

- [ ] Sin sesión: la portada no cambia salvo el texto del dado.
- [ ] Con sesión: en lugar del titular, `h1` «Hola, {nombre visible o de usuario}», sección «Continuar» con hasta 3 personajes y hasta 2 campañas más recientes, cada una con su enlace «Ver todos» a su listado, seguida del dado y de Sistemas.
- [ ] Sin personajes ni campañas: estado vacío con «Crear personaje» (`/characters/new?system=dnd-2024`) y «Crear campaña» (`/campaigns/new`).
- [ ] Texto del dado sin tirar: «Elige un dado o escribe una fórmula.».
- [ ] Commit `feat(inicio): portada con personajes y campañas recientes`

### Task 3: Ficha en escritorio (auditoría 14)

**Files:** `app/components/characters/sheet/SheetLayout.tsx`, `AbilityStrip.tsx`, `CombatBox.tsx`, `SkillsBox.tsx`.

- [ ] Desde `xl`: Iniciativa y CA van bajo Competencia, Velocidad e Inspiración, a la izquierda de Puntos de golpe, sin hueco en la columna izquierda. Por debajo de `xl` quedan donde están. Un solo DOM, sin duplicar `CombatBox` (por ejemplo, reordenando la rejilla o pasando `CombatBox` como `children` de la franja).
- [ ] Columna de Habilidades: `minmax(0,20rem)` en `xl`. Ningún nombre de habilidad se corta a 1280 ni a 1440 px: quitar el truncado y permitir dos líneas si hiciera falta. Las columnas Comp y Mod se conservan.
- [ ] Sin cambios en móvil, tableta ni impresión.
- [ ] Commit `fix(ficha): sin hueco en escritorio y nombres de habilidad completos`

### Task 4: Índice del creador y borrador (auditoría 15)

**Files:** `app/components/characters/creator/CharacterCreator.tsx`, `CharacterSummary.tsx`, las secciones del creador.

- [ ] Cada sección tiene un `id` y `scroll-mt`. En la columna Resumen (fija al desplazarse en escritorio), un índice con enlaces a las secciones y una marca de completa o pendiente para cada una, usando las comprobaciones que ya alimentan «Falta por completar», no otras nuevas.
- [ ] Cada elemento de «Falta por completar» enlaza a su sección y lleva el foco a su primer control.
- [ ] En móvil: índice plegable al principio, o el mismo índice en el Resumen si este ya es accesible. Sin desbordes.
- [ ] Borrador: abrir el creador sin tocar nada no guarda nada; si el formulario vuelve a su estado inicial, se elimina la clave. Un borrador con datos se sigue recuperando. Prueba si la comparación es una función pura.
- [ ] Commit `feat(creador): índice de secciones y sin borradores vacíos`

### Task 5: Textos, filtros y color de error (auditoría 20, 21, 22, P3)

**Files:** `app/(main)/characters/page.tsx`, `app/(main)/campaigns/page.tsx`, un componente de cliente nuevo para filtros, `app/(main)/social/page.tsx`, `app/components/social/FriendActions.tsx`, `app/globals.css`, `app/components/ui/formStyles.ts`.

- [ ] Textos: «Añadir» de personajes pasa a «Crear personaje». «Lista de Amigos» pasa a «Lista de amigos». Buscar otros títulos con mayúscula en cada palabra y corregirlos.
- [ ] «Tu amigo» desaparece en la sección «Mis amigos»; se conserva donde informa (búsqueda de usuarios, perfil).
- [ ] Filtros de personajes y campañas sin botón «Buscar»: el texto actualiza `?q=` tras 300 ms y los selectores al cambiar, con `router.replace` y `scroll: false`, como `InventoryFilters.tsx`. Se quita la paginación al filtrar, si la hay. Sin JavaScript no hace falta que funcione.
- [ ] Token `--color-danger` con el mismo valor actual de `--color-brand-soft` (también en el bloque de impresión). `errorClass` y los bordes y textos de error lo usan. Sin cambio visual: separa el significado de error del de marca.
- [ ] Commit `refactor(ui): textos coherentes, filtros automáticos y color de error propio`

### Task 6: Comprobación (controlador)

- [ ] Revisión final de la rama y `next build` con el servidor parado.
- [ ] Navegador a 375, 768 y 1440 px: portada, ficha, creador, listados y Social.
