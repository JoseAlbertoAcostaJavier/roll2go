# Subir de nivel D&D 2024 — Diseño (parte 4)

Fecha: 2026-10-23 · Estado: pendiente de revisión
Depende de: `2026-10-22-creador-personajes-design.md` (partes 1–2) y `2026-10-23-ficha-personaje-design.md` (parte 3).
Relacionada: `2026-10-23-conjuros-design.md` (parte 5) define la elección `spells`.

## 1. Objetivo

Que el dueño de un personaje pueda **subir de nivel del 2 al 20** con un asistente paso a paso que muestre lo que gana y le pida las elecciones que toquen, con **multiclase** según las reglas de 2024, y que pueda **borrar el último nivel**.

### Decisiones tomadas con el usuario

| Tema | Decisión |
|---|---|
| Progresión | **Historial de niveles** (`sheet.levels[]`): cada entrada guarda clase, PG y elecciones. La ficha se calcula recorriéndolo. |
| Elecciones | **Guiadas por los datos** del catálogo (progresiones de 5etools) más una tabla manual pequeña para los rasgos que solo lo indican en texto. |
| PG | Media o tirada (firmada por el servidor); máximo solo en el nivel 1 de la primera clase. |
| Multiclase | Sí, con los requisitos de 2024. |
| Permisos | Solo el dueño sube y borra niveles. Subir es libre (sin exigir PX). |
| Deshacer | Solo el último nivel. El nivel 1 no se borra: se usa «Rehacer creación». |

### Fuera de alcance

Exigir PX para subir, variantes opcionales de reglas, rasgos que dependen de objetos mágicos, Compañeros (familiares, compañero de bestia como criatura), exportar a Foundry.

## 2. Modelo de datos

### 2.1 Entrada de nivel

```ts
type LevelEntry = {
  n: number;                 // nivel total tras esta entrada (1..20)
  class: Named;              // clase en la que sube
  classLevel: number;        // nivel en esa clase tras esta entrada
  hp: { method: "max" | "average" | "roll"; value: number; token?: string };
  choices: Choice[];
};

type Choice =
  | { type: "subclass"; source: string; value: Named }
  | { type: "asi"; source: string; value: { abilities: Partial<Record<Ability, 1 | 2>> } | { feat: Named } }
  | { type: "feat"; source: string; value: Named[] }             // estilo de combate, don épico…
  | { type: "optionalFeature"; source: string; value: Named[]; replaced?: Named[] }
  | { type: "weaponMastery"; source: string; value: Ref[] }      // armas (objetos de tipo arma)
  | { type: "featureOption"; source: string; value: Named }      // Orden divina, Orden primigenia…
  | { type: "skills"; source: string; value: string[] }
  | { type: "expertise"; source: string; value: string[] }
  | { type: "spells"; source: string; value: SpellChoice };      // definido en la parte 5
```

`source` es la clave del rasgo o de la progresión que pide la elección (p. ej. `classFeature:ability score improvement|barbarian|xphb|4`, `progression:metamagic|sorcerer|xphb`). Sirve para casar cada elección con lo que pide `pendingChoices`.

### 2.2 Hoja v2

`sheet.version = 2`. Cambios respecto a v1:
- `classes[]` desaparece como fuente de verdad: las clases y sus niveles se calculan desde `levels[]`. Se mantiene una copia `classesSummary: { class: Named; level: number; subclass: Named | null }[]` para el listado y la búsqueda de `/characters` (se recalcula al guardar).
- Las elecciones de nivel 1 de clase (habilidades, equipo) pasan a `levels[0].choices` (`skills`, y el equipo sigue en `levels[0].equipment: string`).
- Se añade `inventory` (parte 3).

### 2.3 Catálogo

- `ClassData` gana:
  - `progressions`: `feats` (`featProgression`: categoría y niveles), `optionalFeatures` (`optionalfeatureProgression`: tipo y número acumulado por nivel), `weaponMastery` (`itemMasteriesProgression`), `cantrips` (`cantripProgression`), `prepared` (`preparedSpellsProgression`), `spellbook` (`spellsKnownProgressionFixed`).
  - `table`: `classTableGroups` normalizado (columnas con nombre en español y valores por nivel).
  - `multiclass`: `{ requirements: { abilities: Ability[]; any: boolean }, proficiencies: { armor, weapons, tools, skills? } }` desde `multiclassing` y `primaryAbility`.
  - `subclassTitle` en español («Senda primitiva», «Dominio divino»…).
- Nuevo `kind: "optionalFeature"` (de `optionalfeatures.json`, 58 entradas XPHB): `data = { featureType: string[]; prerequisite?: { level?: number; spell?: Ref; pact?: string; feature?: string } }`.
- `classFeature` / `subclassFeature` ganan `data.options?: Ref[]` (bloques `options` con `refOptionalfeature` o `refClassFeature`) y `data.asi?: true` para «Ability Score Improvement».
- Esquemas en `lib/rules/schemas.ts` ampliados para todo lo anterior (los usa también el homebrew).
- El importador lo rellena y se reimporta.

### 2.4 Elecciones de rasgos escritas a mano

`lib/rules/dnd2024/featureChoices.ts`: `Record<featureKey, ChoiceSpec>` para los rasgos que solo lo dicen en texto, con `ChoiceSpec = { type: "skills" | "expertise" | "featureOption"; count: number; from?: string[] }`. Cubre como mínimo: Pericia (Bardo 2 y 9, Pícaro 1 y 6, Explorador «Explorador hábil» 2), Conocimiento primigenio (Bárbaro 3) y los demás rasgos XPHB cuyo texto pida elegir habilidades o pericias. Para no dejarse ninguno, el importador lista en su informe los rasgos cuyo texto contiene «choose» y no tienen especificación, y la implementación debe dejar esa lista vacía para el XPHB. Las entradas homebrew podrán declarar `data.choices: ChoiceSpec[]` con la misma forma.

## 3. Qué toca elegir — `pendingChoices`

`pendingChoices(sheet, classRef, newClassLevel, catalog) → PendingChoice[]` (pura, en `lib/rules/dnd2024/levels.ts`), donde `PendingChoice = { type, source, count, from?, options?, label }`:

1. **Subclase**: si `newClassLevel` es el nivel del rasgo «X Subclass» de la clase (Bárbaro 3…), elegir una subclase de esa clase (de los libros usables).
2. **Mejora de característica**: si la clase tiene un rasgo `asi` en ese nivel: elegir +2 a una / +1 a dos (tope 20) **o** una dote de categoría general cuyos prerrequisitos se cumplan.
3. **Dotes de progresión**: por cada `progressions.feats` con valor en ese nivel (estilo de combate, don épico a 19): elegir N dotes de esa categoría.
4. **Opcionales**: por cada `progressions.optionalFeatures`, la diferencia entre el acumulado de este nivel y el anterior → elegir esas; además, si la regla de la clase lo permite, sustituir una (`replaced`, opcional).
5. **Maestrías**: si `progressions.weaponMastery` aumenta → elegir las armas nuevas (armas sencillas o marciales con maestría con las que el personaje tiene competencia).
6. **Opción de rasgo**: por cada rasgo nuevo con `data.options` → elegir una.
7. **Habilidades / pericia**: por cada rasgo nuevo con entrada en `featureChoices` (o `data.choices` homebrew).
8. **Conjuros**: según la parte 5.
9. **Rasgos de subclase** del nuevo nivel: aplicar las mismas reglas 6–8 a los rasgos de la subclase.

Al entrar en una **clase nueva** (multiclase, `newClassLevel = 1`): además, las habilidades que dé `multiclass.proficiencies.skills` (p. ej. Explorador, Pícaro, Bardo: 1 habilidad).

El asistente y `validateLevel` usan la misma función: el servidor exige exactamente las elecciones pendientes (ni más ni menos), con el `count` y las opciones permitidas.

## 4. Flujos

### 4.1 Página `/characters/[id]/level-up`
- Solo el dueño (otros: 404). Si el personaje está a nivel 20: redirige a la ficha.
- Dos columnas (en móvil, la tarjeta arriba plegada):
  - **Izquierda**: el paso actual con **Anterior / Siguiente** (Siguiente desactivado mientras falte algo, con texto «Falta: …»).
  - **Derecha**: tarjeta «Nuevo nivel: {Clase}» con icono, descripción, dado de golpe y desplegable «Rasgos de clase» con la tabla de la clase (`table`) y la fila del nuevo nivel resaltada.
- Pasos (solo los que apliquen, en este orden):
  1. **Clase**: subir en una clase actual (por defecto la última) o en otra. Las clases que no cumplen el requisito salen desactivadas con el motivo («Necesitas 13 en Fuerza y 13 en Sabiduría»).
  2. **Rasgos automáticos**: «Obtienes o mejoras los siguientes rasgos al alcanzar el nivel N», lista plegable de los rasgos nuevos de clase y subclase con su descripción.
  3. **Subclase** (si toca).
  4. Una pantalla por cada `PendingChoice` (salvo conjuros):
     - `asi`: pestañas «Mejorar características» (fichas de `AbilityScores`, tope 20) y «Dote» (`RuleSelect` de dotes generales con prerrequisitos);
     - `feat`, `optionalFeature`, `featureOption`: `RuleSelect` simple o múltiple con «Elige N», descripción debajo, opciones que no cumplen prerrequisitos desactivadas con el motivo;
     - `skills`, `expertise`, `weaponMastery`: chips con contador «N de N»; las que ya tiene salen marcadas e inactivas.
  5. **Conjuros** (parte 5).
  6. **Puntos de golpe**: botones **Media** (`dado/2 + 1`), **Tirar** (`POST /api/dice/hit-die` → `{ value, token }` firmado como las tiradas de características, con animación) y **Máximo** (solo si es el nivel 1 de la primera clase, caso que solo se da al rehacer la creación). Muestra «+7 (5 + CON 2) → 31 PG».
  7. **Confirmar**: resumen de todo lo elegido y **Confirmar nivel**.
- Borrador en `localStorage` (`roll2go:level-up:<characterId>:<n>`), con try/catch; se borra al confirmar.
- **Confirmar** → `POST /api/characters/[id]/levels` `{ class, choices, hp }`:
  - dueño, `rateLimit("character_level", userId, 60, 3600)`;
  - `validateLevel`: el nivel total sería ≤ 20; la clase existe en libros usables; requisitos de multiclase si es nueva; `pendingChoices` coincide exactamente; cada `Ref` dentro de `usableBooks`; prerrequisitos de dotes/opcionales; `asi` con tope 20; `hp` con método válido (`roll` con token válido del usuario, 24 h, valor dentro del dado; `average` exacto; `max` solo en primera clase nivel 1);
  - añade la entrada, recalcula `classesSummary`, recorta `hp.current` al nuevo máximo si hiciera falta (si `current` era el máximo anterior, sube con él);
  - si hay campaña y el dueño no es el DM, `notify` al DM con el tipo nuevo `character_level_up` («{Jugador} ha subido a {Personaje} a nivel N»), grupo de correo «Avisos del DM»;
  - redirige a la ficha con «Nivel guardado correctamente».

### 4.2 Multiclase (reglas 2024)
- **Requisito**: 13 o más en la característica principal de **cada** clase actual **y** de la nueva (si la clase admite varias, `any: true`, basta una). Se usan las características actuales (con mejoras).
- **Al entrar**: competencias de `multiclass.proficiencies` de la nueva clase; no se ganan sus salvaciones ni su equipo inicial; PG por media o tirada.
- **Por nivel total**: bonificador de competencia.
- **Por nivel de clase**: rasgos, subclase, mejoras, progresiones, tabla de clase.
- **No acumulables**: Ataque adicional (se toma el mayor), Defensa sin armadura (si dos clases la dan, se usa la mayor; ver parte 3 §4.3).
- **Espacios de conjuro**: tabla de lanzador multiclase (parte 5 §2).

### 4.3 Borrar nivel
- Botón **Borrar nivel** en la ficha (dueño, nivel ≥ 2) y en el asistente; confirmación «Se perderán los PG, rasgos y elecciones del nivel N».
- `DELETE /api/characters/[id]/levels/last`: dueño, mismo rate limit; quita la última entrada; recalcula `classesSummary`; quita de `prepared` los conjuros que ya no estén disponibles (parte 5); recorta `hp.current`; el inventario no cambia.

### 4.4 Rehacer creación (nivel 1)
- Solo con el personaje a nivel 1. En `/characters/[id]/edit`, botón **Rehacer creación** → `/characters/[id]/recreate`: el creador (parte 2) precargado con especie, legado, trasfondo, características, clase y elecciones de nivel 1.
- Al guardar (`PUT /api/characters/[id]/creation`): mismas validaciones que el alta; sustituye `levels[0]` y los datos de creación; aviso previo «Se reiniciará el inventario con el equipo inicial elegido» y se vuelve a volcar.

## 5. Migración v1 → v2

`npm run migrate:levels` (tsx, idempotente, carga `.env.local`):
- para cada `Character` con `sheet.version` 1: crea `levels[0]` desde `classes[0]` (`hp: { method: "max", value: hitDie }`, elecciones `skills`), vuelca el equipo inicial a `inventory` (parte 3 §2), calcula `classesSummary`, pone `version: 2`;
- informa de cuántos convirtió; los v2 se saltan.
- `derive`, `validate` y la ficha aceptan v1 y v2 hasta que se ejecute (v1 se convierte en memoria con la misma función que usa el script).

## 6. Pruebas

- Unitarias:
  - `pendingChoices`: Bárbaro 2 (ninguna elección), 3 (subclase + Conocimiento primigenio: 1 habilidad), 4 (asi + maestría: de 2 a 3 armas); Guerrero 1 (estilo de combate), Hechicero 2 (metamagia 2), Brujo 2 (invocaciones), Clérigo 1 (Orden divina), Pícaro 6 (pericia), don épico a 19; entrada multiclase en Explorador (1 habilidad).
  - `validateLevel`: elección que sobra o falta, `Ref` fuera de libros, prerrequisito de invocación no cumplido, asi que pasa de 20, requisito de multiclase no cumplido, nivel 21, token de PG ajeno/caducado/fuera de rango, media incorrecta, máximo fuera del nivel 1.
  - multiclase en `derive`: competencia por nivel total, Ataque adicional no acumulable, salvaciones solo de la primera clase.
  - borrar nivel: quita elecciones y recorta PG.
  - migración v1 → v2: personaje de prueba del creador produce `levels[0]` e inventario esperados; idempotente.
- Navegador: subir un Bárbaro de 1 a 4 (subclase, maestría, asi), un Guerrero a 3 con multiclase en Pícaro (requisito, pericia), un Hechicero a 2 (metamagia); borrar nivel; rehacer creación; vista del DM sin botones; móvil.

## 7. Riesgos

- Rasgos de 5etools con elecciones solo en texto que no estén en `featureChoices`: el importador los lista para revisión; mientras tanto el rasgo se muestra sin elección.
- Subclases de clase con nivel distinto a 3 en homebrew: se lee del rasgo «X Subclass», no se asume 3.
- `derive` y `pendingChoices` dependen de muchas entradas del catálogo: cargarlas en lote por clase y nivel.
