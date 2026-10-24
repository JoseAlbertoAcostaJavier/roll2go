# Pestaña Información de la ficha — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada valor de la pestaña Información se pueda pulsar y muestre su descripción y un desglose que suma exactamente el número de la ficha, con una disposición más compacta.

**Architecture:** Las funciones puras de `lib/rules/dnd2024/derive/` pasan a calcular cada valor a partir de su desglose (`Breakdown`), y `derive()` expone los desgloses en `Derived.breakdowns`. La interfaz (`InfoTab`) solo los muestra en un diálogo accesible (`StatDialog`) con textos en español de un archivo de datos.

**Tech Stack:** Next.js 16.3 (app router), React 19, TypeScript, Tailwind 4, vitest.

**Spec:** `docs/superpowers/specs/2026-10-24-ficha-informacion-design.md`

## Global Constraints

- Antes de usar cualquier API de Next, leer su guía en `node_modules/next/dist/docs/`.
- `lib/rules/dnd2024/**` puro (sin Next ni mongoose) y probado con vitest.
- Interfaz y etiquetas en español; nombres de catálogo con `nameEs ?? name`.
- Invariante: `total === suma de parts[].value` en todo desglose; un tope se expresa como parte negativa «Máximo 20» o «Máximo 30».
- Los valores numéricos actuales de `Derived` no cambian salvo por los huecos de reglas del §4.4 de la spec.
- Tokens de Tailwind del proyecto (surface, panel, line, fg, muted, brand, brand-soft, success); tema oscuro; sin desplazamiento horizontal a 375 px.
- Un commit por tarea, en la rama `feat/ficha-informacion`.

## Review Focus

- **Característica por encima de 20 con mejoras y dotes** → la parte «Máximo 20» hace que la suma cuadre con la puntuación mostrada. Prueba en la Tarea 1.
- **Bardo multiclase con nivel 1 de Bardo** → Polivalente no se aplica (requiere Bardo 2). Prueba en la Tarea 1.
- **Monje con escudo pero sin armadura** → ni Defensa sin armadura del Monje ni Movimiento sin armadura. Prueba en la Tarea 2.
- **Bárbaro y Monje a la vez sin armadura** → la CA usa la mayor de las dos y el desglose muestra solo la que gana. Prueba en la Tarea 2.
- **Hoja sin catálogo de especie (entrada perdida)** → velocidad 30 con la etiqueta «Velocidad base» y desglose válido. Prueba en la Tarea 2.

---

### Tarea 1: Desglose de características, salvaciones y habilidades

**Files:**
- Create: `lib/rules/dnd2024/derive/breakdown.ts`
- Modify: `lib/rules/dnd2024/derive/abilities.ts`, `lib/rules/dnd2024/derive/index.ts`
- Test: `tests/dnd2024/breakdown.test.ts`

**Interfaces:**
- Produces:
  - `type Part = { label: string; value: number }`; `type Breakdown = { parts: Part[]; total: number; notes?: string[] }`; `makeBreakdown(parts: Part[], notes?: string[]): Breakdown` (calcula `total` sumando).
  - `abilityBreakdowns(sheet: Dnd2024SheetV2, isEpicBoon: (feat: Ref) => boolean, nameOf: (ref: Ref, fallback: string) => string): Record<Ability, Breakdown>`; `abilityScores` mantiene su firma y obtiene cada `score` del `total` correspondiente.
  - `saveBreakdowns(abilities: AbilityScores, proficient: Ability[], profBonus: number): Record<Ability, Breakdown>`; `saveRows` mantiene su firma y toma `total` del desglose.
  - `skillBreakdowns(abilities: AbilityScores, proficient: string[], expertise: string[], profBonus: number, jackOfAllTrades: boolean): Record<string, Breakdown>`; `skillRows` gana el parámetro `jackOfAllTrades = false` al final y toma `total` del desglose.
  - `Derived.breakdowns: { abilities: Record<Ability, Breakdown>; saves: Record<Ability, Breakdown>; skills: Record<string, Breakdown>; ac: Breakdown; initiative: Breakdown; speed: Breakdown }` — en esta tarea `ac`, `initiative` y `speed` son `makeBreakdown([{ label: "Total", value: <valor actual> }])` provisionales; la Tarea 2 los sustituye.

- [ ] **Paso 1: Pruebas que fallan** en `tests/dnd2024/breakdown.test.ts` (con `buildCatalog` de `tests/dnd2024/fixtureCatalog.ts`):
  - `makeBreakdown([{label:"A",value:2},{label:"B",value:-1}]).total === 1`.
  - Base 15, trasfondo +2 y mejora de nivel 4 +2: partes `["Puntuación base" 15, "Trasfondo" 2, "Mejora de característica (nivel 4)" 2]`, total 19, sin parte de tope.
  - Base 17, trasfondo +2 y mejora +2: las partes incluyen `{ label: "Máximo 20", value: -1 }` y `total === 20`.
  - Dote con +1 («Dote: <nombre>») y don épico («Don épico: <nombre>») por encima de 20 hasta 30, con «Máximo 30» si se pasa.
  - Para todo personaje de prueba: `derive(...).breakdowns.abilities[a].total === derive(...).abilities[a].score` para las seis.
  - Salvación con competencia: partes `["Modificador de Destreza" +3, "Competencia" +2]`; sin competencia: `"Sin competencia" 0`.
  - Habilidad con pericia: parte `"Pericia"` = 2 × competencia.
  - Bardo 2 sin competencia en Atletismo: parte `{ label: "Polivalente", value: Math.floor(pb / 2) }` y `skills.find(athletics).total` la incluye; Bardo 1 (o Guerrero 3 / Bardo 1) → `"Sin competencia" 0`.
  - Percepción, Perspicacia e Investigación llevan la nota `"Valor pasivo: <10 + total>"`; las demás habilidades no llevan notas.
- [ ] **Paso 2: Ejecutar** `npx vitest run tests/dnd2024/breakdown.test.ts` → FAIL.
- [ ] **Paso 3: Implementar.** Etiquetas exactas: «Puntuación base», «Trasfondo», «Mejora de característica (nivel N)» (N = `level.n`), «Dote: <nombre>», «Don épico: <nombre>», «Máximo 20», «Máximo 30», «Modificador de <Característica>» (nombres de `ABILITY_NAMES` en `labels.ts`), «Competencia», «Pericia», «Polivalente», «Sin competencia». Polivalente: Bardo con nivel de Bardo ≥ 2 (`summarizeClasses`, clave `bard`), en `derive()` se pasa a `skillRows`/`skillBreakdowns`. `nameOf` en `derive()` usa la entrada del catálogo (`nameEs ?? name`) o el nombre guardado.
- [ ] **Paso 4: Ejecutar** toda la suite, `npx tsc --noEmit` y `npx eslint app lib tests` → PASS y limpios (los totales antiguos no cambian salvo Polivalente).
- [ ] **Paso 5: Commit** `feat(characters): desglose de características, salvaciones y habilidades`.

### Tarea 2: Desglose de CA, iniciativa y velocidad (con los rasgos de velocidad)

**Files:**
- Modify: `lib/rules/dnd2024/derive/ac.ts`, `lib/rules/dnd2024/derive/index.ts`
- Test: `tests/dnd2024/breakdown.test.ts`, `tests/dnd2024/ac.test.ts`

**Interfaces:**
- Consumes: `Part`, `Breakdown`, `makeBreakdown` (Tarea 1).
- Produces:
  - `armorClassBreakdown(input: { dex: number; con: number; wis: number; armor: (ArmorData & { name: string }) | null; shield: boolean; unarmored: UnarmoredClass[] }): Breakdown`; `armorClass(input)` mantiene firma y devuelve `armorClassBreakdown(...).total` (el `name` es opcional para `armorClass`).
  - `speedBreakdown(input: { base: number; baseLabel: string; barbarianLevel: number; monkLevel: number; monkColumn: string | null; heavyArmor: boolean; anyArmor: boolean; shield: boolean; speedy: boolean }): Breakdown`.
  - `Derived.breakdowns.ac`, `.initiative`, `.speed` reales; `Derived.speed === breakdowns.speed.total`, `Derived.ac === breakdowns.ac.total`, `Derived.initiative === breakdowns.initiative.total`.

- [ ] **Paso 1: Pruebas que fallan**:
  - CA con armadura media (CA 14, `dexCap` 2), DES +3 y escudo: partes `["Armadura: <nombre>" 14, "Modificador de Destreza (máx. 2)" 2, "Escudo" 2]`, total 18.
  - Armadura pesada (`dexCap` 0): sin parte de Destreza.
  - Sin armadura: `["Sin armadura" 10, "Modificador de Destreza" +d]`. Bárbaro: `["Defensa sin armadura (Bárbaro)" 10, "Modificador de Destreza", "Modificador de Constitución"]`. Monje sin escudo: `(Monje)` con Sabiduría; Monje con escudo → no usa la del Monje. Bárbaro + Monje → solo las partes de la que da más.
  - `armorWarning` aparece en `breakdowns.ac.notes`.
  - Iniciativa: `["Modificador de Destreza"]` y con Alerta `"Dote: Alerta"` = competencia.
  - Velocidad: Enano → `"Velocidad de Enano" 30`; especie perdida → `"Velocidad base" 30`; Bárbaro 5 sin armadura pesada → `"Movimiento rápido" 10`; con armadura pesada → no; Monje 2 → `"Movimiento sin armadura" 10`, Monje 6 → 15 (de la columna de su tabla si existe; si no, 2–5 → 10, 6–9 → 15, 10–13 → 20, 14–17 → 25, 18–20 → 30); Monje con escudo o armadura → no; dote Veloz (`feat:speedy|xphb`) → `"Dote: Veloz" 10`.
  - Para los personajes de prueba: `breakdowns.speed.total === speed`, `breakdowns.ac.total === ac`, `breakdowns.initiative.total === initiative`.
- [ ] **Paso 2: Ejecutar** → FAIL.
- [ ] **Paso 3: Implementar.** En `derive()`, la armadura de cuerpo elegida conserva el nombre del objeto equipado. La columna del Monje se busca en `table.columns` con `/movimiento sin armadura|unarmored movement/i` y se lee el número de pies del valor del nivel. Constantes con nombre: `SPEEDY_FEAT = "feat:speedy|xphb"`, `FAST_MOVEMENT_LEVEL = 5`, `UNARMORED_MOVEMENT_LEVEL = 2`.
- [ ] **Paso 4: Ejecutar** suite, tsc y eslint → PASS.
- [ ] **Paso 5: Commit** `feat(characters): desglose de CA, iniciativa y velocidad`.

### Tarea 3: Pestaña Información y diálogo de detalle

**Files:**
- Create: `lib/rules/dnd2024/statTexts.ts`, `app/components/characters/sheet/StatDialog.tsx`
- Modify: `app/components/characters/sheet/InfoTab.tsx` (y quien le pase datos, si necesita las entradas `skill` del catálogo para el respaldo)
- Test: `tests/dnd2024/statTexts.test.ts`

**Interfaces:**
- Consumes: `Derived.breakdowns` (Tareas 1 y 2).
- Produces:
  - `statTexts.ts`: `SKILL_TEXTS: Record<string, string>` (las 18 claves de `SKILL_ABILITIES`), `ABILITY_TEXTS: Record<Ability, string>`, `saveText(ability: Ability): string`, `AC_TEXT`, `INITIATIVE_TEXT`, `SPEED_TEXT`.
  - `StatDialog({ title, description, breakdown, unit, onClose, opener }: { title: string; description: string; breakdown: Breakdown; unit?: "feet"; onClose: () => void; opener: HTMLElement | null })`.

- [ ] **Paso 1: Prueba que falla**: `SKILL_TEXTS` tiene exactamente las 18 claves de `SKILL_ABILITIES` y ningún texto vacío; `ABILITY_TEXTS` las 6; `saveText("dex")` contiene «Destreza».
- [ ] **Paso 2: Ejecutar** → FAIL; **implementar** los textos (propios, breves, en español, inspirados en el SRD 5.2.1 en español) → PASS.
- [ ] **Paso 3: Implementar** según la spec §2 y §3:
  - Disposición: características más bajas (botones); franja con la tarjeta de PG y cuatro fichas compactas (CA, Iniciativa, Velocidad, Competencia; altura ≈ 56 px; en móvil PG a todo el ancho y las fichas en 2 × 2); CA con icono de alerta si hay `armorWarning`; Salvaciones y Habilidades con filas-botón y «Pasiva N» en Percepción, Perspicacia e Investigación.
  - `StatDialog` como `SpellDialog` (`role="dialog"`, `aria-modal`, foco atrapado, Escape, foco de vuelta al `opener` capturado al pulsar); título («Engaño (Car)», «Salvación de Destreza», «Fuerza», «Clase de armadura», «Iniciativa», «Velocidad»), descripción en recuadro, texto «Los modificadores que afectan a <título> son los siguientes:», tabla de partes con signo (`fmtMod`) y fila **Total**; en Velocidad, pies y el total con metros (`metersText`); notas bajo la tabla.
  - Respaldo de descripción de habilidad: la entrada `kind: "skill"` del catálogo (`descriptionEs || description`) si `SKILL_TEXTS` no la tiene.
  - Al imprimir, el diálogo no se imprime y los botones se ven como texto.
- [ ] **Paso 4: Verificar**: suite, tsc y eslint limpios; navegador (servidor «roll2go-dev», sesión del usuario ya iniciada; usar solo personajes propios de prueba creados para esto y borrarlos al final, o abrir en solo lectura los existentes sin modificarlos): pulsar una característica, una salvación, una habilidad con pericia, CA, Iniciativa y Velocidad; comprobar que el Total coincide con la ficha; Escape y foco de vuelta; 375 px sin desplazamiento horizontal.
- [ ] **Paso 5: Commit** `feat(characters): pestaña Información compacta con desgloses`.
