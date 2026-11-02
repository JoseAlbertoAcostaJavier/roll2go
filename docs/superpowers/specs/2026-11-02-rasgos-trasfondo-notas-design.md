# Rasgos, Trasfondo y Notas — diseño

Fecha: 2026-11-02. Segunda de las tres piezas que cierran el rework de la ficha: 1) reglas de conjuros (hecha), 2) **Rasgos, Trasfondo y Notas**, 3) fidelidad visual de la vista general a «Mejora UI». El Inventario queda para una fase propia.

## 1. Objetivo

Las pestañas Rasgos y dotes y Trasfondo siguen la **estructura** de las capturas de D&D Beyond (filtros arriba, secciones con título de color, campos en rejilla), y se añade una pestaña **Notas**. Los campos de trasfondo y notas se editan **en la propia pestaña** (solo el dueño). Colores, tipografía e iconos son los de Roll2Go.

Éxito: un jugador filtra sus rasgos por clase, especie o dotes y lee cada uno sin desplegar; en Trasfondo rellena género, ojos, rasgos de personalidad, ideales… pulsando «+ Añadir …» sin salir de la ficha; en Notas apunta aliados y enemigos; otro miembro de la campaña lo ve todo en solo lectura.

Fuera de alcance: Inventario, la vista general (pieza 3), traducir descripciones de 5etools, editar la historia (BBCode) en la pestaña (sigue en «Editar»).

## 2. Datos

- `Dnd2024SheetV2` gana campos de texto **opcionales** (las hojas antiguas los leen como vacíos; no hace falta migración ni `upgradeSheet`):
  - Características: `gender`, `eyes`, `hair`, `skin`, `height`, `weight`, `faith` (máx. 100 cada uno).
  - Personalidad: `personality`, `ideals`, `bonds`, `flaws` (máx. 2000 cada uno).
  - Notas: `organizations`, `allies`, `enemies` (máx. 5000 cada uno). Las notas actuales (`notes`, máx. 10000) son «Otras notas».
- `TEXT_LIMITS` (`lib/rules/dnd2024/creation/validateSheet.ts`) separa los límites del creador de los de la ficha: los campos nuevos van en un `SHEET_TEXT_LIMITS` que incluye los de `TEXT_LIMITS`, para que el creador no los pida.
- Guardado: la ruta de edición existente `PATCH /api/characters/[id]` (`lib/server/characters/editCharacter.ts`) acepta los campos nuevos con el mismo tratamiento (texto, `cleanText`, `trim`, límite → «Máximo N caracteres.»). Un campo por petición desde la ficha; solo el dueño, como hoy.

## 3. Rasgos y dotes

- Filtros (chips, como Acciones): **Todo · Rasgos de clase · Rasgos de especie · Dotes**, en la URL `?tab=rasgos&seccion=todo|clase|especie|dotes`; desconocido → `todo`. Los chips quitan `saved`.
- Secciones, en este orden y solo si tienen algo, con título de color (`text-brand-soft`, mayúsculas):
  - **Rasgos de clase**: un subtítulo por grupo `class`, `subclass` y `option` («Rasgos de Mago», «Escuela de evocación», «Invocaciones sobrenaturales»), con su icono actual.
  - **Rasgos de especie**: grupos `species` y `lineage`, con la descripción de la especie/legado como hoy.
  - **Dotes**: grupos `feat`.
- Cada rasgo: nombre en negrita, `· Nivel N`, el valor (`value`) y las opciones elegidas (`chosen`) como hoy; la descripción **abierta**. Si pasa de ~8 líneas se recorta con un degradado y un botón «Ver más» / «Ver menos» (`aria-expanded`). La descripción plegada de clase y subclase («Descripción») se mantiene.
- Impresión: todas las secciones y descripciones completas, sin chips ni botones.
- La función pura `featureSections(groups: FeatureGroup[], seccion): { id; title; groups }[]` (en `lib/rules/dnd2024/sheet/`) agrupa y filtra; `parseFeatureSection(query)` lee la URL.

## 4. Trasfondo

- Filtros: **Todo · Trasfondo · Características · Aspecto** (`?tab=trasfondo&seccion=todo|trasfondo|caracteristicas|aspecto`).
- **Trasfondo**: lo de hoy (nombre, descripción, mejoras de característica, dote de origen, habilidades, herramientas).
- **Características**:
  - Rejilla (5 columnas en escritorio, 2 en móvil): Alineamiento (selector con `ALIGNMENTS`), Género, Ojos, Tamaño (de `speciesChoices.size` o la especie, solo lectura: «Mediano»…), Altura, Fe, Pelo, Piel, Edad, Peso.
  - Debajo: Rasgos de personalidad, Ideales, Vínculos, Defectos (texto largo).
- **Aspecto**: Apariencia (texto largo, `appearance`), la imagen del personaje y la Historia (BBCode, solo lectura; se edita en «Editar»). Puntos de experiencia e Idiomas salen de esta pestaña (los idiomas ya están en Competencias; la experiencia sigue en «Editar»).

## 5. Notas (pestaña nueva)

- `?tab=notas`, después de Trasfondo. Secciones: **Organizaciones**, **Aliados**, **Enemigos**, **Otras notas** (`notes`). Siempre visible (también vacía para el dueño, con sus «+ Añadir …»); para los demás, solo si alguna tiene texto.

## 6. Edición en la pestaña

- Componente `InlineText({ label, field, value, multiline?, max, characterId, editable })` (y `InlineSelect` para el alineamiento):
  - Dueño: con valor, el texto es un botón que abre la edición; vacío, «+ Añadir {label en minúsculas}». En edición, `input` o `textarea` con foco; guarda al salir del campo o con Enter (en `textarea`, Ctrl+Enter); Escape cancela y devuelve el foco.
  - Guardar: `FormData` con `field=value` a `PATCH /api/characters/[id]`; mientras guarda, campo desactivado; error → mensaje bajo el campo (`role="alert"`) y el texto sigue en edición; éxito → `router.refresh()`.
  - Resto: el valor o «—»; textos largos con saltos de línea (`whitespace-pre-wrap`).
- Accesibilidad: cada campo con su etiqueta visible; el botón de edición con `aria-label` «Editar {label}».

## 7. Pruebas

- vitest: `featureSections` (agrupado y filtro, orden, secciones vacías fuera), `parseFeatureSection` y el de Trasfondo (desconocido → todo); `editCharacter` acepta los campos nuevos, rechaza los que pasan el límite y no deja que el creador los pida.
- En verde: vitest, `tsc`, `eslint`; `next build` al final.
- Navegador: «Elara Prueba» en solo lectura (filtros de Rasgos y Trasfondo, Notas); personaje de prueba propio para editar campos (añadir, cambiar, cancelar con Escape, error por límite), borrado al terminar; 375 px sin desbordes.
