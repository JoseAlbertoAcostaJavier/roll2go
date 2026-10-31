# Rework de la ficha, fase 1: estructura — diseño

Fecha: 2026-10-31.

## 1. Objetivo

La ficha de personaje D&D 2024 pasa de una pestaña «Información» con todo dentro a una estructura inspirada en la **disposición** de la ficha de D&D Beyond: franja superior con características y puntos de golpe, columnas fijas con salvaciones, sentidos, competencias, habilidades, combate y defensas, y un panel de pestañas a la derecha. Se mantiene el **tema oscuro**, la tipografía, los colores y la marca de Roll2Go: solo se toma la organización, no el aspecto ni ningún recurso de D&D Beyond.

El rework va por fases, cada una con su especificación, plan y rama:

1. **Estructura** (este documento).
2. Pestaña Acciones (filtros por tipo de acción, acciones de combate con sus iconos y su ficha).
3. Pestaña Conjuros (tabla por niveles, icono de escuela y de tipo de daño).
4. Inventario, Rasgos y dotes, Trasfondo y Notas (aspecto nuevo y campos nuevos de trasfondo y notas).
5. Estados (con iconos y agotamiento) e inspiración heroica.

Éxito de la fase 1: la ficha muestra la estructura nueva en escritorio, tablet y móvil sin desplazamiento horizontal; todo lo que hoy se ve y se puede hacer en la ficha sigue disponible; los enlaces antiguos a pestañas siguen funcionando; la cabecera tiene descanso corto y largo; los ataques muestran alcance y los iconos de tipo de daño y de arma.

Fuera de alcance: todo lo de las fases 2 a 5, la sección Extras de D&D Beyond, cambios en el creador y en subir de nivel.

## 2. Iconos nuevos

- La carpeta `public/assets/icons/Dark Mode/` (sin versionar, aportada por el usuario) se mueve a `public/assets/icons/dark/` con nombres en minúsculas y guiones, sin espacios:
  - `dark/actions/<acción>.svg` (p. ej. `attack.svg`, `cast-spell.svg`, `opportunity-attack.svg`, `quick-interaction.svg`, `offhand-attack.svg`: se corrigen las erratas «Interation» y «Offfhand»).
  - `dark/conditions/<estado>.svg` (`blinded.svg`… `unconscious.svg`, `exhaustion.svg`, `falling.svg`, `flying.svg`).
  - `dark/damage-types/<tipo>.svg` con la clave inglesa de 5etools (`acid.svg` … `thunder.svg`).
  - `dark/environment/<efecto>.svg` (`bright-light.svg`, `darkness.svg`; se corrige «Enviroment»).
  - `dark/schools/<escuela>.svg` (`abjuration.svg` … `transmutation.svg`).
  - `dark/weapon-types/melee.svg` y `dark/weapon-types/ranged.svg`.
- `lib/utils/icons.ts`: `iconSrc` gana los tipos `damageType`, `weaponType`, `darkSchool`, `action`, `condition`, `environment`. `damageType` y `condition` reciben la clave inglesa en minúsculas; `darkSchool` la letra de 5etools (`V` → `evocation`), como `school`.
- Los iconos son SVG blancos: se pintan como máscara con `currentColor` (como `StatusIcon`), con un componente `MaskIcon({ src, className, label? })` en `app/components/ui/`. Sin `label`, `aria-hidden`.
- En la fase 1 solo se usan `damageType` y `weaponType` (§5). Los demás quedan disponibles para las fases siguientes.

## 3. Cabecera

- Igual que hoy (retrato, nombre, especie, clase y nivel, estado, acciones de editar, subir nivel, imprimir, campaña), más dos botones **Descanso corto** y **Descanso largo**, solo para el dueño.
- Cada botón pide confirmación con un diálogo («¿Hacer un descanso largo? Recuperas todos los puntos de golpe y los espacios de conjuro.» / «¿Hacer un descanso corto? Recuperas los espacios y usos que se recuperan con un descanso corto.»).
- **Descanso largo** (`op: "longRest"` en la ruta de conjuros, que ya existe): además de vaciar `slotsUsed` y `limitedUsed`, deja `hp.current = null` (puntos de golpe al máximo) y `hp.temp = 0`. `lib/server/characters/sheetEdits.ts` añade `hp` a los campos que escribe `longRest`.
- **Descanso corto**: el `op: "shortRest"` actual, sin cambios.
- Los botones de descanso que hoy hay en la pestaña Conjuros (`SlotsBar`) se quitan: la cabecera los sustituye.
- Si el personaje no tiene nada que recuperar con un descanso corto, el botón sigue visible (en D&D 2024 también se gastan dados de golpe, que llegarán en otra fase) y el diálogo lo dice: «No tienes nada que se recupere con un descanso corto.», con solo «Cerrar».

## 4. Estructura de la página

### 4.1 Franja superior

- Las 6 características: nombre corto en mayúsculas («FUERZA»…), modificador grande y la puntuación en una píldora debajo. Botón que abre su desglose (`StatDialog`), como hoy.
- **Competencia** (+N), **Velocidad** (N metros/pies con la unidad que ya usa la ficha) y la caja de **Puntos de golpe** (actuales / máximos / temporales) con curar y dañar: el `HpEditor` actual, maquetado en horizontal.

### 4.2 Columnas (escritorio, ≥ 1280 px)

Rejilla de tres columnas:

| Izquierda | Centro | Derecha |
| --- | --- | --- |
| Tiradas de salvación (con las notas de ventaja que ya calcula la ficha) | Habilidades | Iniciativa y CA (botones con desglose), y la caja **Defensas** de la iteración anterior |
| Sentidos: Percepción, Investigación y Perspicacia pasivas (10 + bonificador), y visión en la oscuridad | | Panel de pestañas (§4.3) |
| Competencias y entrenamiento: armaduras, armas, herramientas e idiomas | | |

- Habilidades: una fila por habilidad con la marca de competencia o pericia, la abreviatura de la característica, el nombre y el bonificador; cada fila abre su desglose.
- Cada bloque es una caja con borde y título en el pie o en la cabecera, con los estilos de tarjeta existentes (`card`, `cardTitle`).

### 4.3 Panel de pestañas

| Pestaña | Contenido en la fase 1 | `?tab=` |
| --- | --- | --- |
| Acciones | la tabla de ataques (§5) | `acciones` |
| Conjuros | `SpellsTab` actual (solo si `d.hasSpells`) | `conjuros` |
| Inventario | `EquipmentTab` actual (con `MasteriesEditor`) | `inventario` |
| Rasgos y dotes | `FeaturesTab` actual | `rasgos` |
| Trasfondo | `BackgroundTab` actual | `trasfondo` |

- Pestaña por defecto: Acciones.
- Compatibilidad: `?tab=info` → Acciones; `?tab=equipo` → Inventario. Una función pura `normalizeSheetTab(raw: unknown, tabs: SheetTab[]): SheetTab` lo resuelve.
- Las pestañas siguen siendo enlaces con `?tab=`, como hoy (`SheetTabs`).

### 4.4 Tablet y móvil

- 768–1279 px: dos columnas (izquierda: salvaciones, sentidos y competencias; derecha: habilidades); combate y defensas encima de ellas a todo el ancho; el panel de pestañas a todo el ancho debajo.
- < 768 px: una columna en este orden: franja superior (características en rejilla de 3, luego competencia, velocidad y PG), combate y defensas, salvaciones, habilidades, sentidos, competencias, pestañas.
- Sin desplazamiento horizontal de página; la tabla de ataques puede desplazarse dentro de su caja.

### 4.5 Componentes

`InfoTab.tsx` desaparece y se reparte en componentes de `app/components/characters/sheet/`:

- `AbilityStrip` (características, competencia, velocidad, PG),
- `SavesBox`, `SensesBox`, `ProficienciesBox`, `SkillsBox`, `CombatBox` (iniciativa, CA), `DefensesBox`,
- `SheetLayout` (la rejilla y el orden en móvil),
- `ActionsTab` (§5),
- `RestButtons` (descansos de la cabecera).

El estado del diálogo de desglose (qué valor está abierto y su botón de origen) se comparte con un pequeño hook `useStatDialog()` para no duplicarlo en cada caja. Los datos siguen llegando como hoy (`InfoData` desde la página), renombrado a `SheetData` si deja de ser solo «info».

## 5. Pestaña Acciones (fase 1)

- Tabla de ataques: **Ataque** (icono cuerpo a cuerpo o a distancia + nombre + maestría si la tiene), **Alcance**, **Golpe** (+N), **Daño** (dados + icono del tipo de daño con su nombre como texto accesible) y **Notas** (propiedades).
- `Attack` (`lib/rules/dnd2024/derive/attacks.ts`) gana:
  - `kind: "melee" | "ranged"` — del tipo de objeto de 5etools (`R` → a distancia; el resto, cuerpo a cuerpo; el ataque sin armas, cuerpo a cuerpo);
  - `range: string` — cuerpo a cuerpo: «1,5 m» (o «3 m» con la propiedad Alcance); a distancia o arrojadiza: el alcance normal/largo de 5etools convertido a la unidad de la ficha («6/18 m»); el arrojadizo cuerpo a cuerpo muestra los dos («1,5 m · 6/18 m»);
  - `damageTypeId: string` — la clave inglesa (`"slashing"`), además del `damageType` en español que ya tiene.
- Para el alcance a distancia, `ItemData.weapon` gana `range?: string` («20/60», tal cual en 5etools) en `normalizeItem`. Hace falta **reimportar los libros** (README, «Despliegue»).
- Debajo de la tabla, de momento nada más: las acciones de combate, los filtros y los usos limitados son la fase 2.

## 6. Pruebas

- vitest: `normalizeSheetTab` (info → acciones, equipo → inventario, desconocida o no disponible → acciones, conjuros sin `hasSpells` → acciones).
- vitest: `iconSrc` de los tipos nuevos y que los archivos existen (como `tests/icons.test.ts`).
- vitest: `Attack.kind`, `range` y `damageTypeId` (espada larga, arco largo, daga arrojadiza, alabarda con alcance, ataque sin armas); `normalizeItem` guarda `weapon.range`.
- vitest: `longRest` deja `hp.current` en null y `hp.temp` en 0, además de lo que ya hacía.
- En verde en cada commit: vitest, `tsc`, `eslint app lib tests scripts`; `next build` al final.
- Navegador: un personaje de prueba propio (borrado al terminar) en escritorio (1440 px), tablet (768 px) y móvil (375 px): estructura, desgloses, curar/dañar, descansos, pestañas y enlaces antiguos `?tab=info` y `?tab=equipo`, impresión (vista previa) sin botones perdidos.
