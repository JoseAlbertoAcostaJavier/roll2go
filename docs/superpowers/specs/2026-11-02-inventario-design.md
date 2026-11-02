# Inventario: tabla, búsqueda, filtros y contenedores — diseño

Fecha: 2026-11-02. Fase propia tras el rework de la ficha. Referencia: capturas de Inventario de D&D Beyond (estructura), con la identidad de Roll2Go.

## 1. Objetivo

La pestaña Inventario pasa a una tabla como la de las capturas, con búsqueda, chips de filtro y **contenedores** (mochila, bolsas, cofres…) con su capacidad. Éxito: un jugador mete las raciones en la mochila y ve «Mochila — 12 lb (12/30 lb)»; filtra por «Equipado» o por «Mochila»; busca «arrojadiza» y encuentra sus dagas; la Bolsa de contención no suma su contenido al peso cargado.

Fuera de alcance: sintonización, penalizaciones de velocidad por peso, contenedores dentro de contenedores, el catálogo de objetos personalizados.

## 2. Datos (requiere reimportar)

- `ItemData.container?: { weight: number | null; volume: number | null; items: { ref: Ref; count: number }[]; weightless: boolean }` desde `containerCapacity` de 5etools (`weight` = suma de los compartimentos; `volume` en pies cúbicos; `item` = objetos que admite y cuántos). Solo es contenedor si tiene `weight`, `volume ≥ 1` o `item`: los de líquidos pequeños (vial, frasco, jarra, botella, cubo, olla) no lo son.
- `InventoryItem.container?: string | null`: id de la línea en la que está guardado (sin campo = suelto). Hojas antiguas: todo suelto.
- Operación nueva del inventario (`lib/rules/dnd2024/sheet/edits.ts`, ruta existente `PATCH /api/characters/[id]/inventory`): `{ op: "move"; id: string; container: string | null }`. Reglas:
  - El destino debe ser una línea del inventario cuyo objeto del catálogo sea contenedor («Ese objeto no es un contenedor.»); no puede ser la propia línea ni una línea que a su vez esté dentro de un contenedor; un contenedor no puede entrar en otro («Un contenedor no puede ir dentro de otro.»).
  - Mover a un contenedor desequipa la línea.
  - `remove` de un contenedor deja sueltas sus líneas.
- Peso (`lib/rules/dnd2024/sheet/inventory.ts`, puro): `inventoryWeights(items, info)` → `{ carried: number; byContainer: Record<string, number> }`: el contenido de un contenedor `weightless` no cuenta para `carried` (el contenedor sí, con su peso propio).
- README («Despliegue»): reimportar para tener las capacidades.

## 3. Interfaz (pestaña Inventario)

- **Cabecera**: «Peso cargado: N lb (X kg)» con el estado de carga actual (capacidad Fuerza × 15) y, a la derecha, el total de monedas en po.
- **Búsqueda**: «Buscar por nombre, tipo, rareza o propiedades» (nombre es/en, tipo, rareza y propiedades del arma, sin tildes ni mayúsculas), con espera de 300 ms, en la URL (`?q=`).
- **Chips**: «Todo · Equipado · {un chip por contenedor, con su nombre} · Otras posesiones» en `?seccion=todo|equipado|<id de línea>|otras`; desconocido → todo. Quitan `saved`.
- **Tabla**: columnas «Activo · Nombre · Peso · Cant. · Coste · Notas» (nombre con el tipo debajo; coste en po; notas = propiedades del arma, rareza y las notas de la línea). Secciones:
  - **Equipo**: las líneas sueltas.
  - **Una por contenedor**: cabecera «{Nombre} ({n.º de líneas}) — {peso del contenido} lb ({contenido}/{capacidad} lb)» con aviso «Sobrecargado» si se pasa (no bloquea); capacidad por volumen u objetos como texto («12 pies cúbicos», «20 virotes»); `weightless` con la nota «No cuenta para el peso cargado».
- **Dueño**: casilla «Activo» como hoy (solo equipables y fuera de contenedores), cantidad y notas editables como hoy, y un selector «Mover a…» por línea (Equipo / cada contenedor válido). Los demás: tabla en solo lectura.
- **Otras posesiones** y **Monedas**: como hoy, con el marco de la ficha.
- Impresión: todas las secciones, sin buscador, chips ni selectores. 375 px: la tabla se desplaza dentro de su caja.

## 4. Pruebas

- vitest: normalizado de `containerCapacity` (Mochila 30; Bolsa de contención 500 y `weightless`; Cofre volumen 12; Estuche de virotes por objetos; Frasco no es contenedor); `move` (a contenedor, a suelto, a sí mismo, a un no contenedor, contenedor dentro de contenedor, desequipa); `remove` de un contenedor suelta su contenido; `inventoryWeights` con `weightless`; filtro de búsqueda y `?seccion=`.
- En verde: vitest, `tsc`, `eslint`; `next build` al final.
- Reimportar (con permiso) y navegador: «Elara Prueba» en solo lectura; personaje de prueba propio moviendo objetos entre contenedores (borrado al terminar); 375 px.
