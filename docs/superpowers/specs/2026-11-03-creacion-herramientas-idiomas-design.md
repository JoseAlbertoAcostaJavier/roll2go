# Creación de personaje: objetos a elegir del equipo e idiomas nativos — diseño

Fecha: 2026-11-03. Último bloque del brief de rework que afecta a la creación («Selección de Juegos de Herramientas», «Gestión de Idiomas Nativa»).

## 1. Objetivo

Un Soldado elige su juego («Juego de dados») en el equipo inicial y le llega al inventario como objeto del catálogo. Todo personaje nuevo elige 2 idiomas estándar además del Común; un Pícaro tiene Jerga de ladrones y elige otro idioma; un Druida tiene Druídico; un Explorador elige 2 idiomas al llegar al nivel 2. La caja de texto «Idiomas» desaparece del creador.

Fuera de alcance: canalizadores a elegir (5etools no da el tipo de canalizador en los datos importados: se quedan como texto), idiomas de dotes, convertir los idiomas escritos de personajes existentes.

## 2. Objetos a elegir en el equipo

- Importador (`toPack`): `Pack.choose?: { kinds: ChoiceKind[]; label: string }` en vez de solo `displayName` cuando `equipmentType`/`equipmentTypes` es uno de: `setGaming`/`anyGamingSet` → `"gaming"` (tipo `GS`), `instrumentMusical`/`anyMusicalInstrument` → `"instrument"` (`INS`), `toolArtisan`/`anyArtisansTool` → `"artisan"` (`AT`), `weaponSimple` → `"simple"`, `weaponSimpleMelee` → `"simpleMelee"`, `weaponMartial` → `"martial"`, `weaponMartialMelee` → `"martialMelee"` (por `weapon.category` y si es cuerpo a cuerpo, `type` `M`). `displayName` se conserva (texto de reserva). Los demás códigos siguen como texto. Requiere reimportar.
- Hoja: en la elección de equipo de clase y de trasfondo, `equipmentPicks?: Record<string, Ref>` (clave = índice del `Pack` dentro de la opción elegida, en texto).
- Creador: cada `Pack` con `choose` de la opción elegida muestra un selector con los objetos del catálogo de esos tipos en los libros del personaje (ordenados por nombre en español), con su etiqueta («Un juego (a elegir)»). Sin elegir, el creador no deja guardar: «Falta elegir: Un juego (a elegir).».
- Servidor (validación de la creación): cada `choose` de la opción elegida necesita su objeto, de un tipo permitido y disponible para el personaje («Ese objeto no vale para Un juego (a elegir).»). Picks sobrantes o de índices sin `choose` → error.
- Inventario inicial (`startingInventory`): el `Pack` con su pick se trata como el objeto elegido (cantidad del pack), con la regla de la mochila de siempre (herramientas, juegos e instrumentos sueltos; armas sueltas y equipadas). Hojas antiguas o catálogo sin `choose`: como hoy (línea de texto).

## 3. Idiomas nativos

- Hoja: `languageChoices?: Ref[]` (idiomas elegidos, en orden) junto al `languages` de texto actual.
- Reglas puras (`lib/rules/dnd2024/creation/languages.ts`):
  - `fixedLanguages(sheet, entries): Ref[]` — Común siempre; Jerga de ladrones si tiene Pícaro (rasgo «Thieves' Cant»); Druídico si tiene Druida.
  - `languageSlots(sheet): { source: string; label: string; count: number; rare: boolean }[]` — origen: 2 estándar («Idiomas de origen»); Pícaro 1: 1 cualquiera («Jerga de ladrones»); Explorador 2: 2 cualquiera («Explorador hábil») si llegó a Explorador 2.
  - Validación: número exacto por hueco, sin repetir entre sí ni con los fijos, estándar donde se pide («Elige idiomas estándar para tus idiomas de origen.», «Ya conoces ese idioma.», «Faltan idiomas por elegir.»).
- Creador: la sección «Información» pierde la caja «Idiomas»; nueva sección «Idiomas» con los fijos como chips y un selector por cada idioma a elegir (los ya elegidos no se ofrecen en los demás).
- Subida de nivel: al llegar a Explorador 2, el asistente pide los 2 idiomas («Explorador hábil: elige 2 idiomas.») y la op de nivel los añade a `languageChoices`; borrar ese nivel los quita.
- Ficha («Competencias» → Idiomas): fijos + elegidos, con nombre en español; si la hoja tiene `languages` de texto (personajes antiguos), también se muestran esos.
- «Recrear» parte de lo elegido.

## 4. Pruebas

- vitest: `toPack` con `setGaming`, `["instrumentMusical", "toolArtisan"]` (Monje) y `weaponSimple`; validación de picks (falta, tipo erróneo, sobrante); `startingInventory` del Soldado con su juego; `fixedLanguages` y `languageSlots` (Humano Mago 1, Pícaro 1, Druida 1, Explorador 1 y 2, multiclase Pícaro/Druida); validación de idiomas (repetido, raro en hueco estándar, de menos); subida a Explorador 2 y borrado de ese nivel.
- En verde: vitest, `tsc`, `eslint`; `next build` al final.
- Reimportar (con permiso) y navegador: crear Soldado (juego), Pícaro (Jerga de ladrones + idioma) y Explorador que sube a 2; «Elara Prueba» en solo lectura con sus idiomas de texto; 375 px; borrar los personajes de prueba y restaurar el borrador del creador.
