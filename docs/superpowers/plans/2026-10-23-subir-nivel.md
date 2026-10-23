# Subir de nivel (parte 4) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Asistente para subir de nivel del 2 al 20 con elecciones guiadas por los datos, multiclase con requisitos 2024, borrar el último nivel y rehacer la creación a nivel 1.

**Architecture:** El catálogo gana progresiones de clase, tabla de clase, datos de multiclase y rasgos opcionales. Una función pura `pendingChoices` decide qué elecciones exige cada nivel; la usan el asistente (cliente) y `validateLevel` (servidor). Las entradas se añaden y quitan de `sheet.levels[]` (hoja v2, implementada en el plan de la parte 3) con funciones puras `applyLevel`/`removeLastLevel`.

**Tech Stack:** Next.js 16.3, React 19, Mongoose 9, Tailwind 4, vitest, tsx.

**Spec:** `docs/superpowers/specs/2026-10-23-subir-nivel-design.md` (incluido el anexo §8)

## Global Constraints

- Requiere el plan `2026-10-23-ficha-personaje.md` completado (hoja v2, `derive/`, `loadCharacterFor`, `loadSheetEntries`).
- Antes de usar cualquier API de Next, leer su guía en `node_modules/next/dist/docs/`.
- Español en interfaz y errores; nombres `nameEs ?? name`; estilo y animaciones del proyecto; tema oscuro.
- Solo el dueño sube, borra niveles y rehace la creación; otros 404. `rateLimit("character_level", userId, 60, 3600)`.
- Nivel total máximo 20. PG: `average` = `floor(dado/2) + 1`; `roll` con token HMAC (como `rolls.ts`) ligado al usuario, 24 h, valor 1..dado; `max` solo en el nivel 1 de la primera clase.
- Multiclase: 13+ en la característica principal de cada clase actual y de la nueva (`any: true` → basta una de las alternativas).
- `lib/rules/dnd2024/**` puro y probado con vitest. Esquemas nuevos en `lib/rules/schemas.ts` (compartidos con homebrew).
- Commits: uno por tarea en la rama `feat/subir-nivel`.

## Review Focus

- **Elección enviada que no estaba pendiente, o que falta** → 400 con el campo. Prueba en la Tarea 4.
- **Subir en una clase nueva sin cumplir el requisito por la API** → 400. Prueba en la Tarea 4.
- **Borrar nivel con el personaje a nivel 1** → 400 «El nivel 1 no se puede borrar». Prueba en la Tarea 5.
- **Dos pestañas suben de nivel a la vez** → la segunda falla porque `n` no coincide (el cuerpo lleva `expectedLevel`; si no es el nivel actual + 1 → 409). Prueba en la Tarea 5.
- **Rasgo XPHB con elección en texto sin especificación** → el informe del importador lo lista y la lista queda vacía. Prueba en la Tarea 2.

---

### Tarea 1: Catálogo — progresiones, tabla, multiclase y rasgos opcionales

**Files:**
- Modify: `lib/rules/types.ts`, `lib/rules/schemas.ts`, `lib/rules/import/normalize.ts`, `scripts/import-5etools.ts` (leer `optionalfeatures.json`), `lib/rules/i18n/es.json` (títulos de subclase y opcionales), `lib/BookEntry.ts` (`kind` `optionalFeature`)
- Create: `tests/fixtures/5etools/` fragmentos: Hechicero (con `optionalfeatureProgression`), Guerrero (`featProgression` FS), Clérigo (rasgo con `options` Orden divina), 2 invocaciones y 2 metamagias de `optionalfeatures.json`
- Test: `tests/rules/normalize.test.ts`, `tests/rules/schemas.test.ts`

**Interfaces:**
- Produces (en `ClassData`):
  - `progressions: { feats: { category: string[]; levels: Record<number, number> }[]; optionalFeatures: { name: string; featureType: string[]; levels: Record<number, number> }[]; weaponMastery: Record<number, number> | null; cantrips: number[] | null; prepared: number[] | null; spellbook: number[] | null }` (`levels` = número acumulado por nivel de clase).
  - `table: { columns: { label: string; values: string[] }[] }` (20 valores por columna; `bonus` → «+2», dados → «1d6»).
  - `multiclass: { requirements: { abilities: Ability[]; any: boolean }; proficiencies: { armor: string[]; weapons: string[]; tools: string[]; skills: { count: number; from: string[] } | null } }`.
  - `subclassTitle: string`, `subclassLevel: number` (ya existe).
- `FeatureData` gana `options?: Ref[]` y `asi?: true`.
- Nuevo `kind: "optionalFeature"` con `OptionalFeatureData = { featureType: string[]; prerequisite?: { level?: number; spell?: Ref; pact?: string; feature?: string } }`.

- [ ] **Paso 1: Pruebas que fallan**: Hechicero → `progressions.optionalFeatures[0]` = `{ featureType: ["MM"], levels: { 2: 2, 10: 4, 17: 6 } }`; Bárbaro → `weaponMastery` `{1: 2, 4: 3, 10: 4}`, `multiclass.requirements.abilities === ["str"]`, `table.columns` con «Furias»; Guerrero → `feats[0].category` incluye `"FS"`; Clérigo nivel 1 «Divine Order» → `options.length === 2`; rasgo «Ability Score Improvement» → `asi: true`; invocación con prerrequisito de nivel 5 → `prerequisite.level === 5`; esquema rechaza `optionalFeature` sin `featureType`.
- [ ] **Paso 2: Ejecutar** → FAIL.
- [ ] **Paso 3: Implementar** normalizadores y esquemas; el importador lee `optionalfeatures.json` (fuente pedida) y añade al informe «Rasgos con elección en texto sin especificación» (rasgos de clase/subclase cuyo texto contiene `choose` y que no están en `featureChoices`, Tarea 2).
- [ ] **Paso 4: Ejecutar** → PASS; reimportar (`npm run import:5etools -- --data "C:/Users/Usuario/Documents/GitHub/5etools/5etools-src/data"`) → 0 errores de validación; tsc/eslint limpios.
- [ ] **Paso 5: Commit** `feat(rules): progresiones de clase y rasgos opcionales`.

---

### Tarea 2: `featureChoices` y `pendingChoices`

**Files:**
- Create: `lib/rules/dnd2024/featureChoices.ts`, `lib/rules/dnd2024/levels.ts`
- Test: `tests/dnd2024/pendingChoices.test.ts`

**Interfaces:**
- Consumes: datos de la Tarea 1; `LevelEntry`, `Choice`, `Dnd2024SheetV2` (plan parte 3).
- Produces:
  - `type ChoiceSpec = { type: "skills" | "expertise" | "featureOption"; count: number; from?: string[] }`; `FEATURE_CHOICES: Record<string, ChoiceSpec[]>` (claves `classFeature:…|xphb|N` / `subclassFeature:…`).
  - `type PendingChoice = { type: Choice["type"]; source: string; count: number; from?: string[]; options?: Ref[]; category?: string[]; featureType?: string[]; label: string; optionalReplace?: boolean }`.
  - `pendingChoices(sheet: Dnd2024SheetV2, classRef: Ref, newClassLevel: number, entries: Map<string, CatalogEntry>): PendingChoice[]` — reglas 1–9 de la spec §3 (la regla 8, conjuros, devuelve `[]` hasta la parte 5).
  - `meetsMulticlass(sheet, derived: Derived, newClass: CatalogEntry, entries): { ok: true } | { ok: false; reason: string }`.

- [ ] **Paso 1: Pruebas que fallan** (con los fixtures):
  - Bárbaro 2 → `[]`; Bárbaro 3 → `subclass` + `skills` (Conocimiento primigenio, 1); Bárbaro 4 → `asi` + `weaponMastery` (count 1: de 2 a 3).
  - Guerrero 1 (al rehacer creación) → `feat` categoría FS; Hechicero 2 → `optionalFeature` MM count 2; Clérigo 1 → `featureOption` con 2 opciones; Pícaro 6 → `expertise` 2; Bárbaro 19 → `asi` y `feat` EB.
  - Entrada en Explorador como multiclase → `skills` count 1.
  - `meetsMulticlass`: FUE 12 → `{ ok: false, reason: "Necesitas 13 en Fuerza" }`.
  - Todos los rasgos XPHB con `choose` en el texto tienen entrada en `FEATURE_CHOICES` (prueba que recorre la lista que genera el importador desde el fixture de clases).
- [ ] **Paso 2: Ejecutar** → FAIL.
- [ ] **Paso 3: Implementar.**
- [ ] **Paso 4: Ejecutar** → PASS.
- [ ] **Paso 5: Commit** `feat(characters): elecciones pendientes por nivel`.

---

### Tarea 3: Creador — elecciones de nivel 1, maestrías, pronombres, nombres e interfaz

**Files:**
- Modify: `app/components/characters/CharacterCreator.tsx` (y `fields/`), `app/components/characters/AbilityScores.tsx`, `app/api/dice/ability-rolls/route.ts`, `lib/rules/dnd2024/rolls.ts`, `lib/rules/dnd2024/validate.ts`, `lib/rules/dnd2024/sheet.ts` (`weaponMasteries`, `rolls.dice`), `lib/rules/dnd2024/derive/attacks.ts` y `derive/index.ts` (maestría desde `weaponMasteries`), `lib/Character.ts` (`pronouns`), `app/api/characters/route.ts` y `app/api/characters/[id]/route.ts` (pronombres), `app/components/characters/sheet/SheetHeader.tsx` (pronombres), `app/(main)/characters/[id]/edit/*` (pronombres y generador), `scripts/import-5etools.ts`, `lib/rules/import/normalize.ts` (`nameTable`), `lib/rules/types.ts`, `lib/rules/schemas.ts`, `lib/BookEntry.ts`, `lib/rules/dnd2024/labels.ts` (propiedades de maestría en español: Hendir, Rozar, Mellar, Empujar, Ralentizar, Derribar, Vejar, Debilitar — comprobar con el SRD 5.2.1 en español)
- Create: `app/components/characters/ClassBadge.tsx`, `app/components/characters/fields/SkillPicker.tsx` (fila de desplegables), `app/components/characters/fields/PronounsField.tsx`, `app/components/characters/NameGeneratorButton.tsx`, `app/components/characters/ClassFeaturesSection.tsx`, `app/api/rules/names/route.ts`, `lib/rules/dnd2024/names.ts`, `lib/rules/dnd2024/masteries.ts`, `app/api/characters/[id]/masteries/route.ts`, `app/components/characters/sheet/MasteriesEditor.tsx`
- Test: `tests/dnd2024/names.test.ts`, `tests/dnd2024/masteries.test.ts`, `tests/dnd2024/validate.test.ts`, `tests/dnd2024/rolls.test.ts`, `tests/rules/normalize.test.ts`

**Interfaces:**
- Consumes: `pendingChoices`, `PendingChoice` (Tarea 2).
- Produces:
  - `sheet.weaponMasteries: Ref[]`; `sheet.rolls: { values: number[]; token: string; dice?: number[][] } | null`; `Character.pronouns: ("he" | "she" | "they")[]` (por defecto `[]`).
  - `rollAbilityScoresDetailed(rng?): { values: number[]; dice: number[][] }` (cada `dice[i]` son los 4 dados en el orden tirado); `POST /api/dice/ability-rolls` devuelve `{ values, token, dice }`.
  - `type NameTableData = { species: string; tables: { option: string; gender: "male" | "female" | "family" | "other"; names: string[] }[] }`; `generateName(tables: NameTableData, pronouns: ("he" | "she" | "they")[], rng?): string`; `GET /api/rules/names?species=<identifier>&pronouns=he,they` → `{ name }`.
  - `validateMasteries(refs: Ref[], ctx: { allowed: number; entries: Map<string, CatalogEntry>; proficientWith: (item: CatalogEntry) => boolean }): { ok: true } | { ok: false; error: string }`; `PATCH /api/characters/[id]/masteries` `{ masteries: Ref[] }` → `{ weaponMasteries }`.
  - `validateSheet` exige en `levels[0].choices` exactamente las elecciones de `pendingChoices(hoja, clase, 1)` y rellena `weaponMasteries` con las `weaponMastery` elegidas.

- [ ] **Paso 1: Pruebas que fallan**:
  - `generateName` (fragmentos reales de `names.json` en `tests/fixtures/5etools/names.json`): `["he"]` → nombre de la tabla masculina + apellido/clan si hay tabla `family`; `["she"]` → femenina; `["they"]` o `["he","she"]` → de cualquiera de las dos; especie sin tabla (`goliath`) → tablas de Humano.
  - Normalizador: fragmento Dwarf → `nameTable` con `gender` `female`/`male`/`family`; Elf «Female Adult» → `female`.
  - `validateSheet`: Clérigo 1 sin Orden divina → error en `levels.0.choices`; con ella → ok; Bárbaro 1 con 1 maestría → error (exige 2); con 2 → ok y `weaponMasteries.length === 2`.
  - `validateMasteries`: 3 armas con `allowed` 2 → error; arma a distancia → error; arma sin propiedad de maestría → error; arma sin competencia → error.
  - `rollAbilityScoresDetailed`: cada `values[i]` es la suma de los 3 dados más altos de `dice[i]`, y `dice[i].length === 4`.
- [ ] **Paso 2: Ejecutar** → FAIL.
- [ ] **Paso 3: Implementar** según el anexo §8 de la spec:
  - creador: etiqueta «Escoger clase inicial»; `ClassBadge` circular (`/images/classes/<identifier>.webp`, respaldo a círculo vacío con `onError`); sección **Rasgos de clase** (`ClassFeaturesSection`: rasgos automáticos plegables + un desplegable por elección pendiente); Legado oculto si la especie no tiene legados; `SkillPicker` en habilidades de especie y de clase; tiradas sin arrastre, asignadas con desplegables y con tooltip (ratón y foco) de los 4 dados: descartado atenuado, 1 en rojo, 6 en verde; `PronounsField` y 🎲 junto a Nombre;
  - Editar: pronombres y 🎲; cabecera de la ficha con los pronombres («Él/Elle»);
  - ficha: `MasteriesEditor` en la pestaña Rasgos (dueño) con «Espada corta (Vejar)»; ataques con la etiqueta de maestría desde `weaponMasteries`;
  - importación de `names.json` a un libro oficial `XGE` («Guía de Xanathar para todo», `license.type: "official"`) como `nameTable`; reimportar.
- [ ] **Paso 4: Ejecutar** → PASS; tsc/eslint limpios; navegador (sesión del usuario): crear un Clérigo 1 eligiendo Orden divina y un Bárbaro 1 con 2 maestrías, generar nombres con distintos pronombres, ver los dados al pasar el ratón por una tirada, cambiar maestrías en la ficha de «Kael Prueba» y revertir. Borrar después los personajes creados para la prueba.
- [ ] **Paso 5: Commit** `feat(characters): elecciones de nivel 1, maestrías, pronombres y nombres`.

---

### Tarea 4: `validateLevel`, tirada de dado de golpe y `derive` multiclase

**Files:**
- Create: `lib/rules/dnd2024/validateLevel.ts`, `app/api/dice/hit-die/route.ts`
- Modify: `lib/rules/dnd2024/rolls.ts` (`signHitDie`, `verifyHitDie`), `lib/rules/dnd2024/derive/*` (mejoras de característica, pericia, maestrías, habilidades de elecciones, competencias de multiclase, salvaciones solo de la primera clase, Ataque adicional no acumulable, valores de tabla en rasgos, dotes de nivel en `features`)
- Test: `tests/dnd2024/validateLevel.test.ts`, `tests/dnd2024/derive.test.ts`, `tests/dnd2024/rolls.test.ts`

**Interfaces:**
- Produces:
  - `signHitDie(userId: string, die: number, value: number, now?): string`, `verifyHitDie(userId, die, value, token, now?): boolean`.
  - `POST /api/dice/hit-die` `{ die }` (6, 8, 10, 12) → `{ value, token }`, `rateLimit("hit_die", userId, 120, 3600)`.
  - `validateLevel(sheet: Dnd2024SheetV2, input: unknown, ctx: { userId: string; books: string[]; resolve: (ref: Ref) => Promise<CatalogEntry | null>; entries: Map<string, CatalogEntry> }): Promise<{ ok: true; entry: LevelEntry } | { ok: false; errors: Record<string, string> }>` — input `{ expectedLevel, class, choices, hp }`.

- [ ] **Paso 1: Pruebas que fallan**:
  - `validateLevel`: elección no pendiente → error; falta una → error; `asi` que lleva una característica a 21 → error; invocación con prerrequisito de nivel 5 a Brujo 2 → error; dote general con prerrequisito no cumplido → error; requisito de multiclase no cumplido → error; nivel 21 → error; `hp.average` de un d12 distinto de 7 → error; `hp.roll` con token ajeno/caducado/valor 13 en d12 → error; `hp.max` fuera del nivel 1 de la primera clase → error; `Named.name` siempre del catálogo.
  - `derive`: Bárbaro 4 con `asi` +2 FUE → FUE sube 2; Bárbaro 3 + Clérigo 1 → competencia +2 (nivel total 4), salvaciones solo FUE/CON (las del Clérigo no se ganan), competencias = las del Bárbaro ∪ `multiclass.proficiencies` del Clérigo sin duplicados; pericia duplica la competencia; el rasgo Furia muestra el valor de tabla de su nivel («2»).
- [ ] **Paso 2: Ejecutar** → FAIL.
- [ ] **Paso 3: Implementar.**
- [ ] **Paso 4: Ejecutar** → PASS; tsc/eslint limpios.
- [ ] **Paso 5: Commit** `feat(characters): validación de nivel y PG por nivel`.

---

### Tarea 5: Rutas de niveles y notificación

**Files:**
- Create: `app/api/characters/[id]/levels/route.ts` (`POST`), `app/api/characters/[id]/levels/last/route.ts` (`DELETE`), `lib/rules/dnd2024/levelOps.ts`
- Modify: `lib/notificationText.ts` (`character_level_up`, preferencia `dm`), `lib/notify.ts` si hace falta
- Test: `tests/dnd2024/levelOps.test.ts`, `tests/notificationText.test.ts`

**Interfaces:**
- Produces:
  - `applyLevel(sheet: Dnd2024SheetV2, entry: LevelEntry, maxHpBefore: number, maxHpAfter: number): Dnd2024SheetV2` — añade la entrada, recalcula `classesSummary`, sube `hp.current` con el máximo si estaba al máximo.
  - `removeLastLevel(sheet, maxHpAfter): { ok: true; sheet } | { ok: false; error: string }` — error a nivel 1; recorta `hp.current`.
  - `POST /api/characters/[id]/levels` → 201 `{ level }` | 400 `{ errors }` | 409 si `expectedLevel !== nivel actual + 1`; notifica al DM (`character_level_up`, texto «{actor} ha subido a {personaje} a nivel N», enlace a la ficha) si hay campaña y el dueño no es el DM.
  - `DELETE /api/characters/[id]/levels/last` → `{ ok: true }` | 400.

- [ ] **Paso 1: Pruebas que fallan**: `applyLevel` añade y resume clases («Bárbaro 3 / Clérigo 1»); PG actuales al máximo suben con él; `removeLastLevel` a nivel 1 → error; recorta PG; `describeNotification` del tipo nuevo; `emailPrefFor("character_level_up") === "dm"`.
- [ ] **Paso 2: Ejecutar** → FAIL.
- [ ] **Paso 3: Implementar** (rutas con `loadCharacterFor(..., "write")`, `rateLimit("character_level", …)`).
- [ ] **Paso 4: Ejecutar** → PASS.
- [ ] **Paso 5: Commit** `feat(characters): guardar y borrar niveles`.

---

### Tarea 6: Asistente `/characters/[id]/level-up`

**Files:**
- Create: `app/(main)/characters/[id]/level-up/page.tsx`, `app/components/characters/levelup/LevelUpWizard.tsx`, `ClassCard.tsx`, `steps/ClassStep.tsx`, `steps/FeaturesStep.tsx`, `steps/SubclassStep.tsx`, `steps/AsiStep.tsx`, `steps/PickStep.tsx` (feat/optionalFeature/featureOption), `steps/ChoiceRowsStep.tsx` (skills/expertise/weaponMastery con el `SkillPicker` de la Tarea 3: fila de desplegables), `steps/HpStep.tsx`, `steps/ConfirmStep.tsx`
- Modify: `app/components/characters/sheet/SheetHeader.tsx` (volver a mostrar **Subir de nivel**, que la rama de la ficha ocultó; **Borrar nivel** con confirmación, dueño y nivel ≥ 2)

**Interfaces:**
- Consumes: `pendingChoices`, `meetsMulticlass` (cliente: el servidor pasa las entradas necesarias serializadas), `POST /api/dice/hit-die`, `POST .../levels`, `DELETE .../levels/last`, `RuleSelect`, `AbilityScores`.

- [ ] **Paso 1: Implementar** según la spec §4.1: dos columnas (tarjeta derecha con icono `CLASS_ICONS`, descripción, dado, tabla con la fila nueva resaltada; en móvil arriba plegada), pasos en el orden de la spec, Siguiente desactivado con «Falta: …», borrador en `localStorage` (`roll2go:level-up:<id>:<n>`, try/catch), PG con Media/Tirar (animación del dado)/Máximo, resumen y **Confirmar nivel** → ficha con `?saved=level`.
- [ ] **Paso 2: Verificar** tsc/eslint limpios; en el navegador: Bárbaro de 1 a 4 (subclase Berserker, Conocimiento primigenio, asi, maestría); Guerrero a 3 con multiclase en Pícaro (requisito explicado si falta DES 13); crear un Hechicero de prueba y subirlo a 2 (metamagia); borrar nivel; recargar a mitad conserva el borrador; móvil.
- [ ] **Paso 3: Commit** `feat(characters): asistente para subir de nivel`.

---

### Tarea 7: Rehacer creación

**Files:**
- Create: `app/(main)/characters/[id]/recreate/page.tsx`, `app/api/characters/[id]/creation/route.ts` (`PUT`)
- Modify: `app/components/characters/CharacterCreator.tsx` (modo `recreate` con valores iniciales y destino `PUT`), `app/(main)/characters/[id]/edit/page.tsx` (botón **Rehacer creación** solo a nivel 1)

**Interfaces:**
- Produces: `PUT /api/characters/[id]/creation` — solo dueño y nivel 1; mismas validaciones que el alta; sustituye datos de creación y `levels[0]`, vuelve a volcar el inventario inicial → 200 `{ id }` | 400 `{ errors }`.

- [ ] **Paso 1: Implementar** con aviso previo «Se reiniciará el inventario con el equipo inicial elegido».
- [ ] **Paso 2: Verificar** en el navegador: rehacer un personaje de nivel 1 cambiando especie y trasfondo; con nivel ≥ 2 el botón no aparece y la ruta devuelve 400.
- [ ] **Paso 3: Commit** `feat(characters): rehacer la creación a nivel 1`.

---

### Tarea 8: Verificación de extremo a extremo

- [ ] `npx vitest run`, tsc, eslint limpios; reimportación sin errores e informe sin rasgos «choose» pendientes.
- [ ] Navegador con la sesión del usuario: subir y borrar niveles en dos personajes, multiclase, notificación al DM (si el usuario no es el DM, comprobar en base de datos), vista de lectura del DM, móvil.
- [ ] Informar de lo verificado y lo no verificado.
