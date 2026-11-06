# Pulido de reglas — diseño

Fecha: 2026-11-06. Reglas: D&D 2024 (XPHB), comprobadas contra `5etools-src/data` (`races.json`, `spells/spells-xphb.json`, `class/class-barbarian.json`).

## 1. Objetivo

Cerrar las reglas que la ficha aún no refleja: contadores de los rasgos de especie, usos del conjuro del Gnomo del bosque, el idioma adicional del Pícaro al entrar por multiclase y los dados de curación de los conjuros.

Fuera de alcance:
- **Furia «ilimitada» a nivel 20:** se descarta. En las reglas de 2024 la tabla del Bárbaro da 6 furias a nivel 20 (`class-barbarian.json`) y la ficha ya lo muestra bien. Era una regla de 2014.
- Especies de otros libros: la tabla es solo de XPHB. Otros libros siguen sin contador salvo que traigan datos de Foundry.
- Sumar el modificador a la curación (ver §5).

## 2. Contadores de especie

Una especie puede tener varios contadores, cada uno con su nombre, máximo, recuperación, nivel mínimo de personaje y momento de uso.

| Especie | Contador | Máximo | Recupera | Desde nivel | En Acciones |
|---|---|---|---|---|---|
| Dracónido | Arma de aliento | competencia | largo | 1 | Otras |
| Dracónido | Vuelo dracónico | 1 | largo | 5 | Adicional |
| Orco | Oleada de adrenalina | competencia | corto o largo | 1 | Adicional |
| Orco | Aguante incansable | 1 | largo | 1 | Otras |
| Goliat | Ancestro gigante | competencia | largo | 1 | Otras |
| Goliat | Forma grande | 1 | largo | 5 | Adicional |
| Aasimar | Manos sanadoras | 1 | largo | 1 | Acción |
| Aasimar | Revelación celestial | 1 | largo | 3 | Adicional |
| Enano | Sentido de la piedra | competencia | largo | 1 | Adicional |

- `Vuelo dracónico` y `Forma grande` no estaban en el diseño anterior: las reglas les dan un uso por descanso largo, así que se añaden.
- **Claves:** `{refKey de la especie}#{id}` (`…species:orc|xphb#adrenaline-rush`). «Aguante incansable» conserva la clave actual (`…species:orc|xphb`), así los usos ya guardados siguen valiendo y **no hace falta migrar**.
- Por debajo del nivel mínimo el contador no existe. Si un uso guardado supera el máximo, se recorta como hoy.
- **Rasgos:** el grupo de la especie muestra todos sus contadores, cada uno con su nombre delante de las casillas (ahora mismo solo cabe uno y sin nombre).
- **Acciones:** una línea por contador, en el grupo de la tabla. Dos líneas de la misma especie comparten la descripción de la especie, pero no la clave de React.
- **Descansos y estado:** usan la lista derivada, así que no cambian. El corto devuelve «Oleada de adrenalina» y no los demás. La operación `featureUse` acepta las claves nuevas y sigue rechazando las desconocidas.

## 3. Usos del conjuro del Gnomo del bosque

- 5etools lo indica en el legado: `innate: { "3": { daily: { pb: ["speak with animals|xphb"] } } }`. El importador lo guarda en la concesión como `uses: "pb"`, leyendo el dato y sin tabla propia.
- `OtherSpell` lleva `uses`; una sola función calcula el máximo de usos gratis (competencia si es `pb`; si no, 1). La usan `usableSpells` (lo que se ve) y `innateUses` en `spellOps` (lo que se valida), para que no discrepen.
- «Hablar con los animales» muestra tantas casillas como bonificador de competencia y se recupera con descanso largo. El resto de conjuros de especie siguen con 1.
- **Requiere reimportar.** Hasta entonces el conjuro sigue con 1 uso, sin romperse.

## 4. Idioma del Pícaro por multiclase

- Al entrar en Pícaro con otra clase ya en la hoja (nivel 1 de Pícaro y `levels` no vacío), el nivel pide 1 idioma más, cualquiera, además de dar Jerga de ladrones, igual que «Explorador hábil» al llegar a Explorador 2.
- Fuente `languages:rogue`, etiqueta «Jerga de ladrones: elige 1 idioma.». Usa `capSlots`: si no queda ningún idioma por elegir, no se pide.
- Jerga de ladrones cuenta como conocida en esa elección: no se puede elegir, ni repetir un idioma ya sabido.
- Un Pícaro de nivel 1 en la creación no cambia: lo sigue pidiendo la creación. Al borrar el nivel, el idioma se va con él.

## 5. Dados de curación

- El importador guarda `SpellData.healing: { dice }` con el primer `{@dice}` de una frase con «regain(s)» o «restore». Si el conjuro tiene `{@damage}`, gana el daño y no se guarda curación.
- Resultado esperado en XPHB: Curar heridas 2d8, Palabra de curación 2d4, Curar heridas en masa 5d8, Palabra de curación en masa 2d4, Plegaria de curación 2d8, Regenerar 4d8 + 15, Aura de vitalidad 2d6.
- No deben tenerla: Festín de héroes (sube el máximo de PG), Reencarnar (tirada de tabla), Conjurar celestial y Deseo (tienen daño).
- Tablas de Conjuros y Acciones: en la columna de daño, «2d8» con el texto «Curación» y sin icono de tipo de daño.
- Solo los dados, sin el modificador de característica, igual que hoy el daño de los conjuros.
- **Requiere reimportar.** Hasta entonces esos conjuros siguen sin dados.

## 6. Reimportación

Lo de §3 y §5 cambia datos importados. Al terminar hay que reimportar a Atlas (`--dry-run` primero), borrar `.next/dev/cache/fetch-cache` y reiniciar el servidor. **Se pedirá permiso antes de reimportar.**

## 7. Pruebas

- vitest:
  - Cada fila de la tabla de §2, incluidos los niveles mínimos (Forma grande a nivel 4 y 5).
  - Hoja con la clave antigua del Orco: conserva sus usos.
  - Descanso corto: devuelve Oleada de adrenalina y no Aguante incansable.
  - `featureUse` con una clave nueva y con una desconocida.
  - Una línea de Acciones por contador, en su grupo.
  - Importación de `uses: "pb"` y máximo del conjuro con competencia +2 y +3; el gasto se valida con ese máximo.
  - Pícaro: pide el idioma por multiclase; no lo pide en la creación; no acepta Jerga de ladrones; con `capSlots` a 0 no lo pide.
  - Curación: los conjuros que deben tenerla y los que no, de §5.
- En verde: vitest, `tsc`, `eslint`; `next build` al final.
- Navegador, con personajes de prueba propios que se borran después: Orco (dos contadores en Rasgos y Acciones, descanso corto), Gnomo del bosque de nivel 3 o más, Guerrero que entra en Pícaro, Clérigo con Curar heridas; 375 px.
