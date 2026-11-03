# Inventario como D&D Beyond: gestión en panel y ficha de objeto — diseño

Fecha: 2026-11-03. Segundo bloque del brief de rework («Sección de Inventario»). Referencias: captura «My Inventory» de D&D Beyond (secciones Equipment/Backpack con «Move» y detalle de contenedor) y la pestaña Inventario actual.

## 1. Objetivo

La tabla de Inventario queda para consultar; todo lo que se gestiona (añadir, mover, cantidad, notas, quitar) pasa a un panel «Gestionar inventario» como el de D&D Beyond. Pulsar cualquier objeto abre su ficha con los datos y la descripción de 5etools.

Fuera de alcance: cambios de reglas (mover, equipar, peso y contenedores siguen igual), sintonización, objetos personalizados con estadísticas.

## 2. Tabla de la pestaña

- Igual que hoy (cabecera con peso cargado y monedas, búsqueda, chips, columnas «Activo · Nombre · Peso · Cant. · Coste · Notas», secciones Equipo y una por contenedor), salvo:
  - fuera de cada fila: el selector «Mover a…», los campos de cantidad y notas, y el botón de quitar. Cantidad y notas se muestran como texto.
  - la casilla «Activo» se queda (solo el dueño; equipables fuera de contenedores).
  - el nombre es un botón que abre la ficha del objeto.
- El botón «Añadir» de la cabecera se sustituye por «Gestionar inventario», junto al buscador (solo el dueño).

## 3. Ficha de objeto

- Diálogo (el patrón de `StatDialog`, como las descripciones de rasgos y acciones) con: nombre; línea con tipo y rareza; peso y coste; si es arma, daño con su tipo, propiedades, maestría y alcance; si es armadura o escudo, CA y si da desventaja en Sigilo; si es contenedor, su capacidad («30 lb», «12 pies cúbicos», «20 × Virote») y «No cuenta para el peso cargado» si es el caso; cantidad y notas de la línea; descripción de 5etools.
- Objeto sin entrada en el catálogo (personalizado o no disponible): nombre, cantidad, notas y «Sin descripción.».
- Datos: `lib/rules/dnd2024/sheet/itemDetails.ts`, función pura `itemDetails(line, entry): ItemDetails` con las filas ya en español (reutiliza `itemTypeName`, `rarityName`, `weaponPropertyName`, `damageTypeName`, `masteryName`). La descripción llega con la página como el resto de descripciones de la ficha.

## 4. Panel «Gestionar inventario»

- Panel lateral derecho (en móvil, a pantalla completa) con título «Gestionar inventario» y botón de cerrar; foco atrapado y Escape cierra, como los demás diálogos.
- Arriba, «Añadir objeto» (el diálogo actual de añadir, con catálogo y personalizado).
- Una sección por grupo: «Equipo (n) — N lb» y cada contenedor «{Nombre} ({n}) — N lb ({contenido}/{capacidad} lb)» con «Sobrecargado» si se pasa.
- Fila de objeto: casilla de equipar (equipables fuera de contenedores), nombre, botón «Mover» que abre un menú con «Equipo» y cada contenedor (sin el suyo; no aparece en las líneas contenedoras ni sin contenedores) y un botón para desplegar. Desplegada: cantidad, notas (los campos de hoy, que guardan al salir o con Intro) y «Quitar».
- Cabecera de contenedor desplegable con «Detalles del contenedor»: capacidad, «No cuenta para el peso cargado» si es el caso y «Quitar contenedor» (su contenido vuelve a Equipo, como hoy).
- Todo se guarda al momento con la cola de envíos actual de `EquipmentTab` (optimista con vuelta atrás). La tabla de la pestaña refleja el estado optimista mientras el panel está abierto.
- Textos exactos: «Gestionar inventario», «Añadir objeto», «Mover», «Equipo», «Quitar», «Detalles del contenedor», «Quitar contenedor», «Cerrar».

## 5. Sin cambios

Reglas y rutas del inventario, monedas, «Otras posesiones», impresión (la tabla completa, sin botones ni panel), visitantes (solo la tabla y las fichas de objeto).

## 6. Pruebas

- vitest de `itemDetails`: espada larga (daño, tipo, propiedades en español, maestría), cota de malla (CA y desventaja en Sigilo), mochila (capacidad), cofre (volumen), objeto sin entrada (sin descripción), poción rara (rareza).
- En verde: vitest, `tsc`, `eslint`; `next build` al final.
- Navegador: personaje de prueba propio — añadir, mover, equipar, cambiar cantidad, quitar y quitar contenedor desde el panel; fichas de espada, armadura y mochila; «Elara Prueba» en solo lectura; 375 px; borrado al terminar.
