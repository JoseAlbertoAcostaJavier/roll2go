# Usos y acciones: contadores cuadrados, usos de rasgos, lista de acciones, daño de conjuros e iconos de escuela — diseño

Fecha: 2026-11-03. Primer bloque del brief de rework («Marcadores de uso», «Rework de Acciones», iconos de escuela). Referencias: capturas de D&D Beyond (acciones con «Rage (Enter) □□ / Long Rest», tabla de ataques con el daño de los trucos) y la ficha actual.

## 1. Objetivo

Un Bárbaro ve «Furia □□ / Descanso largo» en Acción adicional, marca un cuadrado al usarla, un descanso corto le devuelve uno y uno largo todos. Los espacios de conjuro usan los mismos cuadrados. En Acciones, «Descarga de fuego» muestra «1d10» y cada conjuro lleva el icono de su escuela.

Fuera de alcance: inventario, rasgos compactos con página, creación de personajes (fases propias); contadores manuales del jugador; reservas de subclase con escala propia (`@scale.<subclase>.*`) salvo que la tabla propia las complete.

## 2. Usos de rasgos (reglas puras)

- `lib/rules/dnd2024/derive/featureUses.ts`:
  - `export type Recovery = { long: "all"; short: "all" | "none" | number }` (`number` = cuántos vuelven con un descanso corto).
  - `export type FeatureUse = { key: string; name: string; max: number; used: number; recovery: Recovery }` (`key` = `refKey` del rasgo).
  - `featureUses(sheet, entries, features: FeatureGroup[], level info…): FeatureUse[]` para cada rasgo que tiene el personaje (clase, subclase, especie, linaje y dotes), en el orden de `features`.
- Fuente de cada rasgo: la tabla propia `USES` (clave «desnuda» del rasgo → `{ max: fórmula; recovery }`) gana sobre Foundry (`entry.foundry.system["uses.max"]` y `uses.recovery`). Recuperación de Foundry: `{ period: "lr", type: "recoverAll" }` → `long: "all"`; `{ period: "sr", type: "recoverAll" }` → `short: "all"` (y `long: "all"`); `{ period: "sr", type: "formula", formula }` → `short: <número evaluado>`; sin `uses.recovery` y sin entrada propia → `{ long: "all", short: "none" }`.
- Fórmulas: números, `+ - * /`, paréntesis, `max`, `min`, `floor`, `@prof`, `@abilities.<fue…car>.mod`, `@classes.<clase>.levels`, `@scale.<clase>.<columna>` (columna de la tabla de clase al nivel actual de esa clase). Una fórmula con algo desconocido, o que da menos de 1, deja el rasgo sin contador. Evaluador propio, sin `eval`.
- Columnas de la tabla de clase: `ClassTable.columns[]` gana `id` (etiqueta inglesa de 5etools en minúsculas con espacios → «-»: `rages`, `channel-divinity`, `wild-shape-uses`…) en el importador. Requiere reimportar.
- Tabla propia `USES` (mínimo): Furia `{ max: "@scale.barbarian.rages", recovery: { long: "all", short: 1 } }`; Tomar aliento `{ short: 1 }`; Oleada de acción `{ short: "all" }`; Indomable `{ short: "none" }`; Aguante incansable (orco) `{ max: "1", short: "none" }`; Recuperación arcana `{ max: "1", short: "none" }`; Inspiración bárdica `{ max: "max(1,@abilities.cha.mod)" }` con `short: "all"` desde Bardo 5 (Fuente de inspiración).
- Hoja: `featureUses?: Record<string, number>` (usados por clave). Hojas antiguas: todo disponible. Usados por encima del máximo actual (p. ej. tras borrar un nivel) se recortan al mostrarlo.
- Operación nueva en la ruta de estado (`PATCH /api/characters/[id]/status`): `{ op: "featureUse"; key: string; used: number }`, entero de 0 al máximo calculado («Ese rasgo no tiene usos.», «Los usos van de 0 a N.»). El servicio calcula los usos con `featureUses` para validar.
- Descansos (`rest.ts`): largo → todos a 0; corto → `short: "all"` a 0 y `short: n` resta n (mínimo 0).

## 3. Cuadrados (espacios y usos)

- Un componente `UseBoxes` sustituye a los círculos de `SpellSlotBoxes`: cuadrados con borde (`rounded-sm`). Convención de D&D Beyond: hueco = disponible, marcado (fondo de marca con ✓) = gastado. Pulsar el primer hueco marca uno más; pulsar uno marcado lo desmarca (y los siguientes). Texto `disponibles/máximo` como hoy. Solo lectura para los demás.
- Más de 10 usos: en vez de cuadrados, «n / máx» con botones − y + (Imposición de manos).
- Etiqueta de la recuperación tras los cuadrados: «/ Descanso largo» o «/ Descanso corto» (si `short: "all"`).

## 4. Lista de acciones

- Rasgos en cada sección de Acciones: fila con el nombre (botón que abre un diálogo con la descripción de 5etools, como los conjuros y las acciones básicas), «(Especial)» si su activación es especial, su origen a la derecha y, si tiene usos, los cuadrados con la recuperación debajo del nombre. Se quita el desplegable largo con la descripción entera.
- Los rasgos con usos que no son acción, acción adicional ni reacción van a «Otras».
- Rasgos y dotes: los rasgos con usos muestran también sus cuadrados.
- Impresión: cuadrados como texto («2/2 · Descanso largo»).

## 5. Conjuros en Acciones

- `SpellData.damage?: { dice: string; scaling?: { level: number; dice: string }[] }` en el importador: trucos desde `scalingLevelDice` (por nivel de personaje), conjuros de nivel desde el primer `{@damage …}` de su texto. Requiere reimportar.
- Columna Daño de Acciones: dados según el nivel del personaje en trucos (`Descarga de fuego` 1d10 en 1–4, 2d10 en 5–10…), con el tipo de daño como hoy. Sin dados → «—» como hoy.
- Iconos: el `cast-spell` genérico se sustituye por el de la escuela (`iconSrc("darkSchool", school)` o `"school"`, el que encaje con el fondo) en Acciones y en las listas y tabla de Conjuros.

## 6. Pruebas

- vitest: evaluador de fórmulas (`@prof`, `max(1,@abilities.cha.mod)`, `@scale.barbarian.rages` a nivel 1 y 3, desconocido → sin contador); `featureUses` (Bárbaro 1: Furia 2; Mago 1: Recuperación arcana 1; hoja antigua sin `featureUses`); op `featureUse` (válida, fuera de rango, clave sin usos); descansos (Furia 2/2 usadas → corto 1, largo 0; Oleada de acción con corto → 0); `id` de columnas en `classTable`; `SpellData.damage` (Descarga de fuego con escalado, Manos ardientes 3d6, sin daño → sin campo); dados por nivel.
- En verde: vitest, `tsc`, `eslint`; `next build` al final.
- Reimportar (con permiso) y navegador: personaje de prueba Bárbaro (Furia, descansos) y Mago (Recuperación arcana, espacios en cuadrados, daño de trucos, iconos), borrados al terminar; «Elara Prueba» en solo lectura; 375 px.
