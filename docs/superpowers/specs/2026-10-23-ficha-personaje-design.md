# Ficha de personaje D&D 2024 — Diseño (parte 3)

Fecha: 2026-10-23 · Estado: pendiente de revisión
Depende de: `2026-10-22-creador-personajes-design.md` (partes 1 y 2, implementadas en la rama `feat/creador-personajes`).
Siguientes: `2026-10-23-subir-nivel-design.md` (parte 4) y `2026-10-23-conjuros-design.md` (parte 5).

## 1. Objetivo

Sustituir el resumen de solo lectura de `/characters/[id]` por una **ficha completa con pestañas**, editable por su dueño, con **inventario real** (objetos que se equipan y cambian la CA y los ataques) y preparada para el historial de niveles (parte 4) y los conjuros (parte 5).

### Decisiones tomadas con el usuario

| Tema | Decisión |
|---|---|
| Alcance de esta tanda | Ficha + subir de nivel + conjuros en tres especificaciones encadenadas. Compañeros y Acciones quedan fuera. |
| Progresión | Historial de niveles (`sheet.levels[]`) con elecciones guiadas por datos (parte 4). La ficha se calcula recorriéndolo. |
| Equipo | Inventario real: equipo inicial volcado, añadir/quitar, equipar armadura/escudo/armas, monedas, peso y «otras posesiones». |
| Permisos | Solo el dueño edita. El DM y el resto de la campaña ven la ficha en modo lectura. |
| Estilo | Tema oscuro de Roll2Go (no el claro de Nivel20); misma estructura que las capturas de Nivel20. |

### Fuera de alcance

Compañeros, Acciones, objetos mágicos y sintonización (llegarán con `XDMG`), penalizaciones por armadura sin competencia, duplicar/compartir/cambiar de campaña, exportar a Foundry (parte 6).

## 2. Modelo de datos (`sheet.version: 2`)

La parte 4 introduce `levels[]`; esta parte introduce `inventory`. Ambos llegan con la misma migración (`sheet.version` 1 → 2, ver parte 4 §5).

```ts
type InventoryItem = {
  id: string;               // id propio de la línea (ObjectId en texto)
  ref: Ref | null;          // objeto del catálogo, o null si es personalizado
  name: string;             // copia del nombre o nombre libre (máx. 80)
  quantity: number;         // entero 0–9999
  equipped: boolean;        // solo para armaduras, escudos y armas
  notes: string;            // máx. 500
};

sheet.inventory = {
  items: InventoryItem[],   // máx. 300 líneas
  coins: { cp: number; sp: number; ep: number; gp: number; pp: number }, // enteros 0–9 999 999
  other: string,            // «Otras posesiones», texto libre (máx. 5000)
}
sheet.hp = { max: null, current: number | null, temp: number } // max sigue calculándose; current/temp editables
```

**Volcado del equipo inicial.** Al crear el personaje (y al migrar los existentes), las opciones elegidas de clase y trasfondo se convierten en líneas del inventario:
- los paquetes (`item.contents`) se despliegan en sus objetos;
- las cantidades de un mismo objeto se suman;
- el valor en monedas (`Pack.value`, en pc) va a `coins.gp` (y el resto en pp/pc si no es divisible);
- se marca `equipped` en la mejor armadura (mayor CA base), el primer escudo y todas las armas.

Las elecciones originales (`background.equipment`, `levels[0]…`) se conservan para el exportador a Foundry.

## 3. Página `/characters/[id]`

### 3.1 Acceso
- Ver: dueño o miembros de la campaña del personaje; el resto, 404 (como ahora).
- Editar (cualquier ruta de escritura de esta parte): solo el dueño; el resto, 404.

### 3.2 Cabecera
- Retrato con el **icono de estado** superpuesto (color por estado). Al pasar el ratón o enfocarlo: «En activo: …», «Puedes cambiar el estado desde Editar» (solo para el dueño).
- Nombre; «Especie (Legado) Clase N / Clase M»; campaña con enlace; «Nivel T» (total).
- Botones (solo dueño): **Subir de nivel** (parte 4; oculto a nivel 20), **Editar**, **Imprimir** (`window.print()` con una hoja `@media print` que muestra todas las pestañas seguidas, sin navegación).
- Aviso de una línea tras volver de una acción («Nivel guardado correctamente», «Cambios guardados»), descartable.

### 3.3 Pestañas
Pestañas como `CampaignTabs`, la activa en `?tab=` (`info`, `trasfondo`, `rasgos`, `equipo`, `conjuros`; por defecto `info`). En móvil se desplazan en horizontal.

**Información**
- 6 características: modificador grande y puntuación debajo.
- Fila de valores: **PG** (máximo calculado; actuales y temporales editables por el dueño con −/+ y campo), **Iniciativa**, **Velocidad** (pies y metros: `30 pies (9 m)`), **CA**, **Competencia**.
- **Tiradas de salvación**: las 6, con marca de competencia y total.
- **Habilidades**: las 18 con su característica abreviada, marca (vacía / competencia / pericia) y total. Ordenadas por nombre en español.
- **Ataques** (§4.2).
- **Otras competencias**: armaduras, armas, herramientas e idiomas en español.

**Trasfondo**
- Alineamiento (con su descripción), edad, apariencia, idiomas, historia (BBCode), notas.
- Trasfondo con su descripción, dote de origen y competencias.
- Imagen del personaje a la derecha (en móvil, arriba).

**Rasgos**
- Bloque de especie y legado: nombre, descripción y rasgos.
- Un bloque por clase: icono, nombre, nivel en la clase, subclase, y sus rasgos agrupados por nivel (solo hasta su nivel actual). En multiclase, un bloque por clase.
- Dotes: dote de origen, dotes de nivel, estilos de combate, dones épicos.
- Cada rasgo: nombre en español (o original), descripción en BBCode, plegable (abierto por defecto el primero de cada bloque). Los rasgos que dependen de la tabla de clase muestran su valor actual («2 usos, +2 daño» de Furia) a partir de `classTableGroups`.

**Equipo** (§4.1).

**Conjuros** (parte 5). La pestaña solo aparece si alguna clase, subclase, especie, legado o dote da conjuros.

### 3.4 Edición
- **Ediciones rápidas** (se guardan al momento, con actualización optimista y vuelta atrás si falla):
  - `PATCH /api/characters/[id]/hp` `{ current, temp }` (0–9999; `current` ≤ máximo calculado);
  - inventario (§4.1);
  - conjuros (parte 5).
- **`/characters/[id]/edit`**: nombre, estado, retrato, imagen, alineamiento, edad, apariencia, idiomas, historia, notas y PX. Reutiliza los campos del creador. `PATCH /api/characters/[id]` con las mismas validaciones que el alta. Especie, legado, clase, trasfondo y características no se editan aquí (ver parte 4 §4 «Rehacer creación»).
- **Borrar personaje**: en `/edit`, con confirmación escribiendo el nombre (como `DeleteCampaign`). `DELETE /api/characters/[id]` borra el personaje y sus imágenes.

## 4. Inventario y ataques

### 4.1 Pestaña Equipo
- **Inventario**: tabla con nombre (enlace a la ficha del objeto del catálogo si tiene `ref`), cantidad, peso unitario y total, casilla «Equipado» (solo armaduras, escudos y armas), notas y quitar.
- **Añadir**: botón que abre un buscador del catálogo (`RuleSelect` sobre `kind=item` de los libros usables del personaje, búsqueda remota) o «Objeto personalizado» (nombre, cantidad, notas).
- **Equipar**:
  - una sola armadura (ligera/intermedia/pesada) y un solo escudo: al equipar otro, el anterior se desequipa;
  - armas: sin límite;
  - si el personaje no tiene competencia con la armadura o el escudo equipado, aviso «Sin competencia con esta armadura» (sin aplicar penalizaciones).
- **Monedas**: pc, pp, pe, po, ppt editables y total equivalente en po.
- **Peso**: total frente a la capacidad (FUE × 15 lb, ×2 si la especie es Grande); aviso si se supera. Peso en libras y kilos.
- **Otras posesiones**: texto libre editable.
- **API** — `PATCH /api/characters/[id]/inventory` con una operación por petición:
  `{ op: "add", ref | name, quantity }`, `{ op: "update", id, quantity?, notes?, equipped? }`, `{ op: "remove", id }`, `{ op: "coins", coins }`, `{ op: "other", text }`.
  El servidor: comprueba dueño, `rateLimit("character_edit", userId, 300, 3600)`, `ref` dentro de `usableBooks` del personaje (tipo `item`), límites de §2, y aplica la regla de una armadura / un escudo. Devuelve el inventario completo.

### 4.2 Ataques (pestaña Información)
Una fila por arma equipada, más **Ataque sin armas** siempre:
- **Bonificador**: característica (FUE cuerpo a cuerpo; DES a distancia; la mejor de ambas si el arma es *sutil*) + competencia si el personaje la tiene con la categoría del arma (sencilla/marcial) o con esa arma.
- **Daño**: dados del arma + mod. de la característica + tipo de daño en español. *Versátil*: se muestran ambos dados («1d8 / 1d10 (dos manos)»).
- **Etiquetas**: propiedades del arma en español y **maestría** si el personaje la tiene en esa arma (elección `weaponMastery`, parte 4).
- **Sin armas**: 1 + mod. FUE contundente, con competencia. Monje: dado de Artes marciales de su nivel (tabla de clase) y FUE o DES, la mejor.
- Sin bonificadores mágicos.

### 4.3 CA
Primera regla que aplique:
1. Armadura equipada: CA base + DES limitado por `dexCap` (`null` sin límite, `0` sin DES).
2. Defensa sin armadura de una clase del personaje (Bárbaro 10 + DES + CON; Monje 10 + DES + SAB, no con escudo). Si tiene ambas, la mayor.
3. 10 + DES.
+2 si hay escudo equipado (salvo el caso del Monje, que entonces usa la regla 3).

## 5. Cálculo (`derive` v2)

`derive(sheet, entries)` pasa a recorrer `levels[]` y `inventory`:
- Nivel total = número de entradas; nivel por clase = entradas de esa clase.
- Competencia por nivel total.
- PG máx. = PG de cada entrada (`hp.value`) + CON × nivel total + bonificaciones (Dureza enana +1/nivel, Duro +2/nivel).
- Características: base + trasfondo + mejoras (`asi`) de las entradas, tope 20 (salvo dones épicos, tope 30).
- Habilidades: competencias de especie, trasfondo, clase inicial, multiclase y elecciones `skills`; pericia de las elecciones `expertise`.
- Iniciativa: DES + competencia con Alerta.
- CA, ataques, peso y capacidad según §4.
- Rasgos por clase y nivel con sus valores de tabla.
- `missing`: igual que ahora (referencias no disponibles con su nombre guardado).

Sigue siendo una función pura sin Next. Las entradas del catálogo que necesita la página se cargan en el servidor con `resolveRef` en lote.

## 6. Pruebas

- Unitarias (`vitest`):
  - volcado del equipo inicial (Bárbaro A + Acólito A → inventario esperado, 23 po; Guerrero C → solo monedas);
  - reglas de equipar (segunda armadura desequipa la primera; escudo único);
  - CA con cota de malla, cuero tachonado + DES 4 (tope ninguno), intermedia con DES 4 (tope 2), escudo, Monje con escudo;
  - ataques: hacha a dos manos FUE 17, estoque sutil con DES > FUE, arco con DES, versátil, sin armas del Monje;
  - peso y capacidad;
  - `PATCH inventory`: cada operación, `ref` fuera de libros usables, no dueño (404), límites.
- Navegador: ficha de un personaje de cada clase de prueba; editar PG; añadir/equipar/quitar objetos y ver la CA y los ataques cambiar; vista del DM sin controles; impresión; móvil.

## 7. Riesgos

- `derive` crece mucho: separar en módulos (`derive/abilities.ts`, `derive/ac.ts`, `derive/attacks.ts`, `derive/hp.ts`) manteniendo `derive()` como única entrada.
- La página carga muchas entradas del catálogo (rasgos de todos los niveles, objetos): cargar en lote por `Ref` y cachear por libro.
