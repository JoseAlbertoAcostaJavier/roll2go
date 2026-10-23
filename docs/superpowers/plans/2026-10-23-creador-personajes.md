# Creador de personajes D&D 2024 (partes 1 y 2) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importar el Manual del Jugador 2024 de 5etools a un catálogo de reglas en MongoDB y construir el asistente de creación de personajes y la página "Mis personajes".

**Architecture:** El catálogo reutiliza `Book`/`BookEntry` con un esquema por tipo compartido entre importación y homebrew (`lib/rules/schemas.ts`). Un script `tsx` normaliza 5etools y guarda de forma idempotente. Toda lectura pasa por `lib/rules/catalog.ts`, que decide los libros usables. El personaje guarda elecciones (`sheet`); `validate` y `derive` son funciones puras compartidas por asistente, ficha y futuro exportador a Foundry.

**Tech Stack:** Next.js 16.3 (app router, sin Cache Components), React 19, Mongoose 9, Tailwind 4, lucide-react; nuevas dependencias de desarrollo `vitest` y `tsx`.

**Spec:** `docs/superpowers/specs/2026-10-22-creador-personajes-design.md`

## Global Constraints

- Antes de usar cualquier API de Next, leer su guía en `node_modules/next/dist/docs/` (lo exige `AGENTS.md`).
- Caché: `unstable_cache` de `next/cache` con `tags` y `revalidate: 3600`; invalidar con `revalidateTag(tag, "max")` (la forma sin segundo argumento está obsoleta).
- Toda la interfaz y los mensajes de error en español; los nombres de reglas se muestran con `nameEs ?? name`.
- Estilo: tokens de `app/globals.css` (`surface`, `panel`, `line`, `fg`, `muted`, `brand`, `brand-soft`), `card`/`cardTitle`/`field`/`labelClass`/`primaryButton` de `app/components/formStyles.ts`, animaciones `animate-fade-up`, `animate-fade-in`, `animate-pop`.
- Textos de usuario: `cleanText` de `lib/utils.ts` y longitud máxima; rutas de escritura con `rateLimit` de `lib/rateLimit.ts`; sesión con `sessionOf` de `lib/campaignApi.ts`.
- Libro o entrada no visible → 404 ("no se revela que existe").
- Ningún dato de 5etools se copia al repositorio salvo los fragmentos mínimos de prueba en `tests/fixtures/5etools/`.
- Reparto de puntos: 27 puntos, valores 8–15, costes 8→0, 9→1, 10→2, 11→3, 12→4, 13→5, 14→7, 15→9. Valores predefinidos: 15, 14, 13, 12, 10, 8. Manual: 3–20. Trasfondo: +2/+1 o +1/+1/+1 en sus tres características, total ≤ 20.
- Atribución del SRD 5.2 (literal, guardada en `Book.license.attribution` con `--srd-only`): "This work includes material from the System Reference Document 5.2 (\"SRD 5.2\") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode."
- No hacer commits sin que el usuario lo haya autorizado para esta ejecución (los pasos "Commit" asumen esa autorización).

## Review Focus

- **Reimportar con `--srd-only` borra entradas que usan personajes ya creados** → el personaje debe seguir cargando y mostrar el nombre guardado con "contenido no disponible". Prueba en la Tarea 8.
- **Un usuario manipula `books` o `campaign` en la URL o en el POST** para usar libros ajenos o saltarse el filtro de la campaña → el servidor ignora lo no permitido. Prueba en la Tarea 6.
- **Reutilizar un token de tiradas de otro usuario o caducado** → rechazo. Prueba en la Tarea 7.
- **Buscar sin tildes ni mayúsculas** ("draconido", "ENANO") → encuentra "Dracónido", "Enano". Prueba en la Tarea 1 (`normalizeName`) y la Tarea 6.
- **Especie sin legados pero con legado enviado, o legado de otra especie** → rechazo. Prueba en la Tarea 7.

---

### Tarea 1: Herramientas, tipos y esquemas compartidos

**Files:**
- Modify: `package.json` (devDependencies `vitest`, `tsx`; scripts `"test": "vitest run"`, `"import:5etools": "tsx scripts/import-5etools.ts"`)
- Create: `vitest.config.ts` (alias `@` → raíz, entorno `node`)
- Create: `lib/rules/types.ts`, `lib/rules/schemas.ts`
- Test: `tests/rules/schemas.test.ts`

**Interfaces:**
- Produces:
  - `type Ability = "str"|"dex"|"con"|"int"|"wis"|"cha"`; `ABILITIES: Ability[]`
  - `type Ref = { book: string; key: string }`
  - `type EntryKind = "species"|"lineage"|"class"|"subclass"|"classFeature"|"subclassFeature"|"background"|"feat"|"spell"|"item"|"language"|"skill"`
  - `type Pack = { ref?: Ref; quantity?: number; value?: number; displayName?: string }`
  - Un tipo `XxxData` por kind con los campos de la spec §3.2 (`SpeciesData`, `LineageData`, `ClassData`, `SubclassData`, `FeatureData`, `BackgroundData`, `FeatData`, `SpellData`, `ItemData`, `LanguageData`, `SkillData`) y `EntryData = { species: SpeciesData; … }`
  - `validateEntryData<K extends EntryKind>(kind: K, data: unknown): { ok: true; value: EntryData[K] } | { ok: false; errors: string[] }`
  - `normalizeName(s: string): string` — minúsculas y sin diacríticos (`NFD` + quitar `\p{M}`)

- [ ] **Paso 1: Instalar `vitest` y `tsx`, añadir scripts y `vitest.config.ts`**

Run: `npm i -D vitest tsx` → Expected: se instalan sin errores.

- [ ] **Paso 2: Escribir las pruebas que fallan**

```ts
test("species válida", () => {
  const r = validateEntryData("species", { size: ["M"], speed: 30, darkvision: 60, creatureType: "humanoid",
    skills: { fixed: ["perception"] }, spells: [], hasLineages: true });
  expect(r.ok).toBe(true);
});
test("background exige exactamente 3 características", () => {
  const r = validateEntryData("background", { abilities: ["int", "wis"], feat: { book: "b", key: "k" },
    skills: [], tools: [], equipment: { A: [], B: [] } });
  expect(r.ok).toBe(false);
});
test("class rechaza hitDie no válido", () => {
  expect(validateEntryData("class", { ...barbarianData, hitDie: 7 }).ok).toBe(false);
});
test("normalizeName quita tildes y mayúsculas", () => {
  expect(normalizeName("Dracónido")).toBe("draconido");
  expect(normalizeName("ENANO")).toBe("enano");
});
```

- [ ] **Paso 3: Ejecutar** `npx vitest run tests/rules/schemas.test.ts` → Expected: FAIL (módulo no existe).
- [ ] **Paso 4: Implementar tipos y validadores.** Validador propio, sin librerías: un objeto `validators: { [K in EntryKind]: (d: unknown) => string[] }` con comprobaciones de tipo y rango (`hitDie ∈ {6,8,10,12}`, `abilities.length === 3`, `level 0–9` en conjuros…). Errores en español con la ruta del campo (`"abilities: deben ser 3"`).
- [ ] **Paso 5: Ejecutar** las pruebas → Expected: PASS.
- [ ] **Paso 6: Commit** `feat(rules): tipos y esquemas compartidos del catálogo`.

---

### Tarea 2: Modelos `Book`/`BookEntry` y sustitución de `lib/books.ts`

**Files:**
- Modify: `lib/Book.ts` (añadir `key: { type: String, default: "" }`, `license.type` enum `["own","srd","official"]`; índice único parcial `{key:1}` con `partialFilterExpression: { owner: null, key: { $gt: "" } }`)
- Modify: `lib/BookEntry.ts` (kinds de la Tarea 1; campos `key`, `identifier`, `parent: { book, key }`, `nameEs`, `descriptionEs`, `srd52`, `foundry: Mixed`; índices `{book:1,key:1}` único, `{book:1,kind:1,nameLower:1}`, `{kind:1,"parent.key":1}`; `nameLower` = `normalizeName(nameEs || name)`)
- Create: `lib/rules/books.ts`
- Delete: `lib/books.ts`
- Modify (pasar a `lib/rules/books.ts`, ahora asíncrono): `lib/CampaignRules.ts`, `lib/campaignInput.ts`, `lib/campaignContext.ts`, `app/components/CampaignForm.tsx` (tipo `Book` → `BookOption`), `app/(main)/campaigns/new/page.tsx`, `app/(main)/campaigns/[id]/edit/page.tsx`, `app/(main)/campaigns/[id]/(view)/page.tsx`, `app/api/profile/books/route.ts`, `app/api/campaigns/route.ts`, `app/api/campaigns/[id]/route.ts`
- Modify: comentarios de `lib/Character.ts` y `lib/User.ts` ("ids de `Book`")
- Create: `scripts/migrate-book-ids.ts` (script `"migrate:books": "tsx scripts/migrate-book-ids.ts"`)
- Modify: `app/api/books/[id]/entries/route.ts` y `[entryId]/route.ts` para usar los kinds y campos nuevos (`nameLower` con `normalizeName`)
- Test: `tests/rules/campaignRules.test.ts`

**Interfaces:**
- Consumes: `EntryKind`, `normalizeName` (Tarea 1).
- Produces:
  - `type BookOption = { id: string; key: string; systemId: string; name: string; license: "own"|"srd"|"official"; attribution: string }`
  - `officialBooksOf(systemId: string): Promise<BookOption[]>` y `booksByIds(ids: string[]): Promise<BookOption[]>`
  - `LEGACY_BOOK_KEYS: Record<string, string>` = `{ "dnd-2024-phb": "XPHB", "dnd-2024-dmg": "XDMG", "dnd-2024-mm": "XMM", "dnd-5-phb": "PHB", "dnd-5-dmg": "DMG", "dnd-5-mm": "MM" }`
  - `booksForCharacter(c, systemBooks: BookOption[])` y `booksAreValid(c, kind, bookIds, systemBooks)` en `lib/CampaignRules.ts`: la lista de libros del sistema pasa a ser parámetro (las funciones siguen siendo puras).

- [ ] **Paso 1: Prueba que falla**: `booksForCharacter` con `restrictBooks: true` devuelve solo los ids permitidos de `systemBooks`; `booksAreValid` rechaza ids de otro sistema y, para `internal`, ids fuera de `allowedBooks`.
- [ ] **Paso 2: Ejecutar** → Expected: FAIL (firma nueva).
- [ ] **Paso 3: Implementar** modelos, `lib/rules/books.ts`, nuevas firmas y actualizar todos los llamadores listados (las páginas cargan `officialBooksOf` en el servidor y se lo pasan a `CampaignForm`).
- [ ] **Paso 4: Implementar `scripts/migrate-book-ids.ts`**: para `Campaign.allowedBooks`, `Character.books` y `User.ownedBooks`, sustituye cada id antiguo por el `_id` del `Book` oficial cuya `key` indica `LEGACY_BOOK_KEYS`; descarta los que no existan; imprime cuántos documentos cambió. Idempotente (los ObjectId válidos se dejan).
- [ ] **Paso 5: Verificar** `npx vitest run` → PASS; `npx tsc --noEmit` → sin errores fuera de `.next/`; `npx eslint app lib` → sin errores.
- [ ] **Paso 6: Commit** `refactor(books): libros de reglas desde la base de datos`.

---

### Tarea 3: Conversión de texto de 5etools a BBCode y etiqueta `[ref]`

**Files:**
- Create: `lib/rules/import/toBbcode.ts`
- Modify: `lib/bbcode.ts` (nodo `{ type: "ref", target: string, children }` para `[ref=tipo:clave]…[/ref]`), `app/components/Bbcode.tsx` (renderizar `ref` como `<span className="font-semibold text-brand-soft">`)
- Test: `tests/rules/toBbcode.test.ts`, ampliar la prueba de `lib/bbcode.ts` si existe o crear `tests/bbcode.test.ts`

**Interfaces:**
- Produces: `inlineTags(s: string): string` y `entriesToBbcode(entries: unknown[]): string`.

- [ ] **Paso 1: Pruebas que fallan**

```ts
expect(inlineTags("{@b Hola} y {@i tú}")).toBe("[b]Hola[/b] y [i]tú[/i]");
expect(inlineTags("{@spell Fireball|XPHB}")).toBe("[ref=spell:fireball|xphb]Fireball[/ref]");
expect(inlineTags("{@item Handaxe|XPHB|Handaxes}")).toBe("[ref=item:handaxe|xphb]Handaxes[/ref]");
expect(inlineTags("{@dice 1d8} y {@dc 15}")).toBe("[b]1d8[/b] y [b]CD 15[/b]");
expect(inlineTags("{@desconocida algo|X}")).toBe("algo");
expect(entriesToBbcode(["Uno", { type: "list", items: ["a", "b"] }]))
  .toBe("Uno\n\n[list]\n[*]a\n[*]b\n[/list]");
expect(entriesToBbcode([{ type: "entries", name: "Rasgo", entries: ["Texto"] }])).toBe("[b]Rasgo.[/b] Texto");
expect(parseBbcode("[ref=spell:fireball|xphb]Bola[/ref]")[0]).toMatchObject({ type: "ref", target: "spell:fireball|xphb" });
```

- [ ] **Paso 2: Ejecutar** → FAIL.
- [ ] **Paso 3: Implementar.** Etiquetas de referencia (las de la spec §3.3 paso 4): texto mostrado = tercer segmento si existe, si no el primero; clave = `primero|fuente` en minúsculas (fuente por defecto `xphb`). Las etiquetas pueden anidarse: resolver de dentro hacia fuera en bucle hasta que no queden `{@`. Tablas (`type: "table"`) → filas como líneas `col1 · col2`. `inset`/`insetReadaloud`/`quote` → su contenido.
- [ ] **Paso 4: Ejecutar** → PASS.
- [ ] **Paso 5: Commit** `feat(rules): conversión de 5etools a BBCode`.

---

### Tarea 4: Normalizadores por tipo

**Files:**
- Create: `lib/rules/import/normalize.ts` (un `normalizeX(raw, ctx)` por kind y `expandVersions(race)`, `resolveCopy(raw, all)`)
- Create: `tests/fixtures/5etools/` con fragmentos mínimos copiados de los datos reales: Elfo (con `_versions`), Acólito, Bárbaro (clase + 3 rasgos), Path of the Berserker, Fireball, Greataxe, Explorer's Pack, Magic Initiate
- Test: `tests/rules/normalize.test.ts`

**Interfaces:**
- Consumes: `validateEntryData`, tipos (Tarea 1); `entriesToBbcode` (Tarea 3).
- Produces:
  - `type NormalizedEntry = { kind: EntryKind; key: string; identifier: string; parent: { key: string } | null; name: string; description: string; srd52: boolean; data: EntryData[EntryKind] }`
  - `normalizeAll(files: RawFiles, source: string): { entries: NormalizedEntry[]; errors: { key: string; errors: string[] }[] }` donde `RawFiles` agrupa los JSON leídos por nombre.
  - `identifier` = nombre en minúsculas con espacios → `-` y sin signos (`"Fireball"` → `fireball`, `"Explorer's Pack"` → `explorers-pack`).

- [ ] **Paso 1: Pruebas que fallan**, con los fixtures:
  - Elfo → 1 `species` (`hasLineages: true`, `darkvision: 60`, `skills.choose` = 1 de `["insight","perception","survival"]`) + 3 `lineage` (`drow`, `high elf`, `wood elf`) con `parent.key === "elf|xphb"`; el Drow con `darkvision: 120`.
  - Acólito → `abilities: ["int","wis","cha"]`, `feat.key === "magic initiate; cleric|xphb"`, `skills: ["insight","religion"]`, `equipment.B` = `[{ value: 5000 }]`.
  - Bárbaro → `hitDie: 12`, `saves: ["str","con"]`, `skills.count === 2`, 6 opciones; `features[0]` = `{ ref.key: "rage|barbarian|xphb|1", level: 1 }`; `subclassLevel: 3`.
  - Fireball → `level: 3`, `school: "V"`, `classes` incluye `"wizard"`.
  - Greataxe → `weapon.damage === "1d12"`, `weapon.mastery === "cleave"`.
  - Una entrada inválida aparece en `errors` y no en `entries`.
- [ ] **Paso 2: Ejecutar** → FAIL.
- [ ] **Paso 3: Implementar.** `_versions`: cada versión aplica sus `_mod` (`replaceArr`, `appendArr`, `removeArr`) sobre una copia de la especie y genera un `lineage` con la clave `nombre-legado|fuente`. `_copy`: copia la base por `name|source` y aplica `_mod`. Las claves de rasgo de clase vienen de las cadenas `"Rage|Barbarian|XPHB|1"`.
- [ ] **Paso 4: Ejecutar** → PASS.
- [ ] **Paso 5: Commit** `feat(rules): normalización de 5etools`.

---

### Tarea 5: Diccionario en español y script de importación

**Files:**
- Create: `lib/rules/i18n/es.json` (clave → nombre en español; como mínimo las 9+1 especies y sus legados, 12 clases y 48 subclases, 16 trasfondos, dotes de origen, 18 habilidades, 6 características, idiomas estándar, 9 alineamientos, 8 escuelas, 15 condiciones y los objetos que aparecen en el equipo inicial de clases y trasfondos)
- Create: `lib/rules/import/plan.ts`, `scripts/import-5etools.ts`
- Test: `tests/rules/importPlan.test.ts`

**Interfaces:**
- Consumes: `normalizeAll` (Tarea 4), modelos (Tarea 2).
- Produces:
  - `planImport(existingKeys: string[], incoming: NormalizedEntry[], opts: { srdOnly: boolean }): { upserts: NormalizedEntry[]; deletes: string[] }`
  - CLI: `--data <ruta>` (obligatorio), `--source XPHB` (por defecto), `--srd-only`, `--dry-run`. Sale con código 1 si falta `--data` o no existe la carpeta.

- [ ] **Paso 1: Pruebas que fallan**: con `srdOnly: true` las entradas sin `srd52` no están en `upserts` y, si existían, están en `deletes`; claves existentes que ya no llegan → `deletes`; reimportar lo mismo → `deletes` vacío.
- [ ] **Paso 2: Ejecutar** → FAIL.
- [ ] **Paso 3: Implementar `planImport`** y el script: lee los JSON (y `foundry*.json`, `class/foundry.json`, `spells/foundry.json`, emparejando por `name|source` en `foundry`), aplica `es.json` a `nameEs`, conecta con `connectDB`, upsert del `Book` (`key`, `owner: null`, `systemId: "dnd-2024"`, `visibility: "public"`, `license` según `--srd-only` con la atribución de Global Constraints), `bulkWrite` en lotes de 500 por `{book, key}`, `deleteMany` de `deletes`, e informe por consola (totales por kind, creadas/actualizadas/borradas, errores, nombres sin traducción). Al final imprime: "La caché del catálogo se renueva en 1 hora o al reiniciar el servidor."
- [ ] **Paso 4: Ejecutar** pruebas → PASS.
- [ ] **Paso 5: Verificar en real**: `npm run import:5etools -- --data "C:/Users/Usuario/Documents/GitHub/5etools/5etools-src/data" --dry-run` → informe con 9+1 especies, 12 clases, 48 subclases, 16 trasfondos y 0 errores de validación (cualquier error se corrige en el normalizador). Después, sin `--dry-run`, y una segunda vez → la segunda informa 0 creadas y 0 borradas.
- [ ] **Paso 6: Commit** `feat(rules): script de importación de 5etools`.

---

### Tarea 6: Capa de acceso al catálogo y rutas

**Files:**
- Create: `lib/rules/catalog.ts`
- Create: `app/api/rules/entries/route.ts`, `app/api/rules/entries/[bookId]/[key]/route.ts`
- Modify: `app/api/books/[id]/route.ts` y `app/api/books/[id]/entries/**` para llamar a `revalidateTag(\`book:${id}\`, "max")` tras escribir
- Test: `tests/rules/catalog.test.ts`

**Interfaces:**
- Consumes: modelos (Tarea 2), `normalizeName` (Tarea 1).
- Produces:
  - `pickBooks(input: { visible: string[]; campaign: { restrictBooks: boolean; allowedBooks: string[] } | null; chosen: string[] }): string[]` — función pura: `visible ∩ (campaña si restringe) ∩ (chosen si no vacío y la campaña no restringe)`
  - `usableBooks(opts: { userId: string; systemId: string; campaignId?: string; chosenBooks?: string[] }): Promise<string[]>` — `visible` = oficiales públicos del sistema + propios del usuario; si `campaignId` no es del usuario como miembro → lanza `NotFoundError`
  - `type EntryOption = { ref: Ref; name: string; nameEs: string | null; bookName: string; srd52: boolean; data: unknown }`
  - `listEntries(opts: { books: string[]; kind: EntryKind; parent?: string; q?: string }): Promise<EntryOption[]>` — orden por `nameLower`; `q` busca por prefijo en `nameLower` con `escapeRegex(normalizeName(q))`; cacheado con `unstable_cache`, tags `book:<id>` por libro, `revalidate: 3600`
  - `getEntry(ref: Ref): Promise<CatalogEntry | null>` y `resolveRef(ref: Ref, books: string[]): Promise<CatalogEntry | null>` (`CatalogEntry` = `EntryOption` + `description`, `descriptionEs`, `identifier`, `parent`, `foundry`)
  - `GET /api/rules/entries?kind=&system=dnd-2024&campaign=&books=a,b&parent=&q=` → `{ entries: EntryOption[] }`; kind inválido → 400; sin sesión → 401
  - `GET /api/rules/entries/[bookId]/[key]` → `{ entry }` o 404 si el libro no está en `usableBooks` del usuario

- [ ] **Paso 1: Pruebas que fallan** de `pickBooks`:
  - campaña con `restrictBooks` ignora `chosen` aunque traiga libros ajenos;
  - `chosen` con un id que no está en `visible` no lo añade;
  - sin campaña ni `chosen` → `visible`.
- [ ] **Paso 2: Ejecutar** → FAIL.
- [ ] **Paso 3: Implementar** `catalog.ts` y las rutas (leer antes `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/unstable_cache.md` y `revalidateTag.md`).
- [ ] **Paso 4: Ejecutar** pruebas → PASS; `npx tsc --noEmit` y `npx eslint app lib` → sin errores.
- [ ] **Paso 5: Verificar con la app en marcha**: `/api/rules/entries?kind=species&system=dnd-2024&q=draconido` → incluye "Dracónido"; con `books=<id ajeno>` → mismos resultados que sin `books`.
- [ ] **Paso 6: Commit** `feat(rules): API del catálogo`.

---

### Tarea 7: Modelo del personaje, validación y tiradas

**Files:**
- Modify: `lib/Character.ts` (`status` enum `active|retired|dead` por defecto `active`; `portraitId`; índice `{owner:1, status:1, updatedAt:-1}`)
- Create: `lib/rules/dnd2024/sheet.ts` (tipos de la spec §4.2: `Dnd2024Sheet`, `Named`, `AbilityMethod`), `lib/rules/dnd2024/abilities.ts`, `lib/rules/dnd2024/rolls.ts`, `lib/rules/dnd2024/validate.ts`
- Create: `app/api/dice/ability-rolls/route.ts`
- Test: `tests/dnd2024/abilities.test.ts`, `tests/dnd2024/rolls.test.ts`, `tests/dnd2024/validate.test.ts`

**Interfaces:**
- Consumes: `resolveRef`, `usableBooks` (Tarea 6); tipos (Tarea 1).
- Produces:
  - `POINT_BUY_COST: Record<number, number>`, `POINT_BUY_TOTAL = 27`, `STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]`
  - `pointBuyCost(scores: Record<Ability, number>): number`
  - `checkBackgroundBonus(bonus: Partial<Record<Ability, number>>, allowed: Ability[]): boolean` (patrones `[2,1]` o `[1,1,1]`)
  - `rollAbilityScores(rng?: () => number): number[]` (6 valores, 4d6 sin el menor)
  - `signRolls(userId: string, values: number[], now?: number): string` y `verifyRolls(userId: string, values: number[], token: string, now?: number): boolean` — HMAC-SHA256 con `AUTH_SECRET` sobre `userId|values ordenados|expira`; caduca a las 24 h
  - `validateSheet(input: unknown, ctx: { userId: string; books: string[]; resolve: (ref: Ref) => Promise<CatalogEntry | null> }): Promise<{ ok: true; sheet: Dnd2024Sheet } | { ok: false; errors: Record<string, string> }>` — claves de error = ruta del campo (`"background.abilities"`, `"classes.0.skills"`)
  - `POST /api/dice/ability-rolls` → `{ values: number[]; token: string }`, `rateLimit("ability_rolls", userId, 60, 3600)`

- [ ] **Paso 1: Pruebas que fallan**
  - `pointBuyCost` de 15,15,15,8,8,8 = 27; valores 8–15 fuera de rango → la validación da error en `baseAbilities`.
  - `checkBackgroundBonus({int:2,wis:1}, ["int","wis","cha"])` → true; `{str:2,wis:1}` → false; `{int:3}` → false; `{int:1,wis:1,cha:1}` → true.
  - `verifyRolls` acepta el token propio; rechaza otro `userId`, otros valores y `now` + 25 h.
  - `validateSheet` rechaza: legado con especie sin `hasLineages`; legado cuyo `parent.key` no es la especie elegida; referencia fuera de `books`; total de característica > 20; habilidades de clase repetidas con las del trasfondo o en número distinto de `skills.count`; método `standard` sin exactamente {15,14,13,12,10,8}; método `roll` con token inválido.
- [ ] **Paso 2: Ejecutar** → FAIL.
- [ ] **Paso 3: Implementar** (los `name` de cada `Named` se toman del catálogo resuelto, no del cliente).
- [ ] **Paso 4: Ejecutar** → PASS.
- [ ] **Paso 5: Commit** `feat(characters): modelo, validación y tiradas firmadas`.

---

### Tarea 8: Cálculos del personaje

**Files:**
- Create: `lib/rules/dnd2024/derive.ts`
- Test: `tests/dnd2024/derive.test.ts` (con entradas del catálogo construidas a partir de los fixtures de la Tarea 4)

**Interfaces:**
- Consumes: `Dnd2024Sheet` (Tarea 7), `CatalogEntry` (Tarea 6).
- Produces:
  - `type Derived = { abilities: Record<Ability, { score: number; mod: number }>; proficiencyBonus: number; hpMax: number; ac: number; initiative: number; speed: number; darkvision: number; saves: Ability[]; skills: string[]; armor: string[]; weapons: string[]; tools: string[]; equipment: { name: string; quantity: number }[]; gold: number; missing: string[] }`
  - `derive(sheet: Dnd2024Sheet, entries: Map<string, CatalogEntry>): Derived` — `entries` indexado por `${book}:${key}`; una referencia ausente se anota en `missing` (con el `name` guardado) y no rompe el cálculo.

- [ ] **Paso 1: Pruebas que fallan**: Elfa Drow, Bárbara 1, Acólito (+2 SAB, +1 INT), equipo A de clase y de trasfondo, base FUE 15 DES 14 CON 13 INT 12 SAB 10 CAR 8 →
  - `abilities.wis.score === 12`, `abilities.str.mod === 2`, `proficiencyBonus === 2`;
  - `hpMax === 13` (12 + 1), `ac === 13` (Defensa sin armadura del Bárbaro: 10 + DES 2 + CON 1);
  - `darkvision === 120`, `speed === 30`;
  - `saves` = `["str","con"]`; `skills` contiene `"insight"`, `"religion"` (Acólito), `"perception"` (Elfo: Sentidos agudos, elegida en `speciesChoices.skills` entre Perspicacia, Percepción y Supervivencia) y las dos de clase elegidas;
  - `gold === 23` (15 de clase + 8 de trasfondo).
  - Con la especie borrada del catálogo: `missing` contiene el nombre guardado y el resto se calcula.
- [ ] **Paso 2: Ejecutar** → FAIL.
- [ ] **Paso 3: Implementar.** Defensa sin armadura: Bárbaro 10+DES+CON, Monje 10+DES+SAB, solo si el equipo elegido no incluye armadura (los escudos suman +2 en ambos casos).
- [ ] **Paso 4: Ejecutar** → PASS.
- [ ] **Paso 5: Commit** `feat(characters): cálculos derivados`.

---

### Tarea 9: "Mis personajes" y diálogo "Preparar nuevo personaje"

**Files:**
- Create: `app/(main)/characters/page.tsx`, `app/components/characters/NewCharacterDialog.tsx`, `app/components/characters/CharacterCard.tsx`
- Modify: `lib/systems.ts` (campo `creator: boolean`, `true` solo en `dnd-2024`)

**Interfaces:**
- Consumes: `officialBooksOf`, `booksByIds` (Tarea 2).
- Produces: `NewCharacterDialog` props `{ systems: { id: string; name: string; creator: boolean }[]; campaigns: { id: string; name: string; systemId: string; restrictBooks: boolean }[]; books: BookOption[] }`; navega a `/characters/new?system=…&campaign=…&books=id1,id2`.

- [ ] **Paso 1: Implementar la página** (requiere sesión con `requireUser("/characters")`): buscador GET `q`, `status` (`active` por defecto, `retired`, `dead`, `all`), `sort` (`recent`, `name`), como en `app/(main)/campaigns/page.tsx` y usando `first`/`escapeRegex` de `lib/utils.ts`; la búsqueda por clase y especie usa los `name` guardados en `sheet`. Tarjetas con retrato, nombre, "Especie (Legado) · Clase N", sistema y enlace a la campaña; entrada `animate-fade-up` escalonada. Vacío: icono `Files`, "Aún no tienes ningún personaje", el texto de la captura y la flecha "¡Crea el primero!" junto a **Añadir**.
- [ ] **Paso 2: Implementar el diálogo**: Juego (sistemas sin `creator` deshabilitados con "Próximamente"), Campaña ("-" + campañas del usuario de ese sistema con `characters.allowed && characters.internal`), caja informativa, casilla "Filtrar contenido por libros de reglas" (desactivada con explicación si la campaña elegida tiene `restrictBooks`), **Continuar** y **Cancelar**. Diálogo accesible (`role="dialog"`, `aria-modal`, foco inicial, Escape), con `animate-fade-in` + `animate-pop` como `ExpelMember`.
- [ ] **Paso 3: Verificar** `npx tsc --noEmit`, `npx eslint app lib` → sin errores; en el navegador integrado `/characters` muestra el vacío y el diálogo navega con los parámetros correctos.
- [ ] **Paso 4: Commit** `feat(characters): listado y diálogo de nuevo personaje`.

---

### Tarea 10: Componentes `RuleSelect` y `AbilityScores`

**Files:**
- Create: `app/components/characters/RuleSelect.tsx`, `app/components/characters/AbilityScores.tsx`, `lib/rules/dnd2024/assign.ts`
- Create: `app/components/icons/classes/*.tsx` (12 SVG propios, un componente por clase, exportados desde `index.ts` como `CLASS_ICONS: Record<string, ComponentType<{ size?: number }>>` indexado por `identifier`)
- Test: `tests/dnd2024/assign.test.ts`

**Interfaces:**
- Consumes: `EntryOption` (Tarea 6); `pointBuyCost`, `checkBackgroundBonus`, `STANDARD_ARRAY` (Tarea 7).
- Produces:
  - `assignValue(current: Record<Ability, number | null>, ability: Ability, value: number): Record<Ability, number | null>` — si `value` ya está en otra característica, las intercambia
  - `RuleSelect` props `{ id: string; label: string; options: EntryOption[]; value: Ref | null; onChange: (ref: Ref | null) => void; disabled?: boolean; placeholder?: string }` — *combobox* accesible (`role="combobox"`, `aria-expanded`, `aria-activedescendant`, listbox con `role="option"`), filtro local con `normalizeName`, nombre del libro en gris, marca SRD
  - `AbilityScores` props `{ method: AbilityMethod; base: Record<Ability, number | null>; rolls: number[] | null; backgroundAbilities: Ability[]; backgroundBonus: Partial<Record<Ability, number>>; onChange(next: { method; base; rolls; backgroundBonus }): void; onRequestRolls(): Promise<void> }`

- [ ] **Paso 1: Pruebas que fallan** de `assignValue`: asignar 15 a FUE cuando DES tiene 15 y FUE 14 → FUE 15, DES 14; asignar a una casilla vacía no toca las demás.
- [ ] **Paso 2: Ejecutar** → FAIL.
- [ ] **Paso 3: Implementar `assignValue`**, `RuleSelect` y `AbilityScores` con las columnas, métodos, textos de ayuda, contadores y colores de la spec §4.3. Arrastrar con eventos `pointer` (ratón y táctil) y, además, un `<select>` por casilla que llama a `assignValue`. Cambiar de método con valores asignados pide confirmación en línea.
- [ ] **Paso 4: Ejecutar** pruebas → PASS; `tsc` y `eslint` → sin errores.
- [ ] **Paso 5: Commit** `feat(characters): selector de reglas y tabla de características`.

---

### Tarea 11: Página de creación, guardado y resumen

**Files:**
- Create: `app/(main)/characters/new/page.tsx` (servidor: valida `system`, `campaign`, `books`; carga especies, legados, clases y trasfondos con `usableBooks` + `listEntries`; 404 si `system` no tiene `creator`)
- Create: `app/components/characters/CharacterCreator.tsx` (cliente: secciones Detalles, Estado, Trasfondo, Clase, Características, Información; borrador en `localStorage` con clave `roll2go:new-character:<system>:<campaign|none>`, todo con try/catch)
- Create: `app/components/characters/CharacterSummary.tsx` (usa `derive` con las entradas ya cargadas; PG, CA, Iniciativa, Velocidad, Competencia y "Falta por completar" con enlaces `#seccion`)
- Create: `app/api/characters/route.ts` (`POST`, `multipart/form-data` con `sheet` JSON, `name`, `status`, `campaign`, `books`, `backstory`, `portrait`, `image`)
- Create: `app/(main)/characters/[id]/page.tsx` (resumen de solo lectura con `derive`; solo el dueño o miembros de su campaña; muestra la atribución del SRD si algún libro usado es `srd`)
- Modify: `app/(main)/campaigns/[id]/(view)/characters/page.tsx` (enlace a cada personaje y resumen "Especie · Clase N")
- Modify: `lib/accountCleanup.ts` (borrar `portraitId`/`imageId` de sus personajes con el resto de imágenes ya cubierto por `CampaignImage.deleteMany({ owner })`; sin cambios si ya lo cubre — verificar)

**Interfaces:**
- Consumes: todo lo anterior; `storeImage` de `lib/campaignInput.ts` para retrato e imagen.
- Produces: `POST /api/characters` → `201 { id }` o `400 { errors: Record<string, string> }`; `rateLimit("character_create", userId, 30, 3600)`.

- [ ] **Paso 1: Implementar la ruta POST**: `usableBooks` → `validateSheet` → guarda `Character` (`origin: "internal"` si hay campaña; comprueba miembro y `characters.allowed && internal`) → `notify({ type: "character_created" })` al DM si hay campaña y el creador no es el DM.
- [ ] **Paso 2: Implementar la página, `CharacterCreator` y `CharacterSummary`** según la spec §4.1 y §4.4: ruta de navegación, **Volver**, tarjetas con `animate-fade-up`, legado desactivado si la especie no tiene legados, descripción bajo cada elección (`GET /api/rules/entries/[bookId]/[key]`), errores del servidor junto a cada campo con desplazamiento al primero y el número de problemas en el botón **Crear personaje**.
- [ ] **Paso 3: Implementar `/characters/[id]`** de solo lectura.
- [ ] **Paso 4: Verificar** `npx vitest run`, `npx tsc --noEmit`, `npx eslint app lib` → sin errores.
- [ ] **Paso 5: Commit** `feat(characters): asistente de creación`.

---

### Tarea 12: Verificación de extremo a extremo

- [ ] **Paso 1:** `npm run migrate:books` → informa los documentos migrados; segunda ejecución → 0 cambios.
- [ ] **Paso 2:** con `npm run dev`, en el navegador integrado y con una cuenta de prueba local, crear:
  - personaje sin campaña con **Reparto de puntos** (Elfo Drow, Bárbaro, Acólito) → la ficha muestra PG 13 y CA 13 con la base de la Tarea 8;
  - personaje en una campaña con **Mediante tiradas**;
  - personaje con **Valores predefinidos** y con **Asignar manualmente**.
- [ ] **Paso 3:** comprobar que `/characters` lista los cuatro, filtra por estado y busca por "barbaro"; que la pestaña Personajes de la campaña muestra el creado en ella; que el DM recibe la notificación.
- [ ] **Paso 4:** probar a 375 px de ancho (resumen al final, desplegables usables) y con el teclado (combobox, intercambio de valores).
- [ ] **Paso 5:** informar al usuario de lo verificado y de lo que no se pudo verificar.
