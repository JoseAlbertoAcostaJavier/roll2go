# Descanso corto con dados de golpe — diseño

Fecha: 2026-11-01. Primera de las cuatro fases que siguen al rework de la estructura de la ficha (`2026-10-31-ficha-estructura-design.md`): 1) descanso corto con dados de golpe, 2) Acciones unificadas, 3) Conjuros con búsqueda y filtros, 4) Rasgos, Trasfondo y retoque visual.

## 1. Objetivo

El descanso corto deja de estar bloqueado cuando no hay espacios ni usos que recuperar: en D&D 2024 sirve sobre todo para gastar dados de golpe y recuperar puntos de golpe. Roll2Go pasa a llevar la cuenta de los dados de golpe gastados, a curar con ellos en el descanso corto y a recuperarlos todos en el descanso largo.

Éxito: el botón «Descanso corto» siempre abre un diálogo útil; se pueden gastar dados de golpe por clase, con tirada de Roll2Go o con el total de una tirada física; los PG suben sin pasar del máximo; los dados gastados se ven en la ficha y vuelven con un descanso largo.

Fuera de alcance: rasgos que añaden curación al gastar dados (Durable, Song of Rest…), la tirada de dados en el chat o en un historial, y cualquier cambio de la subida de nivel.

## 2. Datos

- `Dnd2024SheetV2` gana `hitDiceUsed: Record<string, number>` (clave: `refKey` de la clase, como `summarizeClasses`). Ausente o `{}` = ninguno gastado. `upgradeSheet` lo rellena con `{}` si falta.
- Dados de golpe disponibles: por cada clase del historial, `{ classKey, name, die: ClassData.hitDie, total: nivel en esa clase, used: min(hitDiceUsed[classKey] ?? 0, total) }`. Función pura `hitDicePools(sheet, entries): HitDicePool[]` en `lib/rules/dnd2024/sheet/rest.ts`. Una clase sin datos del catálogo no aparece.

## 3. Reglas (módulo puro `lib/rules/dnd2024/sheet/rest.ts`)

`applyRest(sheet, op, ctx): EditResult`, con `ctx = { pools: HitDicePool[], conMod: number, maxHp: number, roll: (die: number) => number }`:

- `{ op: "longRest" }`: lo que ya hace hoy (`slotsUsed: {}`, `limitedUsed: {}`, `hp.current = null`, `hp.temp = 0`) y además `hitDiceUsed: {}`.
- `{ op: "shortRest", spend?: Record<string, number>, healing?: number }`:
  - Recupera lo que ya recupera hoy (espacios de Magia de pacto y usos que vuelven con descanso corto).
  - `spend`: por clase, entero de 0 a los que le quedan (`total - used`); una clase desconocida o un número fuera de rango → error «No te quedan tantos dados de golpe de {clase}.». Sin `spend` o todo a 0: no se cura nada y no se anota nada.
  - Curación automática (sin `healing`): por cada dado, `max(1, roll(die) + conMod)`; se suma todo.
  - Curación manual (`healing` presente): entero entre el mínimo (`n` dados × `max(1, 1 + conMod)`) y el máximo (`Σ max(1, die + conMod)`) de esos dados; fuera de rango → error «Con esos dados recuperas entre {mín} y {máx} puntos de golpe.». Con 0 dados, `healing` debe faltar.
  - PG: actuales (`hp.current ?? maxHp`) + curación, sin pasar de `maxHp`; si llegan al máximo, `current: null`. Los temporales no cambian.
  - `hitDiceUsed[classKey] += spend[classKey]`.
- Las operaciones `longRest` y `shortRest` salen de `spellOps.ts` (y de la ruta de conjuros) y pasan a este módulo; `spellOps` conserva solo lo de conjuros. `shortRestRestores` deja de usarse para habilitar nada y se elimina si no tiene más usos.

## 4. Servidor

- Ruta nueva `PATCH /api/characters/[id]/rest` (solo el dueño, límite de peticiones como las demás ediciones de la ficha) que recibe `{ op: "longRest" }` o `{ op: "shortRest", spend?, healing? }`.
- Servicio en `lib/server/characters/sheetEdits.ts`: carga el personaje, calcula `pools`, `conMod` y `maxHp` con `derive` (como hace hoy la ruta de conjuros con sus contextos), `roll = (die) => crypto.randomInt(1, die + 1)`, y escribe `slotsUsed`, `limitedUsed`, `hp` y `hitDiceUsed` en una sola actualización con `unchangedFilter`, como el resto de ediciones.
- Respuesta: `{ ok: true, healed: number, rolls?: number[] }` (los dados tirados, para enseñarlos) o el error.

## 5. Interfaz

### 5.1 Diálogo «Descanso corto» (`RestButtons`)

- El botón siempre está activo y siempre abre el diálogo (desaparece el texto «No tienes nada que se recupere…»).
- Texto: «Un descanso corto dura al menos 1 hora. Puedes gastar dados de golpe para recuperar puntos de golpe.»
- Una fila por clase: «{Clase} (d{dado}) · te quedan {libres} de {total}» y un selector numérico de 0 a los libres (con − y +). Si no le quedan, la fila aparece desactivada.
- Casilla **«Aplicar automáticamente la tirada»**, marcada por defecto. Desmarcada (y con al menos un dado elegido) muestra el campo «PG recuperados» con el rango posible como ayuda («entre 2 y 9»).
- Si el personaje recupera algo más con el descanso corto (pacto, usos), una línea lo dice: «También recuperas los espacios de Magia de pacto y los usos que vuelven con un descanso corto.».
- Botones «Hacer descanso corto» y «Cancelar». Tras el éxito, si hubo tirada automática, el diálogo muestra el resultado antes de cerrarse: «Has recuperado {n} PG ({dados}).» con «Cerrar»; si no, se cierra. Siempre `router.refresh()`.
- Errores del servidor dentro del diálogo, como hoy.

### 5.2 Descanso largo

- Texto de confirmación: «¿Hacer un descanso largo? Recuperas todos los puntos de golpe, los dados de golpe y los espacios de conjuro.». Llama a la ruta nueva.

### 5.3 Ficha

- En la caja de PG de la franja superior, debajo: «Dados de golpe: {libres por clase}» (p. ej. «2d10 · 1d6»; con todos gastados de una clase, «0d6»). Solo lectura.

## 6. Pruebas

- vitest `rest.ts`: `hitDicePools` (multiclase, nivel por clase, clase sin catálogo), descanso corto automático (roll fijo: 1d10 + 2 con roll 4 → 6; con conMod −3 y roll 1 → 1), manual en rango y fuera de rango, gastar más de los libres, clase desconocida, PG sin pasar del máximo y `current: null` al llegar, 0 dados (solo recupera pacto/usos), descanso largo vacía `hitDiceUsed` y deja PG al máximo.
- vitest de la ruta o del servicio (con la base falsa de `tests/server`) para `shortRest` con dados: guarda `hp` e `hitDiceUsed`.
- `upgradeSheet` añade `hitDiceUsed: {}` a una hoja antigua.
- En verde: vitest, `tsc`, `eslint app lib tests scripts`, `next build` al final.
- Navegador con un personaje de prueba propio (borrado al terminar): dañar, descanso corto con tirada automática y con total manual, ver los dados restantes, descanso largo los recupera.
