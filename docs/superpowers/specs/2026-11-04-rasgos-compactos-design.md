# Rasgos compactos con referencia de página — diseño

Fecha: 2026-11-04. Último bloque del brief de rework («Rework de la Sección Rasgos»). Referencia: «Features & Traits» de D&D Beyond («Spellcasting · PHB-2024, pg. 165», descripción al pulsar).

## 1. Objetivo

La pestaña «Rasgos y dotes» muestra cada rasgo en una fila compacta con su nombre y su referencia («Manual del Jugador 2024, pág. 165»); la descripción completa solo aparece al pulsar el rasgo.

Fuera de alcance: abreviaturas de libros («PHB 2024»), las pestañas Trasfondo y Acciones.

## 2. Datos (requiere reimportar)

- `NormalizedEntry.page: number | null` desde `raw.page` de 5etools (entero positivo; si no, `null`), en `header()` de `lib/rules/import/normalize.ts`. Las entradas con `_copy` heredan la página de su original si no traen la suya (`page` sigue en `NOT_COPIED` para los datos, pero el encabezado usa la propia o la del original).
- `BookEntry` (modelo) gana `page: { type: Number, default: null }`; el importador la guarda; `CatalogEntry.page: number | null` (los catálogos antiguos sin el campo → `null`).
- `featureReference(entry: CatalogEntry | undefined): string | null` en `lib/rules/dnd2024/sheet/labels.ts`: «{bookName}, pág. {page}», o «{bookName}» sin página, o `null` sin entrada.

## 3. Pestaña «Rasgos y dotes»

- Fila de rasgo: un botón de despliegue (toda la cabecera de la fila, con `aria-expanded` y el chevron) con el nombre, lo elegido, el valor de la tabla y «· Nivel N» como hoy; debajo, en texto pequeño y atenuado, la referencia. El contador de usos se queda visible en la fila (fuera del botón). Plegada por defecto; al desplegar, la descripción completa (sin recorte) debajo.
- Cabecera de grupo (especie, legado, clase, subclase, dote, opciones): igual que hoy con su referencia debajo del título; su descripción introductoria también plegada («Descripción», como hoy la de clase y subclase), incluida la de especie y legado (hoy recortada).
- Impresión: todas las descripciones desplegadas (`print:block`), sin chevrons.
- Teclado: Intro/Espacio despliegan; el estado no se guarda (se pliega al recargar).

## 4. Pruebas

- vitest: `page` en el normalizador (con página, sin página, con `_copy`); el esquema/modelo acepta `page`; `featureReference` con página, sin página y sin entrada.
- En verde: vitest, `tsc`, `eslint`; `next build` al final.
- Reimportar (con permiso) y navegador: «Elara Prueba» (referencias, desplegar y plegar, teclado) y un Bárbaro de prueba con Furia (el contador sigue funcionando); 375 px; borrar el personaje.
