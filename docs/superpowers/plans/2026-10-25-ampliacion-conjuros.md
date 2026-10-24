# Ampliación de conjuros — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar los rasgos de conjuro de nivel alto del Manual 2024, completar los conjuros de dotes y del Pacto del tomo, y aligerar lo que las páginas de personaje envían al navegador.

**Architecture:** Las reglas viven en `lib/rules/dnd2024/**` (puras): `pendingChoices` pide las elecciones nuevas, `validate`/`validateLevel` las comprueban, `derive/spells.ts` las muestra en cada bloque y `spellOps.ts` gana dos ops de ficha (`setMastery`, `limited`). La interfaz reutiliza `SpellsStep` y `CasterBlockView`. Al final, las listas de conjuros pasan a pedirse bajo demanda.

**Tech Stack:** Next.js 16.3 (app router), React 19, Mongoose 9, Tailwind 4, vitest.

**Spec:** `docs/superpowers/specs/2026-10-25-ampliacion-conjuros-design.md`

## Global Constraints

- Antes de usar cualquier API de Next, leer su guía en `node_modules/next/dist/docs/`.
- `lib/rules/dnd2024/**` puro y probado con vitest; esquemas nuevos opcionales en `lib/rules/schemas.ts` (compatibles con homebrew).
- Elecciones nuevas en `levels[].choices` (borrar el nivel las deshace); la validación del servidor es la autoridad y usa las mismas reglas que el asistente.
- Nunca se supera un límite de preparados o trucos; los siempre preparados no cuentan.
- Escrituras de la ficha condicionales con `unchangedFilter` y `sheet.levels.$size`, como las ops existentes.
- Español; nombres de conjuro `nameEs ?? name`.
- Tras cambiar el importador: reimportar 5etools (README «Despliegue») y reiniciar «roll2go-dev».
- Un commit por tarea, en la rama `feat/ampliacion-conjuros`.

## Review Focus

- **Bardo que borra su nivel 10 con conjuros de Mago preparados** → se recortan (no quedan preparados de listas que ya no puede usar). Prueba en la Tarea 1.
- **Op `limited` con una clave que el personaje no tiene, o `used` fuera de 0..max** → 400 y nada cambia. Prueba en la Tarea 1.
- **Dominio de conjuros con un conjuro que deja de estar en el libro** → no aparece como siempre preparado y el selector lo deja vacío. Prueba en la Tarea 2.
- **El mismo truco elegido a la vez por la clase y por Iniciado en la magia en el mismo nivel** → 400 con el campo. Prueba en la Tarea 3.
- **Página del creador sin clase elegida** → no carga ninguna lista de conjuros; al elegir clase carga solo la suya. Prueba (navegador y tamaño medido) en la Tarea 5.

---

### Tarea 1: Secretos mágicos, Arcano místico y usos por descanso

**Files:**
- Modify: `lib/rules/dnd2024/levels.ts`, `validate.ts`, `validateLevel.ts`, `spellOps.ts`, `derive/spells.ts`, `sheet.ts`, `featureChoices.ts`, `app/api/characters/[id]/spells/route.ts` (campo de la op `limited`)
- Test: `tests/dnd2024/spellcasting.test.ts`, `tests/dnd2024/spellOps.test.ts`, `tests/dnd2024/validateLevel.test.ts`, `tests/dnd2024/pendingChoices.test.ts`

**Interfaces:**
- Produces:
  - Pendiente `spells` con `lists?: string[]` (Bardo ≥ 10: `["bard","cleric","druid","wizard"]`); `inClassList(block, entry)` acepta cualquiera de `block.lists` cuando existe; `CasterBlock.lists?: string[]`.
  - `Choice` `{ type: "arcanum"; source: string; value: Named }`; pendiente `{ type: "arcanum", source, count: 1, label: "Arcano místico", arcanum: { level: 6|7|8|9, list: "warlock" } }` en Brujo 11/13/15/17.
  - `sheet.limitedUsed?: Record<string, number>`; `CasterBlock.limited: { key: string; spell: Named; origin: string; max: number; used: number }[]` (clave `arcanum:<refKey>`); op `{ op: "limited"; key: string; used: number }`; `longRest` vacía también `limitedUsed`.

- [ ] **Paso 1: Pruebas que fallan**: Bardo 9 → `prepare` de un conjuro solo de Mago → error «… no está en la lista de Bardo.»; Bardo 10 → ok, y también en `checkSpells` al subir; Bardo 10→9 (`trimSpells`) quita ese preparado. Brujo 11 → pendiente `arcanum` nivel 6; conjuro de nivel 7 o de otra lista → error; Brujo 13 pide nivel 7. Op `limited` con clave inexistente → error; `used: 2` con `max: 1` → error; `used: 1` → ok; `longRest` → `limitedUsed: {}`. Los rasgos «magical secrets» y «mystic arcanum» salen de `NOT_A_CHOICE`.
- [ ] **Paso 2: Ejecutar** → FAIL.
- [ ] **Paso 3: Implementar** según las interfaces y la spec §2.1, §2.2 y §3.
- [ ] **Paso 4: Ejecutar** suite, `npx tsc --noEmit` (ignorar `.next/`), `npx eslint app lib tests` → limpios.
- [ ] **Paso 5: Commit** `feat(characters): Secretos mágicos, Arcano místico y usos por descanso largo`.

### Tarea 2: Conjuros extra del Bardo del Saber y del Mago, y Dominio de conjuros

**Files:**
- Modify: `lib/rules/dnd2024/levels.ts`, `validate.ts`, `validateLevel.ts`, `spellOps.ts`, `derive/spells.ts`, `sheet.ts`, `featureChoices.ts`, `app/api/characters/[id]/spells/route.ts`
- Test: los mismos archivos de prueba que la Tarea 1

**Interfaces:**
- Consumes: `limitedUsed`, `CasterBlock.limited`, op `limited` (Tarea 1).
- Produces:
  - `Choice` `{ type: "bonusSpells"; source: string; value: { spells: Named[]; replace?: { out: Named; in: Named } } }`; pendiente `bonusSpells` con `count`, `lists`, `cantripsOnly?`, `fromSpellbook?`, `level?` (exacto) o `maxLevel?`, `optionalReplace?`, `origin` (texto del bloque). Usos: Descubrimientos mágicos (Saber 6: 2, Clérigo/Druida/Mago, trucos o nivel con espacios; sustitución opcional en cada subida posterior de Bardo), Ilusiones mejoradas (solo si ya conoce Ilusión menor: 1 truco de Mago), Conjuros distintivos (Mago 20: 2, nivel 3, del libro; cada uno con `max: 1` en `limited`, clave `signature:<refKey>`).
  - Ilusión menor concedida a Ilusionista 3 como siempre preparado (origen «Ilusiones mejoradas») si no la conoce.
  - Pendiente `spells` del Mago con `free?: { count; school; maxLevel }` y `SpellChoice.free?: Named[]` (Sabio de la escuela: 2 al nivel 3 de Mago con `maxLevel` 2; 1 en cada nivel de Mago con nivel de espacio nuevo); entran en el libro.
  - `sheet.spellMastery?: { 1?: Ref; 2?: Ref }`; op `{ op: "setMastery"; level: 1 | 2; ref: Ref | null }` (Mago ≥ 18; del libro; nivel exacto; tiempo «1 acción»); `CasterBlock.mastery?: { 1: Ref | null; 2: Ref | null }`; los elegidos y presentes en el libro se suman a `always` (origen «Dominio de conjuros»).
  - Los conjuros de `bonusSpells` van a `always` del bloque de su clase con su origen; no cuentan para el límite.

- [ ] **Paso 1: Pruebas que fallan**: Saber 6 exige 2 de Clérigo/Druida/Mago; uno de nivel sin espacios → error; sustitución en Bardo 7; Ilusionista 3 sin Ilusión menor → la recibe sin elección; con ella ya conocida → pide 1 truco de Mago; Abjurador 3 → `free` 2 de Abjuración nivel ≤ 2 (otra escuela → error); Abjurador 5 (nivel de espacio 3) → `free` 1 con `maxLevel` 3; Mago 20 → 2 de nivel 3 de su libro, con usos en `limited`; `setMastery` con un conjuro fuera del libro, de nivel distinto o con tiempo de reacción → error; Mago 17 → error; un conjuro de Dominio que deja de estar en el libro no aparece en `always`. Sacar de `NOT_A_CHOICE` los rasgos tratados.
- [ ] **Paso 2: Ejecutar** → FAIL.
- [ ] **Paso 3: Implementar** según la spec §2.3–§2.7.
- [ ] **Paso 4: Ejecutar** suite, tsc y eslint → limpios.
- [ ] **Paso 5: Commit** `feat(characters): conjuros extra del Saber y del Mago y Dominio de conjuros`.

### Tarea 3: Dotes, Pacto del tomo y menores

**Files:**
- Modify: `lib/rules/import/normalize.ts`, `lib/rules/types.ts`, `lib/rules/schemas.ts`, `lib/rules/dnd2024/featSpells.ts`, `levels.ts`, `validate.ts`, `validateLevel.ts`, `levelOps.ts`, `derive/spells.ts`, `sheet.ts`
- Test: `tests/rules/normalize.test.ts`, `tests/dnd2024/validate.test.ts`, `tests/dnd2024/validateLevel.test.ts`, `tests/dnd2024/levelOps.test.ts`, `tests/dnd2024/spellcasting.test.ts`

**Interfaces:**
- Produces:
  - `FeatSpellsValue` gana `list?: string` y `replace?: { out: Named; in: Named }`; `FeatData.spellChoices` y `OptionalFeatureData.spellChoices` ganan `lists?: string[]`.
  - En cada subida, la elección `featSpells` de Iniciado en la magia ofrece `optionalReplace` (mismo nivel y lista del que sale).
  - Pacto del tomo: `OptionalFeatureData.spellChoices` con 3 trucos de cualquier lista y 2 rituales de nivel 1 de cualquier lista; elección `featSpells` con `feat` = la invocación; los conjuros, en «Otros» con origen «Pacto del tomo».

- [ ] **Paso 1: Pruebas que fallan**: normalize de la dote base de Iniciado en la magia → `spellChoices.lists = ["cleric","druid","wizard"]`; Pacto del tomo → `spellChoices` (3 trucos, 2 rituales nivel 1); `featSpells` de la dote base sin `list` → error; con `list: "druid"` y un conjuro de Mago → error; sustitución válida al subir y una de otro nivel → error; Pacto del tomo con un no-ritual → error; mismo truco por la clase y por la dote en el nivel 1 → error en el campo; un Mago con un conjuro de Mago dado por una dote puede copiarlo al libro (`copy` ok); `removeLastLevel` del nivel que dio la subclase quita su `spellOption`.
- [ ] **Paso 2: Ejecutar** → FAIL.
- [ ] **Paso 3: Implementar** según la spec §4; reimportar.
- [ ] **Paso 4: Ejecutar** suite, tsc y eslint → limpios; reimportación con 0 errores.
- [ ] **Paso 5: Commit** `feat(characters): conjuros de dotes y del Pacto del tomo`.

### Tarea 4: Interfaz de las elecciones y del bloque de conjuros

**Files:**
- Modify: `app/components/characters/levelup/steps/SpellsStep.tsx` (y `state.ts`, `LevelUpWizard.tsx`), `app/components/characters/CharacterCreator.tsx` (dote base y Pacto del tomo si salen en el nivel 1), `app/components/characters/spells/CasterBlockView.tsx`, `SpellsTab.tsx`
- Create: `app/components/characters/levelup/steps/BonusSpellsStep.tsx` (`arcanum` y `bonusSpells`), `app/components/characters/spells/LimitedUses.tsx`, `app/components/characters/spells/MasterySelector.tsx`

**Interfaces:**
- Consumes: todo lo de las Tareas 1–3.

- [ ] **Paso 1: Implementar**: el paso de conjuros acepta `lists` (filtro por lista con etiqueta) y `free` (sección «Gratis en tu libro (<escuela>)»); paso nuevo para `arcanum` y `bonusSpells` con contador «Elige N»; `featSpells` con desplegable de lista y sustitución opcional; en el bloque, secciones «Arcano místico» y «Conjuros distintivos» con casillas (op `limited`), y selector «Dominio de conjuros» (op `setMastery`) para el dueño; solo lectura para los demás. Borradores (`parseDraft`) con los campos nuevos.
- [ ] **Paso 2: Verificar**: suite, tsc, eslint; navegador (sesión del usuario; personajes de prueba propios de nivel alto creados por script en el scratchpad como en tareas anteriores, sin tocar personajes ajenos, borrados al final): Bardo 9→10 eligiendo un conjuro de Mago; Brujo 10→11 eligiendo el arcano y marcando su uso, descanso largo; Ilusionista 2→3 con Sabio; Mago 20 con Distintivos y Dominio; Bardo del Saber 5→6; Brujo con Pacto del tomo. 375 px sin desplazamiento horizontal.
- [ ] **Paso 3: Commit** `feat(characters): elegir y usar los conjuros de nivel alto`.

### Tarea 5: Aligerar las páginas

**Files:**
- Create: `app/api/rules/spells/route.ts`, `app/api/characters/[id]/spells/list/route.ts`, `lib/rules/dnd2024/spellTextClient.ts` (o división equivalente de `spellText.ts`)
- Modify: `lib/rules/catalog.ts` (filas ligeras), `app/(main)/characters/new/page.tsx`, `recreate/page.tsx`, `level-up/page.tsx`, `[id]/page.tsx`, el creador, el asistente, `SpellsTab.tsx`, `SpellDialog.tsx`, `app/api/characters/[id]/spells/[bookId]/[key]/route.ts` (devuelve `classNames`)
- Test: `tests/api/spellLists.test.ts`, `tests/dnd2024/spellText.test.ts`

**Interfaces:**
- Produces: `GET /api/rules/spells?list=<id>&books=<ids>&campaign=<id>` y `GET /api/characters/[id]/spells/list?list=<id>` → `{ spells: SpellRow[] }` con `SpellRow = { ref; name; nameEs; level; school; ritual; concentration; time; range; classes; tags }`; la ruta de detalle devuelve `classNames: string[]`.

- [ ] **Paso 1: Pruebas que fallan**: la ruta de reglas recorta `books` a los que el usuario puede usar (con campaña que limita libros, un libro no permitido no aparece); la de personaje solo usa los libros del personaje y un no-lector recibe 404; `spellTextClient` no importa `es.json` (prueba que lee el archivo y comprueba que no contiene `i18n/es.json`).
- [ ] **Paso 2: Medir** el tamaño de la respuesta de `/characters/new?system=dnd-2024` (HTML + RSC) en el navegador antes del cambio y anotarlo.
- [ ] **Paso 3: Implementar** según la spec §5: el creador y el asistente piden la lista al elegir clase o al llegar al paso; la ficha envía las listas completas solo con `tab=conjuros` y las pide al abrir la pestaña; `es.json` fuera de los componentes cliente.
- [ ] **Paso 4: Verificar**: suite, tsc, eslint; navegador: creador sin clase no pide listas, al elegir Mago carga solo la de Mago; asistente y pestaña Conjuros funcionan como antes; medir de nuevo y anotar antes/después en el informe.
- [ ] **Paso 5: Commit** `perf(characters): listas de conjuros bajo demanda`; actualizar `docs/superpowers/notes/conjuros-pendientes.md`.
