# Conjuros D&D 2024 — Diseño (parte 5)

Fecha: 2026-10-23 · Estado: pendiente de revisión
Depende de: `2026-10-23-ficha-personaje-design.md` (parte 3) y `2026-10-23-subir-nivel-design.md` (parte 4).

## 1. Objetivo

Dar a los personajes lanzadores una **pestaña Conjuros** para consultar, filtrar y preparar sus conjuros, con **límites por clase que no se pueden superar**, seguimiento de espacios gastados, y un **paso de conjuros** al subir de nivel y al crear el personaje.

### Decisiones tomadas con el usuario

| Tema | Decisión |
|---|---|
| Idioma | Nombres de los 391 conjuros en español (los 339 del SRD con la traducción oficial del SRD 5.2.1 en español; el resto, propuesta revisable en la lista de pendientes). Escuela, tiempo, alcance, duración y componentes traducidos por formateador. Descripciones en inglés por ahora. |
| Preparación | **No se puede superar el límite** de preparados ni de trucos: la interfaz bloquea y el servidor lo comprueba (a diferencia de Nivel20). |
| Modos | Tres modos por clase (`list`, `levelUp`, `spellbook`). |
| Permisos | Solo el dueño prepara, gasta espacios y elige conjuros. El resto ve la pestaña en lectura. |

### Fuera de alcance

Componentes materiales con coste y su consumo, conjuros de objetos mágicos y pergaminos, efectos automáticos de los conjuros sobre la ficha, conjuros de otros libros no importados, traducción de descripciones.

## 2. Reglas

### 2.1 Modos por clase (`ClassData.spellcasting.mode`)

| Modo | Clases XPHB | Fuente de los preparados | Cuándo se cambian |
|---|---|---|---|
| `list` | Clérigo, Druida, Paladín | lista de la clase | en la ficha en cualquier momento |
| `levelUp` | Bardo, Explorador, Hechicero, Brujo | lista de la clase | solo al subir de nivel: nuevos según la progresión y sustituir **uno** (opcional) |
| `spellbook` | Mago | su libro de conjuros | en la ficha en cualquier momento; el libro crece al subir de nivel y con «Copiar conjuro al libro» |

El importador fija el modo por clase con una tabla en `lib/rules/dnd2024/spellcasting.ts` (las 12 clases XPHB; homebrew lo declara en `spellcasting.mode`). Las clases sin lanzamiento tienen `spellcasting: null`; las subclases lanzadoras (Caballero arcano, Embaucador arcano) declaran `spellcasting` en su `SubclassData` con la misma forma y progresión de tercio.

### 2.2 Límites (calculados en `derive`, por clase)
- **Trucos**: `progressions.cantrips[classLevel - 1]`.
- **Preparados**: `progressions.prepared[classLevel - 1]`.
- **Libro (Mago)**: 6 a nivel 1 + 2 por nivel de Mago + los copiados.
- **Nivel máximo de conjuro preparable**: el nivel más alto de espacio que da la clase sola según su progresión (`full`, `half` redondeando hacia arriba, `third`, `pact`). En multiclase, los preparados de cada clase usan el nivel máximo de **su** progresión; los espacios se combinan (§2.4).
- **Siempre preparados** (no cuentan para el límite): conjuros de subclase (`SubclassData.spells` hasta el nivel de clase), especie y legado (`SpeciesData.spells`/`LineageData.spells` hasta el nivel total), dotes (Iniciado en la magia, etc.). Se muestran con su origen («Legado: Alto elfo», «Dominio de la vida»).
- **CD** = 8 + competencia + mod. de la característica mágica de la clase; **ataque** = competencia + mod.

### 2.3 Espacios
- Tabla de la clase para un solo lanzador; Brujo con **Magia de pacto** (número y nivel de espacios por nivel de Brujo).
- **Multiclase**: nivel de lanzador = niveles de lanzador completo + ½ (hacia arriba) de Paladín y Explorador + ⅓ (hacia abajo) de Caballero arcano y Embaucador arcano → tabla de lanzador multiclase. Magia de pacto aparte.
- `sheet.slotsUsed: { "1".."9": number; pact: number }`; **Descanso largo** pone todo a 0. El servidor limita cada valor a los espacios disponibles.

### 2.4 Lo que se guarda
- **Trucos y conjuros aprendidos** (modo `levelUp`), **entradas de libro** (modo `spellbook`) y **sustituciones**: elección `spells` en la entrada de nivel correspondiente:
  ```ts
  type SpellChoice = {
    class: Ref;                       // clase (o subclase lanzadora)
    cantrips: Named[];                // trucos nuevos
    spells: Named[];                  // conjuros nuevos (levelUp) o entradas de libro (spellbook)
    replace?: { out: Named; in: Named }; // sustitución opcional (levelUp, y trucos si la regla lo permite)
  };
  ```
- **Preparados** de clases `list` y `spellbook`: `sheet.prepared: Record<classKey, Ref[]>` (en `levelUp` los preparados son exactamente los aprendidos, no se guarda nada aparte).
- **Libro del Mago**: entradas de nivel + `sheet.spellbookExtra: Named[]` (copiados desde la ficha).
- **Espacios gastados**: `sheet.slotsUsed`.

### 2.5 API (`PATCH /api/characters/[id]/spells`, dueño, `rateLimit("character_edit", …)`)
Una operación por petición:
- `{ op: "prepare", class, ref }` / `{ op: "unprepare", class, ref }`: solo modos `list` y `spellbook`; el conjuro debe ser de la lista de la clase (o del libro), de nivel ≥ 1 y ≤ el máximo preparable, dentro de `usableBooks`; **si ya hay tantos preparados como el límite, 400** «Ya tienes N de N conjuros preparados».
- `{ op: "copy", ref }`: Mago; conjuro de la lista de Mago de nivel ≤ máximo preparable, no repetido.
- `{ op: "slot", level: "1".."9" | "pact", used }` y `{ op: "longRest" }`.
Devuelve el estado de conjuros recalculado.

Al **borrar un nivel** (parte 4 §4.3) se quitan de `prepared` los conjuros que superen el nuevo máximo y, si se supera el nuevo límite, los últimos añadidos; `slotsUsed` se recorta.

## 3. Catálogo

- `SpellData` gana:
  - `classes: string[]` completo desde `spells/sources.json` (clases y subclases que lo tienen);
  - `tags: string[]` desde `miscTags`, `damageInflict`, `conditionInflict`, `savingThrow`, `spellAttack`, `areaTags`, más `ritual` y `concentración`;
  - `higherLevels?: string` (BBCode) desde `entriesHigherLevel`.
- **Formateador** `lib/rules/dnd2024/spellText.ts`: escuela (`V` → «Evocación"), tiempo («1 acción», «1 acción adicional», «1 reacción…»), alcance («18 metros (60 pies)», «Toque», «Personal»), duración («Instantáneo», «Concentración, hasta 1 minuto»), componentes («V, S, M (un trozo de…)», el texto del material en inglés), etiquetas en español.
- **Nombres**: claves `spell:…|xphb` en `lib/rules/i18n/es.json`; los no confirmados van a `docs/superpowers/notes/traducciones-pendientes.md`.
- **Iconos**: uno propio por escuela (8 SVG en `app/components/icons/schools/`), sin arte de terceros.
- Reimportación tras los cambios.

## 4. Interfaz

### 4.1 Pestaña Conjuros (`/characters/[id]?tab=conjuros`)
Un bloque por clase lanzadora y un bloque «Otros» (especie, legado, dotes):
- **Cabecera**: Característica mágica · CD de salvación · Bonificador de ataque · Preparados `n/N` (o «Aprendidos» en `levelUp`) · Trucos `n/N`.
- **Espacios**: fila de niveles 1–9 con marcas para gastar y recuperar (solo los niveles con espacios); Magia de pacto aparte; botón **Descanso largo**. (Los espacios se muestran una sola vez si hay varias clases: van en una tarjeta común encima de los bloques.)
- **Listas** (pestañas):
  - **Preparados**: preparados + siempre preparados (con su origen).
  - **Mi lista**: Mago → su libro, con **Copiar conjuro al libro**; modo `levelUp` → los aprendidos. No aparece en modo `list`.
  - **Disponibles**: lista de la clase hasta el nivel máximo preparable, dentro de los libros usables.
  - **Todos**: toda la lista de la clase; los de nivel demasiado alto, atenuados y sin casilla.
- **Filtros** (Disponibles y Todos): nombre (sin tildes), casillas Trucos y Nivel 1–9, escuela, etiqueta (`RuleSelect` múltiple).
- **Fila**: casilla de preparar (solo modos `list`/`spellbook`; desactivada al llegar al límite con el aviso «Ya tienes N de N preparados. Desmarca uno para preparar otro»), icono de escuela, nombre en español, nivel («Truco», «Nivel 3»), escuela, tiempo, duración, alcance, componentes, y una línea de resumen (primer párrafo de la descripción).
- **Ficha del conjuro**: ventana (diálogo accesible, Escape) con nivel y escuela, origen (libro), componentes, tiempo, alcance, duración, ataque o salvación, clases, descripción completa en BBCode y mejora a niveles superiores / de truco. Enlace propio `?tab=conjuros&spell=<clave>`.
- **Lectura**: sin casillas ni botones para quien no es el dueño.
- **Rendimiento**: la lista de una clase (100–200 conjuros sin descripción) se carga una vez con `listEntries(kind: "spell", filtro por clase)` y se filtra en el navegador; la descripción se pide al abrir la ficha.

### 4.2 Paso «Conjuros» al subir de nivel
- Aparece si el nivel nuevo da trucos, conjuros (modo `levelUp`), entradas de libro (`spellbook`) o permite sustituir uno.
- Misma lista con filtros en modo selección: «Elige 1 truco», «Elige 2 conjuros de nivel 1–2»; los que ya tiene o de nivel demasiado alto, marcados e inactivos.
- Sustitución opcional: «Puedes sustituir un conjuro que ya conoces» → elegir cuál sale y cuál entra.
- Se guarda como elección `spells` de la entrada; `validateLevel` comprueba números, listas, niveles y libros.

### 4.3 Creación (nivel 1)
El creador (parte 2) gana una sección **Conjuros** tras **Clase** para las clases lanzadoras de nivel 1: trucos, conjuros iniciales (`levelUp`) o libro inicial de 6 (Mago), y preparados iniciales (`list`/`spellbook`) hasta el límite. Se guarda en `levels[0]` y `prepared`; `validateSheet` lo comprueba.

## 5. Pruebas

- Unitarias:
  - límites por clase y nivel, con los valores esperados tomados de `cantripProgression`/`preparedSpellsProgression` del fixture de cada clase (Clérigo 1, Mago 1 con libro de 6, Paladín 1 y 2, Brujo 1 con Magia de pacto);
  - nivel máximo preparable con `half` hacia arriba;
  - espacios multiclase (Paladín 3 + Hechicero 2 → lanzador 4; Brujo aparte);
  - siempre preparados de subclase/legado/dote no cuentan;
  - `PATCH spells`: preparar por encima del límite → 400, conjuro de otra lista → 400, nivel demasiado alto → 400, `levelUp` no admite `prepare`, `copy` del Mago, `slot` fuera de rango, `longRest`;
  - `validateLevel` con `spells`: número exacto, sustitución válida;
  - formateador de textos de conjuro.
- Navegador: Mago 1 (libro, preparar hasta el límite y ver el bloqueo), Clérigo 1 (preparar desde la lista), Hechicero 2 (paso de conjuros al subir), Paladín 3 / Hechicero 1 (espacios combinados), gastar espacios y descanso largo, ficha del conjuro, filtros por nivel/escuela/etiqueta, vista del DM.

## 6. Riesgos

- Las progresiones de 5etools pueden faltar en alguna clase homebrew: sin progresión, la clase no muestra límites y no permite preparar (aviso en el informe del importador).
- Lista de clases de cada conjuro depende de `sources.json`; si falta, el conjuro no aparece en ninguna lista.
- Volumen de traducción de nombres de conjuros: los no confirmados quedan en inglés y en la lista de pendientes.
