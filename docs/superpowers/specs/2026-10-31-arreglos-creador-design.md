# Arreglos del creador y defensas en la ficha — diseño

Fecha: 2026-10-31.

## 1. Objetivo

Seis fallos que el usuario encontró probando el creador de personajes D&D 2024 tras fusionar los planes anteriores:

1. Los lanzadores ven conjuros de nivel 2, 3… al crear un personaje de nivel 1.
2. El brujo ve invocaciones que piden un nivel que aún no tiene.
3. Con Iniciado en la magia (p. ej. trasfondo Erudito) se puede marcar el mismo truco o conjuro que con la clase.
4. El creador pide preparar conjuros; deben prepararse después, desde la ficha.
5. La ficha no muestra resistencias.
6. Con «Mediante tiradas», al crear un personaje y empezar otro reaparecen las tiradas del anterior.

Éxito: en la creación y al subir de nivel solo aparecen las opciones que se pueden elegir; no se puede elegir dos veces un conjuro desde dos fuentes (ni en el formulario ni en el servidor); el personaje se crea sin preparados; la pestaña Información muestra resistencias, inmunidades, vulnerabilidades e inmunidades a estados con su origen; cada personaje nuevo empieza sin tiradas.

Fuera de alcance: defensas condicionales que en 5etools solo son texto (Furia del Bárbaro, rasgos de subclase, conjuros activos); un campo de defensas manuales; cambios en la pestaña Conjuros de la ficha (sus listas «Disponibles» y «Todos» siguen mostrando todos los niveles); filtrar dotes por nivel.

## 2. Conjuros e invocaciones elegibles (puntos 1 y 2)

Afecta a la creación y a subir de nivel, que comparten componentes.

### 2.1 Conjuros — `app/components/characters/levelup/steps/SpellsStep.tsx`

- La lista de la clase (`list`) solo incluye trucos y conjuros de nivel `1..maxLevel`. Desaparecen las filas atenuadas (`dimmed`) y el motivo «Nivel demasiado alto (hasta el N)».
- Con Secretos mágicos (`extraLists`) se aplica el mismo tope.
- Los filtros de la lista (`SpellFilters`) y el contador «N conjuros» trabajan sobre la lista ya recortada; las etiquetas (`tags`) salen de ella.
- Las entradas gratis del Sabio de la escuela y las sustituciones ya filtran por nivel: no cambian.
- `FeatSpellsStep` ya filtra por el nivel de la dote: no cambia.

### 2.2 Invocaciones — `app/components/characters/creator/ClassFeaturesSection.tsx`

- En las opciones `optionalFeature`, las que tienen `prerequisite.level` mayor que `ctx.classLevel` no se listan.
- Las que piden un pacto o un rasgo (`prerequisite.pact`, `prerequisite.feature`) siguen visibles y desactivadas con su motivo («Requiere Pacto del tomo»), porque se pueden cumplir eligiendo el pacto en otro desplegable del mismo paso.
- Una invocación ya elegida que deja de cumplir el nivel (no debería ocurrir al crear) no se borra del valor: el servidor la rechaza como hasta ahora.

## 3. Un conjuro, una sola fuente (punto 3)

### 3.1 Formulario

- En el creador (`CharacterCreator.tsx`), los conjuros de la clase pasan a `FeatSpellsStep` como ya tenidos (`granted`) y los de cada dote pasan a `SpellsStep` y a las demás dotes. El motivo que se ve es «Ya lo eliges con {fuente}» (la clase o el nombre de la dote), en lugar del genérico «Ya lo tienes».
- Para ello `granted` admite un origen por conjuro: `granted?: { key: string; label: string }[]` (o un `Map<string, string>`), y el texto del motivo y de la marca de la fila sale de ahí. Los conjuros dados por especie, linaje o clase siguen diciendo «Ya lo tienes».
- Lo mismo al subir de nivel cuando en el mismo nivel hay elección de clase y de dote (Iniciado en la magia como dote de un nivel 4, Pacto del tomo).
- Si un conjuro ya marcado en una fuente pasa a estar en otra (p. ej. el jugador lo marca primero en la dote y luego cambia de trasfondo), el formulario no lo borra solo: el envío lo rechaza con el error de §3.2 en la sección de la dote.

### 3.2 Servidor — `lib/rules/dnd2024/spells/featSpells.ts`

- `featSpellClash` comprueba también dote contra dote: el mismo truco o conjuro (incluido `replace.in`) en dos elecciones `featSpells` del mismo nivel es un error en la segunda: «Conjuros de {dote}: {conjuro} ya lo eliges con {otra dote}.».
- El mensaje actual dote contra clase se mantiene.
- La comprobación corre al crear (`checkFeatSpells`) y al subir de nivel (donde ya se use `featSpellClash`).

## 4. Sin preparar al crear (punto 4)

- `SpellsStep` en la creación deja de recibir `prepared`: desaparecen el contador «Prepara hasta N conjuros», la nota «Prepara conjuros…», la lista «Preparados de tu libro» y las casillas de preparar de los modos `list` y `spellbook`.
- El Mago sigue eligiendo los conjuros de su libro. El Clérigo, el Druida y el Paladín (modo `list`) solo eligen trucos, si su nivel 1 los da; si no hay nada que elegir, la sección de conjuros muestra solo la nota.
- En su lugar, una nota en la sección de conjuros del creador: «Prepararás tus conjuros desde la pestaña Conjuros de la ficha.».
- `FormState.prepared` y su borrador desaparecen; un borrador antiguo con `prepared` se lee sin error y lo ignora.
- El servidor (`validateSheet` / `checkSpells`) deja de aceptar preparados al crear: la hoja se guarda con `prepared: {}`. Al rehacer la creación (`/api/characters/[id]/creation`) también se vacían, igual que se reinicia el inventario; el aviso de confirmación de rehacer lo menciona.
- La pestaña Conjuros de la ficha ya permite preparar; con 0 preparados muestra su estado vacío actual.

## 5. Tiradas que no se reinician (punto 6)

- El borrador del creador vive en `localStorage` (`roll2go:new-character:<sistema>:<campaña|none>`) y se borra tras crear con éxito. Con eso solo no se explica el fallo, así que la causa se busca reproduciéndolo en el navegador (crear con tiradas, volver a «Nuevo personaje» por el mismo camino que el usuario) antes de tocar código.
- Arreglo de la causa encontrada, con una prueba que la reproduzca.
- Además, como defensa: tras un envío con éxito, el formulario deja de guardar el borrador (un indicador `submitted` que el efecto de guardado respeta), para que ningún renderizado posterior lo vuelva a escribir.

## 6. Defensas en la ficha (punto 5)

### 6.1 Datos — `lib/rules/import/normalize.ts` y `lib/rules/types.ts`

- Tipo nuevo `Defenses = { resist?: DefenseList; immune?: DefenseList; vulnerable?: DefenseList; conditionImmune?: DefenseList }` con `DefenseList = (string | { choose: { from: string[]; count: number } })[]`. Los tipos de daño y estados se guardan en minúsculas y en inglés, como en 5etools (`"poison"`, `"frightened"`).
- Se normaliza desde los campos `resist`, `immune`, `vulnerable` y `conditionImmune` de 5etools en especies, linajes (las versiones de `_versions` ya traen el suyo: Dracónido por color, Tiflin por legado), dotes y objetos. Las entradas condicionales con texto (`{ special: … }`, `{ resist: [...], note, cond: true }`) se descartan.
- `count` por defecto 1.
- Hace falta reimportar los libros; el README («Despliegue») lo indica.

### 6.2 Elección de tipo

- Una especie o linaje con `choose` (no ocurre en el Manual 2024 una vez elegido el linaje) se muestra como «a elegir» sin pedir nada.
- Una dote con `choose` (Don de resistencia a la energía: 2 de 9) pide los tipos al cogerla, junto a la dote, igual que la característica que mejora: se guardan en la dote elegida (`FeatPickValue.resist`) y el servidor los valida al comprobar la dote. Las etiquetas en español salen de `lib/rules/i18n`.

### 6.3 Objetos

- Un objeto del inventario cuenta si está equipado.
- Los objetos con defensas (además de armas, armaduras y escudos) pasan a ser equipables: `itemInfo.equippable` en `app/(main)/characters/[id]/page.tsx` y la ruta que cambia `equipped` aceptan también los que tienen `defenses`.

### 6.4 Cálculo — `lib/rules/dnd2024/derive`

- `Derived.defenses: { kind: "resist" | "immune" | "vulnerable" | "conditionImmune"; type: string; sources: string[] }[]`, de la especie, el linaje, las dotes (con el tipo elegido) y los objetos equipados. Un mismo tipo de varias fuentes sale una vez con todas.
- Una inmunidad no borra la resistencia del mismo tipo: se muestran las dos.

### 6.5 Vista — pestaña Información

- Tarjeta «Defensas» con grupos Resistencias, Inmunidades, Vulnerabilidades e Inmunidad a estados, en español («Veneno», «Asustado»). Si no hay ninguna, la tarjeta no aparece.
- Al pulsarla se abre el diálogo de desglose (`StatDialog`), con cada tipo y su origen («Veneno · Enano», «Fuego · Anillo de resistencia»).
- Se imprime como texto (`data-print="text"`), como el resto de la pestaña.

## 7. Pruebas

- vitest de §2: la lista de `SpellsStep` no incluye conjuros por encima de `maxLevel`; las opciones de invocación omiten las de nivel alto y conservan desactivadas las de pacto. Donde la lógica esté en el componente, se extrae a una función pura testeable.
- vitest de §3: `featSpellClash` dote contra dote y dote contra clase; el creador marca «Ya lo eliges con…».
- vitest de §4: `validateSheet` guarda `prepared: {}` aunque lleguen preparados; un borrador con `prepared` se lee.
- vitest de §5: la prueba que reproduce la causa encontrada.
- vitest de §6: normalización de las cuatro listas (cadenas, `choose`, condicionales descartadas) en especie, linaje, dote y objeto; `derive.defenses` con fuentes y objetos equipados/no equipados; la elección `damageType`.
- En verde en cada commit: vitest, `tsc`, `eslint app lib tests scripts` y `next build`.
- En el navegador, con personajes de prueba propios que se borran al terminar (y restaurando los borradores del creador): un Mago Erudito (punto 3), un Brujo (punto 2), un Clérigo por tiradas creado dos veces seguidas (puntos 1, 4 y 6) y un Enano con un objeto de resistencia equipado (punto 5).
