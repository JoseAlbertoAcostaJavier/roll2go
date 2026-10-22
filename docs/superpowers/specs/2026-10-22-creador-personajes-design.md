# Creador de personajes D&D 2024 — Diseño (partes 1 y 2)

Fecha: 2026-10-22 · Estado: pendiente de revisión

## 1. Objetivo

Que un usuario de Roll2Go pueda crear un personaje de **D&D 5.5 (2024)** con un asistente inspirado en el de Nivel20, usando como fuente de reglas los datos de **5etools** importados a la base de datos de Roll2Go.

### Decisiones tomadas con el usuario

| Tema | Decisión |
|---|---|
| Contenido | Se importa **todo el Manual del Jugador 2024 (XPHB)**. Cada entrada se marca con `srd52` y el libro con su licencia, para poder publicar solo el SRD 5.2 si la web se hace pública (`--srd-only`). |
| Idioma | Nombres en español mediante diccionario; descripciones en inglés por ahora (campo `descriptionEs` preparado). |
| Alcance total | Seis partes (ver §2). Este documento cubre **solo las partes 1 y 2**. |
| Almacenamiento | Reutilizar `Book` / `BookEntry` (opción A): el contenido oficial y el homebrew de usuarios comparten modelo, esquemas y filtros. |
| Foundry VTT | Debe poder exportarse en el futuro: claves estables, datos `foundry` de 5etools guardados, y el personaje guarda elecciones (no resultados). |
| Homebrew | Los usuarios podrán crear sus propios libros con una plantilla (parte 7). Esta entrega deja preparados los esquemas compartidos y las referencias entre libros. |

### Fuera de alcance de este documento

Ficha completa y edición (parte 3), subir de nivel y multiclase (parte 4), conjuros e inventario (parte 5), exportación a Foundry (parte 6), editor y plantilla de homebrew (parte 7), grupos/"Equipo en la campaña", traducción de descripciones, otros sistemas de juego.

## 2. Descomposición del proyecto

1. **Catálogo de reglas**: esquemas, importación desde 5etools, nombres en español, API de consulta. ← este documento
2. **Asistente de creación y "Mis personajes"**. ← este documento
3. Ficha de personaje (valores calculados, edición de campos libres).
4. Subir de nivel (rasgos por nivel, subclase, mejoras de característica, dotes, multiclase).
5. Conjuros e inventario.
6. Exportación a Foundry VTT (sistema `dnd5e`).
7. Editor y plantilla de libros homebrew.

---

## 3. Parte 1 — Catálogo de reglas

### 3.1 Modelo de datos

**`Book`** (`lib/Book.ts`, se amplía)

| Campo | Notas |
|---|---|
| `key` | Sigla de la fuente (`"XPHB"`). Única entre los libros oficiales (`owner: null`); vacía en los de usuario. |
| `owner` | `null` = oficial. |
| `systemId` | `"dnd-2024"`. |
| `name`, `description`, `language`, `visibility` | Como ahora. Los oficiales son `public`. |
| `license.type` | `"own"` (homebrew), `"srd"` (contenido abierto, CC BY 4.0) u `"official"` (contenido protegido). |
| `license.attribution`, `license.sourceUrl` | Atribución obligatoria del SRD 5.2; se muestra en la interfaz. |

**`BookEntry`** (`lib/BookEntry.ts`, se amplía)

| Campo | Notas |
|---|---|
| `book` | Libro al que pertenece. |
| `kind` | `species`, `lineage`, `class`, `subclass`, `classFeature`, `subclassFeature`, `background`, `feat`, `spell`, `item`, `language`, `skill`. |
| `key` | Clave estable en minúsculas, estilo 5etools: `elf\|xphb`, `fireball\|xphb`, `rage\|barbarian\|xphb\|1`. Única por libro. |
| `identifier` | Identificador corto estilo Foundry (`system.identifier`): `elf`, `fireball`. |
| `parent` | Referencia a la entrada de la que depende (legado → especie, subclase → clase, rasgo → clase/subclase). |
| `name`, `nameEs`, `nameLower` | Nombre original, en español y normalizado (minúsculas, sin tildes) para buscar. |
| `description`, `descriptionEs` | BBCode. `descriptionEs` vacío por ahora. |
| `srd52` | `true` si es contenido del SRD 5.2. |
| `data` | Campos normalizados según `kind` (§3.2). |
| `foundry` | Opcional. *Activities* y efectos tal cual vienen en los `foundry*.json` de 5etools. Solo para exportar. |

**Referencias.** Toda referencia a otra entrada es `{ book: ObjectId, key: string }`, de modo que una entrada puede apuntar a otro libro (p. ej. una subclase homebrew del Bárbaro oficial). Una referencia a un libro no disponible para el personaje o la campaña se trata como contenido no disponible.

**Índices.** `{book: 1, key: 1}` único; `{book: 1, kind: 1, nameLower: 1}`; `{kind: 1, "parent.key": 1}`.

**Filtros de libros.** `Character.books` y `Campaign.allowedBooks` pasan a guardar **ids de `Book`** (oficiales y homebrew). Se elimina el catálogo de ejemplo de `lib/books.ts`; su uso en formularios de campaña y en `lib/CampaignRules.ts` pasa a leer de la colección `Book`. Migración única: los ids antiguos (`dnd-2024-phb`, …) se convierten al id del `Book` oficial correspondiente o se descartan si no existe; `User.ownedBooks` se migra igual.

### 3.2 Esquemas por tipo (`lib/rules/schemas.ts`)

Un único esquema por `kind`, escrito en TypeScript con un validador propio (sin dependencias nuevas). Lo usan el script de importación, las rutas que guardan entradas de usuario y, en la parte 7, la plantilla (formulario por tipo y JSON de ejemplo descargable).

- **species**: `size: ("S"|"M"|"L")[]`, `speed: number`, `darkvision: number`, `creatureType`, `skills: {fixed: string[], choose?: {count, from[]}}`, `spells: [{level, ref, ability?}]`, `hasLineages: boolean`.
- **lineage**: `darkvision?`, `spells: [{level, ref, ability?}]`, `traitName`. (`parent` = especie.)
- **class**: `hitDie`, `primaryAbility: Ability[]`, `saves: Ability[]`, `armor: string[]`, `weapons: string[]`, `tools: string[]`, `skills: {count, from[]}`, `equipment: {A: Pack[], B: Pack[]}`, `subclassLevel`, `asiLevels: number[]`, `spellcasting: {ability, progression: "full"|"half"|"pact"|null, table}`, `features: [{ref, level}]`.
- **subclass**: `features: [{ref, level}]`, `spells: [{level, ref}]`.
- **classFeature / subclassFeature**: `level`, `className`, `subclassName?`.
- **background**: `abilities: Ability[3]`, `feat: Ref`, `skills: string[]`, `tools: string[]`, `equipment: {A: Pack[], B: Pack[]}`.
- **feat**: `category: "origin"|"general"|"fightingStyle"|"epicBoon"`, `prerequisite?`, `repeatable`, `abilityIncrease?`.
- **spell**: `level`, `school`, `time`, `range`, `components`, `duration`, `concentration`, `ritual`, `classes: string[]`.
- **item**: `type`, `weight`, `value` (pc), `armor?: {ac, dexCap, stealthDisadvantage, category}`, `weapon?: {damage, damageType, properties[], mastery, category}`, `contents?: [{ref, quantity}]` (paquetes).
- **language / skill**: `ability?` (habilidad), `type` (idioma estándar/raro).

`Pack` = `{ ref?: Ref, quantity?: number, value?: number /* pc */, displayName?: string }`.

### 3.3 Script de importación

```bash
npm run import:5etools -- --data "<ruta a 5etools-src/data>" --source XPHB [--srd-only] [--dry-run]
```

- `scripts/import-5etools.ts`, ejecutado con **`tsx`** (nueva dependencia de desarrollo) para poder usar los alias `@/lib`. Los datos de 5etools no se copian al repositorio.
- Pasos:
  1. **Leer** las entradas de la fuente indicada de `races`, `backgrounds`, `feats`, `items`, `items-base`, `languages`, `skills`, `spells/*`, `class/*` y los `foundry*.json`.
  2. **Resolver herencias**: `_versions` → entradas `lineage`; `_copy` → copia de la base con sus `_mod`.
  3. **Normalizar** con los esquemas de §3.2. Las entradas que no validan se omiten y se anotan en el informe (el script no se detiene).
  4. **Texto a BBCode**: listas, tablas y bloques de `entries` → BBCode. Etiquetas en línea: `{@b}`/`{@i}` → `[b]`/`[i]`; `{@dice}`, `{@damage}`, `{@dc}`, `{@chance}` → texto destacado; `{@spell}`, `{@item}`, `{@feat}`, `{@condition}`, `{@race}`, `{@skill}`, `{@sense}`, `{@action}`, `{@variantrule}`, `{@itemMastery}`, `{@itemProperty}`, `{@creature}`, `{@status}`, `{@hazard}`, `{@table}`, `{@book}`, `{@filter}`, `{@5etools}` → `[ref=tipo:clave]texto[/ref]`. Etiquetas desconocidas → texto plano. Se añade `[ref]` a `lib/bbcode.ts` (por ahora se muestra resaltado, sin enlace).
  5. **Nombres en español** desde `lib/rules/i18n/es.json` (clave → nombre). Prioridad de traducción: especies, legados, clases, subclases, trasfondos, dotes, habilidades, características, idiomas, alineamientos, escuelas, condiciones y objetos del equipo inicial. Sin traducción → nombre original; se lista en el informe.
  6. **Datos de Foundry** emparejados por `nombre + fuente`.
  7. **Guardar** de forma idempotente: `Book` por `key` (upsert); entradas por `{book, key}` con `bulkWrite` en lotes; se borran las entradas del libro que ya no vienen en los datos. Al terminar se invalida la caché del libro (§3.4).
  8. **Informe**: totales por tipo, creadas/actualizadas/borradas, fallos de validación, traducciones pendientes.
- `--srd-only`: solo entradas con `srd52`; el libro se guarda con `license.type: "srd"` y la atribución CC BY 4.0. Sin la opción, `license.type: "official"`.
- `--dry-run`: hace todo menos escribir.

### 3.4 API del catálogo

**Capa de acceso única: `lib/rules/catalog.ts`.**

- `usableBooks({ userId, systemId, campaignId?, chosenBooks? }) → ObjectId[]`: libros visibles para el usuario (oficiales y públicos + los suyos) ∩ filtro de la campaña si `restrictBooks` ∩ filtro del personaje si lo eligió. El filtro de la campaña tiene prioridad.
- `listEntries({ books, kind, parent?, q? })`: lista ligera sin descripción (ref, libro, `nameEs`, `name`, nombre del libro, `srd52` y los `data` mínimos para el desplegable), ordenada por `nameEs` sin distinguir mayúsculas ni tildes.
- `getEntry(ref)`: entrada completa.
- `resolveRef(ref, books)`: entrada o `null` si no está en `books`.

**Caché.** `listEntries` y `getEntry` se cachean con la caché de Next etiquetada por libro; se invalida al importar o al editar un libro. Antes de implementarla hay que leer la guía de caché de esta versión de Next en `node_modules/next/dist/docs/`.

**Rutas** (solo las que necesita el navegador):

- `GET /api/rules/entries?kind=&campaign=&books=&parent=&q=` → `usableBooks` + `listEntries`.
- `GET /api/rules/entries/[bookId]/[key]` → detalle, solo si el libro está en `usableBooks`.
- Las rutas existentes `/api/books/...` se mantienen para gestionar libros propios.

**Errores.** Libro inexistente o no visible → 404 (no se revela que existe). Referencia rota → contenido no disponible, no error.

---

## 4. Parte 2 — Asistente de creación y "Mis personajes"

### 4.1 Páginas y flujo

**`/characters` — Mis personajes**
- Título "Personajes" y botón **Añadir**.
- Buscador GET (como "Mis campañas"): texto (nombre, clase, especie, campaña), estado (En activo · Retirado · Fallecido · Todos), orden (recientes · nombre).
- Tarjetas: retrato, nombre, "Especie (Legado) · Clase nivel", sistema y campaña (enlace).
- Vacío: icono, "Aún no tienes ningún personaje", texto explicativo y flecha "¡Crea el primero!" hacia **Añadir**.

**Diálogo "Preparar nuevo personaje"**
- **Juego**: solo D&D 5.5 (2024) seleccionable; el resto, deshabilitados con "Próximamente".
- **Campaña**: "-" o tus campañas de ese sistema que admiten personajes internos (`characters.allowed && characters.internal`).
- Caja informativa sobre campañas y filtros por libros.
- **Filtrar contenido por libros de reglas** (opcional): muestra los libros visibles. Si la campaña filtra libros, la casilla se desactiva explicando que manda el filtro de la campaña.
- **Continuar** → `/characters/new?system=dnd-2024&campaign=…&books=…`. **Cancelar** cierra.

**`/characters/new` — página de creación**
- Ruta de navegación (Sistema / Campañas / Campaña / Personajes / Añadir) y botón **Volver**.
- Secciones (tarjetas):
  1. **Detalles**: nombre*, especie, legado (activo solo si la especie tiene legados), clase de nivel 1 (icono SVG propio + descripción), campaña (solo lectura), retrato e imagen.
  2. **Estado**: En activo · Retirado · Fallecido, con descripción.
  3. **Trasfondo**: selector, descripción, resumen (características, dote, habilidades, herramientas, equipo) y opción de equipo A/B.
  4. **Clase**: habilidades de clase (número y lista según la clase, excluyendo las del trasfondo) y equipo A/B.
  5. **Puntuaciones de característica** (§4.3).
  6. **Información**: alineamiento (con descripción), apariencia, edad, historia (`BbcodeEditor`), idiomas, notas, puntos de experiencia.
- **Resumen lateral**: fijo en escritorio, al final en móvil. PG, CA, Iniciativa, Velocidad, Competencia y "Falta por completar" con enlaces a cada sección.
- **Crear personaje**: el servidor valida (§4.2) y guarda; si hay campaña, se crea como `origin: "internal"`. Redirige a `/characters/[id]` (en esta entrega, una página de resumen; la ficha completa es la parte 3).
- **Borrador** en `localStorage` mientras se rellena (envuelto en try/catch); se borra al crear.

### 4.2 Modelo del personaje

**Campos comunes de `Character`** (cambios): `status: "active"|"retired"|"dead"` (nuevo, por defecto `active`), `portraitId` (nuevo), `imageId`, `books: ObjectId[]` (ids de `Book`; vacío = sin filtro), `backstory`, `sheet`.

**`sheet` para D&D 2024**

```ts
type Ref = { book: string; key: string };
type Named = { ref: Ref; name: string }; // name: copia para mostrar si la entrada desaparece

{
  version: 1,
  species: Named,
  lineage: Named | null,
  background: Named & { abilities: Partial<Record<Ability, 1 | 2>>, equipment: "A" | "B" },
  classes: [Named & { level: number, subclass: Named | null, skills: string[], equipment: "A" | "B" }],
  abilityMethod: "pointBuy" | "roll" | "standard" | "manual",
  baseAbilities: Record<Ability, number>,
  rolls: { values: number[], token: string } | null,
  speciesChoices: { skills: string[], size: "S" | "M" | "L" | null },
  alignment: string, appearance: string, age: string, languages: string, notes: string, xp: number,
  hp: { max: number | null, current: number | null, temp: number },
}
```

**Validación en el servidor** (`lib/rules/dnd2024/validate.ts`), al crear y al editar:
- Toda referencia existe y su libro está en `usableBooks`.
- Reparto de puntos: valores 8–15, coste total ≤ 27 (8→0, 9→1, 10→2, 11→3, 12→4, 13→5, 14→7, 15→9).
- Valores predefinidos: exactamente {15, 14, 13, 12, 10, 8}.
- Tiradas: `POST /api/dice/ability-rolls` genera 6 × (4d6 descartando el menor) y devuelve los valores con un `token` firmado (HMAC con el secreto de sesión, caduca a las 24 h); al crear se comprueba que el reparto usa exactamente esos valores.
- Manual: valores 3–20.
- Trasfondo: +2/+1 o +1/+1/+1, solo en sus tres características; total ≤ 20.
- Habilidades de clase: número exacto, de la lista de la clase, sin duplicar las del trasfondo.
- Textos con `cleanText` y longitudes máximas.
- Si hay campaña: el usuario es miembro y la campaña admite personajes internos.

**Cálculos** (`lib/rules/dnd2024/derive.ts`, función pura `derive(sheet, catalogEntries)`):
- Características finales y modificadores (base + trasfondo).
- Bonificador de competencia por nivel.
- PG de nivel 1 = dado de golpe máximo + mod. Constitución.
- CA: armadura del equipo elegido; si no hay, Defensa sin armadura (Bárbaro/Monje); si no, 10 + mod. Destreza.
- Iniciativa, velocidad y visión en la oscuridad (especie + legado).
- Competencias: salvaciones, habilidades, armas, armaduras y herramientas (clase + trasfondo + especie).
- Equipo inicial (A/B de clase y trasfondo) → lista de objetos y monedas.

Esta función la usan el resumen del asistente, la ficha (parte 3) y el exportador (parte 6).

### 4.3 Puntuaciones de característica (`AbilityScores`)

- Columnas: Característica (nombre + descripción), método, Trasfondo, Total, Mod. Filas alternadas.
- **Trasfondo**: contador "3 puntos" y −/+ solo en las tres características del trasfondo (el resto atenuadas); solo patrones válidos; tope 20.
- **Mod**: verde si es positivo, rojo si es negativo, neutro si es +0.
- Métodos y texto de ayuda:
  - **Reparto de puntos**: contador "27 puntos" según la tabla de costes; −/+ entre 8 y 15; + desactivado si no hay puntos.
  - **Mediante tiradas**: botón "Nuevas tiradas" (servidor); las tiradas son fichas para repartir.
  - **Valores predefinidos**: fichas 15, 14, 13, 12, 10, 8.
  - **Asignar manualmente**: −/+ entre 3 y 20.
- Reparto de fichas: arrastrar (ratón y táctil) **y** un selector de valor por casilla; elegir un valor ya asignado intercambia las dos casillas.
- Cambiar de método pide confirmación si había valores; reinicia los valores base y conserva el trasfondo.

### 4.4 Componentes de interfaz

- **`RuleSelect`**: desplegable con búsqueda (patrón *combobox* accesible: flechas, Intro, Escape). Cada opción muestra el nombre en español y el nombre del libro en gris; marca para SRD. Al elegir, muestra la descripción y el resumen debajo.
- **`NewCharacterDialog`**: el diálogo de §4.1.
- **`CharacterSummary`**: resumen lateral, alimentado por `derive`.
- **Iconos de clase**: 12 SVG propios en `app/components/icons/classes/`.
- Estilo: tema oscuro de Roll2Go (`surface`, `panel`, `line`, `brand`), `card`/`cardTitle` de `formStyles`, `animate-fade-up` en secciones, `animate-pop` en desplegables.
- Errores del servidor junto a cada campo; desplazamiento al primero; el botón Crear indica cuántos problemas hay.

---

## 5. Pruebas

- Se añade **`vitest`** (dependencia de desarrollo) y el script `npm test`.
- Unitarias:
  - Conversión de etiquetas de 5etools a BBCode.
  - Normalización por tipo con muestras reales: Elfo (con sus legados), Acólito, Bárbaro, Bola de fuego, Hacha a dos manos, Paquete de explorador.
  - `validate`: cada regla de §4.2, en sus casos válidos y no válidos.
  - `derive`: un personaje de ejemplo (Elfa Drow, Bárbara 1, Acólito) con los resultados esperados calculados a mano.
  - Coste del reparto de puntos, patrones del trasfondo e intercambio de fichas.
- Verificación manual en el navegador integrado: importar, crear un personaje con cada método de características, con y sin campaña, y comprobar el listado.

## 6. Riesgos y notas

- **Derechos de autor**: el contenido no SRD del Manual 2024 está protegido. Solo debe usarse en privado; para una web pública, importar con `--srd-only`. La atribución CC BY 4.0 del SRD 5.2 debe mostrarse siempre que se use ese contenido.
- **Formato de 5etools**: puede cambiar entre versiones; el informe del script hará visibles los fallos de validación en lugar de importar datos incorrectos.
- **Next.js de este proyecto**: la versión tiene cambios respecto a la documentación habitual; cada API (caché, rutas, server actions) se comprobará en `node_modules/next/dist/docs/` antes de usarla.
