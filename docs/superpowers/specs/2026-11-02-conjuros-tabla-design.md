# Conjuros: tabla, búsqueda y filtros — diseño

Fecha: 2026-11-02. Tercera de las cuatro fases que siguen al rework de la estructura de la ficha: 1) descanso corto (hecha), 2) Acciones (hecha), 3) **Conjuros**, 4) Rasgos, Trasfondo y retoque visual.

## 1. Objetivo

La pestaña Conjuros pasa a mostrar, como en D&D Beyond, una **tabla por niveles** con los conjuros que el personaje puede lanzar, con **búsqueda** (nombre, tipo de daño, estados que aplica, tiempo de lanzamiento), **filtros** (truco/conjuro, nivel, concentración, ritual), los espacios de cada nivel en su cabecera y un botón **Lanzar** que gasta un espacio. La gestión actual (preparar, libro, disponibles) se conserva detrás de un botón. Identidad visual de Roll2Go; iconos `dark/schools` y `dark/damage-types`.

Éxito: una maga encuentra «fuego», «asustado» o «reacción» en la búsqueda; filtra por concentración o ritual; lanza Proyectil mágico y ve el espacio gastado; si no le quedan de nivel 1, lo lanza con uno de nivel 2; lanza Detectar magia como ritual sin gastar nada.

Fuera de alcance: dados de daño y efectos a nivel superior (el catálogo no los guarda), un historial de lanzamientos, concentración activa como estado (fase 4/5), cambiar la vista de gestión.

No hace falta reimportar: se usan `SpellData.time`, `concentration`, `ritual`, `school`, `range`, `duration`, `components` y `tags`.

## 2. Datos y reglas (puros)

### 2.1 Filas — `lib/rules/dnd2024/spells/spellTable.ts`

`spellTableRows(spells: SpellsSummary, entries: Map<string, CatalogEntry>): SpellRow[]` con

```ts
type SpellRow = {
  ref: Ref; key: string; name: string; nameEn: string; level: number; school: string;
  time: string; timeShort: string; range: string; duration: string; components: string;
  concentration: boolean; ritual: boolean;
  hit: string | null;            // «+N» o «CD N {Car}», como en Acciones
  effect: { damageTypeId: string | null; label: string } | null;  // primer «Daño de …», si no primer «Estado: …», si no la primera etiqueta de MISC
  origin: string;                // «Mago», «Especie: Tiefling», «Dote: …»
  limited: { key: string; max: number; used: number } | null;      // Arcano místico, distintivos, de especie
  casterClass: Ref | null;       // bloque que lo lanza (para el espacio y la CD)
  tags: string[];
};
```

- Los mismos conjuros «utilizables» que Acciones (trucos, preparados, siempre preparados, `other`, limitados). Reutiliza lo que ya calcula `deriveActions` donde se pueda (extraer las funciones comunes de `derive/actions.ts` a este módulo o a uno compartido, sin duplicar).
- `timeShort`: «1 acción» → «1A», «1 acción adicional» → «1AA», «1 reacción…» → «1R», «N minutos» → «N min», «N horas» → «N h», otro → el texto tal cual.

### 2.2 Búsqueda y filtros — `lib/rules/dnd2024/spells/spellTableFilter.ts`

```ts
type Tri = "any" | "yes" | "no";
type SpellTableFilter = { q: string; kind: "all" | "cantrips" | "spells"; levels: number[]; concentration: Tri; ritual: Tri };
```

- `matchesSpellTable(row, f)`: `q` normalizado (sin tildes ni mayúsculas, `normalizeName`) busca en `name`, `nameEn`, `time`, y las etiquetas (`Daño de fuego` → encuentra «fuego»; `Estado: Asustado` → «asustado»); `kind`, `levels` (vacío = todos), `concentration`, `ritual`.
- `parseSpellTableFilter(query)` y `spellTableHref(query, patch)` para la URL: `?q=&tipo=trucos|conjuros&nivel=1,2&conc=si|no&ritual=si|no`; valores desconocidos → por defecto. Mantiene `tab` y quita `spell` y `saved`, como los chips de Acciones.
- `groupByLevel(rows)`: `[{ level: 0, rows }, { level: 1, rows }…]`, solo niveles con filas, ordenados por nivel y nombre.

### 2.3 Lanzar — `castOptions(row, slots, used): CastOption[]`

```ts
type CastOption = { kind: "slot"; level: string /* "1".."9" | "pact" */; label: string } | { kind: "ritual"; label: string };
```

- Trucos o `limited` → `[]` (sin botón Lanzar; los limitados conservan sus casillas de usos).
- Espacios normales libres de nivel ≥ `row.level` (en orden), etiquetados «Nivel N»; espacio de pacto si `pact.level ≥ row.level` y quedan («Magia de pacto (nivel N)»).
- `row.ritual` → además `{ kind: "ritual", label: "Lanzar como ritual" }` al final (no gasta nada).
- El primero de la lista es la opción por defecto del botón; si hay más de una, el botón abre un menú.
- Gastar = la operación existente `{ op: "slot", level, used: used[level] + 1 }` de la ruta de conjuros; el ritual no llama al servidor (solo un aviso «Lanzado como ritual»).

## 3. Interfaz

### 3.1 Pestaña Conjuros

1. **Cabecera**: por bloque lanzador, «{Clase}: Modificador +N · Ataque +N · CD N» (si hay uno solo, sin el nombre de la clase). Botón **«Gestionar conjuros»** a la derecha (solo dueño; los demás ven «Ver lista»).
2. **Búsqueda y filtros**: campo «Buscar por nombre, daño, estado o tiempo» (con espera de 300 ms antes de cambiar la URL); chips «Todo · Trucos · Conjuros»; chips de nivel (solo los niveles con filas); dos selectores de tres estados «Concentración: cualquiera / sí / no» y «Ritual: cualquiera / sí / no».
3. **Tabla** agrupada por nivel. Cabecera de cada grupo: «Trucos» o «Nivel N» y, para niveles con espacios, las casillas de espacios (la lógica actual de `SlotsBar`, partida por nivel; el pacto, en su nivel con la etiqueta «Pacto»). Columnas: Lanzar · Nombre (icono de escuela `darkSchool`, C/R si aplica, origen debajo) · Tiempo (`timeShort`, con el tiempo completo como `title`) · Alcance · Golpe/CD · Efecto (icono de tipo de daño + texto) · Notas (duración y componentes).
4. Sin resultados: «Ningún conjuro coincide con la búsqueda.» y un enlace «Quitar filtros».
5. Móvil: la tabla se desplaza dentro de su caja; los filtros se apilan.

### 3.2 Gestionar conjuros

- El botón cambia la pestaña a la vista actual (`CasterBlockView` por clase, con Preparados / Mi libro / Disponibles / Todos, sin cambios) mediante `?vista=gestionar`; un botón «Volver a la tabla» regresa.

### 3.3 Accesibilidad e impresión

- Las casillas de espacios llevan `aria-label` «Espacio de nivel N, gastado/libre». El menú de Lanzar es un `menu` con foco y Escape.
- Al imprimir: tabla completa sin filtros (como Acciones), sin botones.

## 4. Pruebas

- vitest `spellTableRows` (utilizables, origen, `hit`, `effect`, `limited`, `timeShort`), `matchesSpellTable` (nombre es/en, «fuego», «asustado», «reacción», concentración y ritual sí/no), `parseSpellTableFilter`/`spellTableHref`, `groupByLevel`, `castOptions` (su nivel, superior al agotarse, pacto, ritual, truco y limitado sin opciones).
- En verde: vitest, `tsc`, `eslint`; `next build` al final.
- Navegador: la maga «Elara Prueba» en solo lectura (búsquedas y filtros); lanzar con un personaje de prueba propio (borrado al terminar): espacio gastado, nivel superior, ritual; 375 px sin desbordes.
