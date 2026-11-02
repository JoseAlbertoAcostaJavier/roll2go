# Ficha: fidelidad visual, inspiración heroica y estados — diseño

Fecha: 2026-11-02. Última pieza del rework de la ficha (tras reglas de conjuros y Rasgos/Trasfondo/Notas). El Inventario queda para una fase propia.

## 1. Objetivo

La vista general de la ficha se parece lo más posible a la captura «Mejora UI» (disposición, proporciones y forma de las cajas), con la identidad de Roll2Go (tema oscuro, rojo de marca, tipografía e iconos propios; nada de D&D Beyond). Además, dos funciones que la captura muestra y la ficha no tenía: **Inspiración heroica** y **Estados** (con agotamiento).

Éxito: en escritorio la ficha se lee como la captura (franja superior, tres columnas, Iniciativa/CA/Defensas y Estados sobre las pestañas); el dueño marca la inspiración, añade «Envenenado» o sube el agotamiento a 2 y lo ve con su icono y su efecto; un descanso largo baja el agotamiento en 1; a 375 px no hay desbordes.

Fuera de alcance: aplicar automáticamente los efectos de estados y agotamiento a tiradas y velocidad, notas de salvación (ventajas), la inspiración que da la especie Humano al descansar, el Inventario.

## 2. Datos

- `Dnd2024SheetV2` gana campos opcionales: `heroicInspiration?: boolean`, `conditions?: string[]` (claves inglesas en minúsculas de 5etools, de `CONDITION_NAMES`, sin `exhaustion`), `exhaustion?: number` (0–6). Hojas antiguas: falso, vacío, 0.
- Reglas puras en `lib/rules/dnd2024/sheet/status.ts`:
  - `type StatusOp = { op: "inspiration"; value: boolean } | { op: "condition"; key: string; active: boolean } | { op: "exhaustion"; level: number }`.
  - `applyStatus(sheet, op: unknown): { ok: true; sheet } | { ok: false; error }`. Errores: «Petición no válida.», «Estado desconocido.», «El agotamiento va de 0 a 6.». Añadir un estado que ya está o quitar uno que no está no cambia nada (sin error). Los estados se guardan en el orden de `CONDITION_NAMES`.
- `lib/rules/dnd2024/sheet/conditions.ts`: `CONDITION_RULES: Record<string, string>` con un resumen propio en español de cada estado de las reglas 2024 (cegado, hechizado, ensordecido, asustado, agarrado, incapacitado, invisible, paralizado, petrificado, envenenado, derribado, apresado, aturdido, inconsciente) y `exhaustionEffect(level): string` («Nivel N: −2N a las pruebas de d20 y −1,5N m de velocidad»; nivel 6: «Muerte»). Iconos: `iconSrc("condition", key)` y `iconSrc("condition", "exhaustion")`.
- Descanso largo (`applyRest`, `lib/rules/dnd2024/sheet/rest.ts`): además de lo de hoy, `exhaustion = max(0, exhaustion − 1)`; no toca inspiración ni estados.
- Ruta `PATCH /api/characters/[id]/status` (`lib/server/characters/sheetEdits.ts`: `applyStatusOperation(userId, id, body)`): solo el dueño (`loadCharacterFor(..., "write")`), `rateLimit("sheet_status", session.id, 300, 3600)`, una actualización con `unchangedFilter` sobre `heroicInspiration`, `conditions`, `exhaustion`; responde `{ ok: true, status: { heroicInspiration, conditions, exhaustion } }`.

## 3. Interfaz

### 3.1 Franja superior (`AbilityStrip`)
De izquierda a derecha, en una fila en escritorio (se reparte en filas en tablet/móvil):
- **Características** (6): etiqueta arriba en mayúsculas pequeñas, modificador grande en el centro, puntuación en una píldora que pisa el borde inferior. Siguen abriendo su desglose.
- **Competencia** («Bonificador») y **Velocidad** («a pie»), cajas del mismo alto.
- **Inspiración heroica** (nueva): caja con una casilla grande; el dueño la marca/desmarca (`aria-pressed`, «Inspiración heroica»); los demás la ven en solo lectura.
- **Puntos de golpe**: a la izquierda, columna «Curar» (botón) · campo de cantidad · «Daño» (botón); a la derecha «Actuales / Máximos» grandes y «Temporales» (editable como hoy). Misma lógica que el editor actual (el daño quita primero los temporales). Debajo, «Dados de golpe: …» como hoy.

### 3.2 Columnas
- **Tiradas de salvación**: rejilla 2×3 (FUE·INT, DES·SAB, CON·CAR): abreviatura, punto de competencia y bonificador; cada una abre su desglose.
- **Habilidades**: cabecera de columnas «COMP · MOD · HABILIDAD · BONIF.».
- **Sentidos** y **Competencias y entrenamiento**: solo el estilo común.
- **Sobre las pestañas** (columna derecha): **Iniciativa** (caja), **CA** (caja con forma de escudo, `clip-path`), y **Defensas y estados** (caja nueva que sustituye a la de Defensas):
  - Defensas: como hoy (si no hay, «Sin defensas»).
  - Estados: los activos con su icono y nombre (cada uno abre un diálogo con `CONDITION_RULES`); el agotamiento con su icono, «Agotamiento N» y su efecto. Dueño: botón «Gestionar estados» que abre un diálogo con una casilla por estado y un selector de agotamiento 0–6; cada cambio se guarda al momento. Sin estados: «Sin estados» (y el botón para el dueño).

### 3.3 Estilo
- Marcos de las cajas con el rojo de marca atenuado (como los contornos de la captura) sobre el fondo oscuro de Roll2Go; títulos de caja en mayúsculas pequeñas abajo o arriba según la captura, con la tipografía de Roll2Go.
- Impresión: sin botones de gestión; estados e inspiración en texto.
- 375 px: cajas apiladas o en rejilla de 2, sin desplazamiento horizontal.

## 4. Pruebas

- vitest `applyStatus` (inspiración, añadir/quitar estado, estado desconocido, agotamiento 0–6 y fuera de rango, orden), `applyRest` largo baja el agotamiento en 1 (y no baja de 0), `exhaustionEffect`, servicio `applyStatusOperation` (dueño guarda; otro usuario falla).
- En verde: vitest, `tsc`, `eslint`; `next build` al final.
- Navegador: «Elara Prueba» en solo lectura (disposición en escritorio, tablet y 375 px); personaje de prueba propio: inspiración, añadir/quitar estados, agotamiento y descanso largo, curar/daño; borrado al terminar.
