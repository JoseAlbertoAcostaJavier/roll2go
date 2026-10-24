# Ampliación de conjuros — diseño

Fecha: 2026-10-25. Continúa la parte 5 (conjuros); recoge `docs/superpowers/notes/conjuros-pendientes.md` y los menores aplazados.

## 1. Objetivo

1. Aplicar los rasgos de conjuro de nivel alto del Manual 2024 que hoy solo se anotan a mano.
2. Completar los conjuros de dotes y del Pacto del tomo.
3. Aligerar lo que el creador, el asistente de subir de nivel y la ficha envían al navegador.

Decisiones del usuario: las tres partes juntas, en ese orden; los usos por descanso largo se llevan en la ficha con casillas, como los espacios; el Dominio de conjuros se elige en la ficha (cambiable en cualquier momento).

Fuera de alcance: llevar la cuenta de descansos, traducir descripciones, rasgos de libros que no sean el XPHB.

## 2. Rasgos de nivel alto

Todas las elecciones nuevas se guardan en `levels[].choices` (así borrar el nivel las deshace) y las valida el servidor con las mismas reglas que el asistente.

### 2.1 Secretos mágicos (Bardo 10)

Desde Bardo 10, la elección `spells` del Bardo (al subir) y la op `prepare` de la ficha aceptan conjuros de las listas de **Bardo, Clérigo, Druida y Mago**; cuentan como conjuros de Bardo. `pendingChoices` añade al `spells` del Bardo `lists: ["bard", "cleric", "druid", "wizard"]`; `checkSpells` y `inClassList` (en `spellOps`) aceptan cualquiera de `lists` cuando existe. Lo mismo para las sustituciones.

### 2.2 Arcano místico (Brujo 11, 13, 15, 17)

Elección nueva `{ type: "arcanum"; source; value: Named }`: un conjuro de la lista del Brujo del nivel 6, 7, 8 o 9 según el nivel de Brujo (11→6, 13→7, 15→8, 17→9), que no tenga ya. Se muestra en el bloque del Brujo en una sección **Arcano místico** con una casilla de uso (§3).

### 2.3 Descubrimientos mágicos (Colegio del Saber 6)

Elección nueva `{ type: "bonusSpells"; source; value: { spells: Named[]; replace?: { out: Named; in: Named } } }` con `count: 2`, de las listas de Clérigo, Druida o Mago, trucos o de un nivel para el que tenga espacios. Quedan **siempre preparados** en el bloque del Bardo (origen «Descubrimientos mágicos») y no cuentan para el límite. En cada subida posterior de Bardo se puede sustituir uno (`replace`, opcional).

### 2.4 Sabio de la escuela (Abjurador, Adivino, Evocador, Ilusionista 3)

La elección `spells` del Mago gana `free?: { count: number; school: string; maxLevel: number }`: al ganar el rasgo (nivel 3 del Mago), `count: 2`, `maxLevel: 2`; después, `count: 1` en cada nivel de Mago en que sube su nivel máximo de espacio, con `maxLevel` igual a ese nivel. El valor guardado gana `free: Named[]`: conjuros de Mago de esa escuela (letra de 5etools: A, D, V, I) que entran en el libro **además** de los 2 por nivel. Se valida escuela, nivel y que no estén ya en el libro.

### 2.5 Ilusiones mejoradas (Ilusionista 3)

Concede **Ilusión menor** como truco que no cuenta para el límite (siempre preparado, origen «Ilusiones mejoradas»). Si ya la conoce por otra vía, la elección `bonusSpells` pide **un truco de Mago** en su lugar (`count: 1`, solo trucos, lista de Mago).

### 2.6 Dominio de conjuros (Mago 18)

Se elige en la ficha (no al subir): en el bloque del Mago, un selector «Dominio de conjuros» con dos desplegables — un conjuro de nivel 1 y otro de nivel 2 **de su libro** con tiempo de lanzamiento de una acción. Se guarda en `sheet.spellMastery?: { 1?: Ref; 2?: Ref }` con una op nueva `{ op: "setMastery", level: 1 | 2, ref: Ref | null }` en `PATCH /spells` (escritura condicional como `setOption`). Quedan siempre preparados (origen «Dominio de conjuros»). Si un conjuro elegido deja de estar en el libro (borrar nivel), se ignora.

### 2.7 Conjuros distintivos (Mago 20)

Elección nueva `bonusSpells` con `count: 2`, solo conjuros de nivel 3 **de su libro**. Siempre preparados (origen «Conjuros distintivos») y con **una casilla de uso cada uno** (§3).

## 3. Usos por descanso largo

- Hoja: `sheet.limitedUsed?: Record<string, number>` (clave = `refKey` del conjuro con prefijo de origen, p. ej. `arcanum:spell:finger of death|xphb`).
- Op nueva `{ op: "limited", key: string, used: number }` en `PATCH /spells`: valida que la clave exista en los usos del personaje y que `0 ≤ used ≤ max` (1 en ambos rasgos).
- `longRest` pone también `limitedUsed: {}`.
- `CasterBlock` gana `limited: { key: string; spell: Named; origin: string; max: number; used: number }[]`.
- UI: en el bloque, una sección con cada conjuro y sus casillas, igual que `SlotsBar`; sin controles para quien no es el dueño.

## 4. Dotes y Pacto del tomo

- **Cambio de conjuro de Iniciado en la magia**: en cada subida de nivel, `pendingChoices` ofrece en la elección de la dote un `replace` opcional (`featSpells.replace?: { out: Named; in: Named }`, un conjuro de los elegidos por otro de la misma lista y nivel). Se aplica en `chosenFeatSpells`.
- **Dote base de Iniciado en la magia** (tres listas alternativas): `FeatData.spellChoices` gana `lists?: string[]`; la elección `featSpells` gana `list?: string`, que se elige primero (desplegable) y fija la lista de los trucos y el conjuro.
- **Pacto del tomo** (invocación): `OptionalFeatureData.spellChoices` (mismo formato que las dotes); elección `featSpells` con `feat` = la invocación: 3 trucos de cualquier clase y 2 rituales de nivel 1 de cualquier clase, siempre preparados (origen «Pacto del tomo»).
- **Menores aplazados**:
  - El mismo conjuro no se puede elegir a la vez por una dote y por la clase en el mismo nivel (la validación junta las elecciones del nivel).
  - `spellsGranted` deja de bloquear casos legales: un Mago puede copiar a su libro un conjuro de Mago que tenga por una dote; un multiclase puede aprender como Hechicero un conjuro que su subclase de Clérigo le da siempre preparado.
  - `spellOption` se limpia al borrar el nivel que dio la subclase (en `removeLastLevel`).

## 5. Aligerar las páginas

- **Listas bajo demanda**, con caché por libro como `listSpells` y filas ligeras:
  - creador y asistente: `GET /api/rules/spells?list=<id>&books=<ids>&campaign=<id>?`, con los libros recortados a los que el usuario puede usar (`usableBooks`, con la campaña si la hay);
  - ficha: `GET /api/characters/[id]/spells/list?list=<id>`, acotada a los libros del personaje (`loadCharacterFor(..., "read")`), para que el DM vea también los de libros privados del jugador.

  Cada fila lleva: `ref`, `name`, `nameEs`, `level`, `school`, `ritual`, `concentration`, `time`, `range`, `classes`, `tags` (sin `summary` ni componentes materiales).
- **Creador y rehacer creación**: ya no reciben `listSpells(books)` entero; piden la lista de la clase elegida (y las listas de dotes) al elegir la clase.
- **Asistente de subir de nivel**: pide la lista de la clase (y las de §2.1/§2.3/§4) del paso de conjuros al llegar a él.
- **Ficha**: con `tab=conjuros` recibe las listas como ahora; en las demás pestañas recibe solo los conjuros que el personaje tiene (para imprimir) y la pestaña Conjuros pide el resto al abrirse.
- **`es.json` fuera del cliente**: `spellClassNames` pasa al servidor (la ruta de detalle del conjuro devuelve `classNames`) y `spellText.ts` se divide en una parte cliente sin `es.json` (`spellSchoolName`, `spellTime`…, con su propio mapa de escuelas) y una de servidor.
- Medición: tamaño del HTML/RSC de `/characters/new?system=dnd-2024` antes y después, anotado en el informe de la tarea.

## 6. Errores y casos límite

- Bardo que baja de nivel 10 (borrar nivel): los conjuros de otras listas preparados se recortan como cualquier preparado que ya no cabe (`trimSpells`).
- Brujo que pierde el nivel 11: la elección `arcanum` desaparece con el nivel y su uso en `limitedUsed` se ignora.
- Dominio de conjuros con un conjuro que ya no está en el libro: no se muestra; el selector lo deja vacío.
- Iniciado en la magia base en hojas antiguas sin `list`: se infiere de la lista de los conjuros elegidos; si no se puede, se pide de nuevo en la siguiente subida.

## 7. Pruebas

- Unitarias (vitest) por regla: Secretos mágicos (Bardo 9 rechaza un conjuro de Mago; Bardo 10 lo acepta al preparar y al subir), Arcano místico (nivel correcto, ya tenido → error), Descubrimientos mágicos (listas, nivel con espacios, sustitución), Sabio (escuela y nivel, `count` 2 al nivel 3 y 1 en los niveles con espacio nuevo), Ilusiones mejoradas (concede Ilusión menor; si ya la tiene, pide un truco), Dominio (solo del libro, nivel 1/2, acción), Distintivos (nivel 3 del libro), usos (`limited` fuera de rango → error, `longRest` limpia), Iniciado en la magia (sustitución y dote base con lista), Pacto del tomo, y los tres menores.
- Rutas: `PATCH /spells` con `setMastery` y `limited`; la ruta de listas (libros del usuario, caché).
- Navegador (sesión del usuario; personajes de prueba propios de nivel alto, creados por la API o por script como en tareas anteriores, y borrados al final): Bardo 10, Brujo 11, Mago 18/20 Ilusionista, Bardo del Saber 6, un Brujo con Pacto del tomo; tamaño de página del creador antes y después.

## 8. Archivos (principales)

- Reglas: `lib/rules/dnd2024/levels.ts`, `validate.ts`, `validateLevel.ts`, `spellOps.ts`, `derive/spells.ts`, `featSpells.ts`, `levelOps.ts`, `sheet.ts`, `spellText.ts`, `lib/rules/types.ts`, `schemas.ts`, `lib/rules/import/normalize.ts` (datos de rasgos y de `spellChoices` con listas), `featureChoices.ts` (sacar estos rasgos de `NOT_A_CHOICE`).
- Interfaz: `app/components/characters/levelup/steps/SpellsStep.tsx` (y un paso para `arcanum`/`bonusSpells`), `app/components/characters/spells/CasterBlockView.tsx`, `SpellsTab.tsx`, `SpellDialog.tsx`, el creador y las páginas `characters/new`, `recreate`, `level-up` y `[id]`.
- Rutas: `app/api/characters/[id]/spells/route.ts`, nueva ruta de listas.
- Notas: actualizar `docs/superpowers/notes/conjuros-pendientes.md` (vaciar lo hecho).
