# Rasgos de conjuro pendientes

Rasgos del XPHB que dan o cambian conjuros y que la ficha todavía no aplica. Están en `NOT_A_CHOICE`
(`lib/rules/dnd2024/featureChoices.ts`) para que el importador no los liste como elecciones sin especificar, pero ni el
asistente de subir de nivel los pide ni la pestaña Conjuros los muestra. Mientras tanto, el jugador los anota en las
notas del personaje.

| rasgo | clave | qué da | qué falta |
| --- | --- | --- | --- |
| Secretos mágicos (Bardo 10) | `classFeature:magical secrets\|bard\|xphb\|10` | Los conjuros preparados nuevos del Bardo pueden ser de las listas de Bardo, Clérigo, Druida y Mago (y cuentan como de Bardo); al sustituir uno, igual. | Que el Bardo prepare (`prepare` en `spellOps`) y elija al subir (`checkSpells`, `SpellsStep`) de las cuatro listas desde el nivel 10. |
| Arcano místico (Brujo 11, 13, 15, 17) | `classFeature:mystic arcanum\|warlock\|xphb\|11` (y 13, 15, 17) | Un conjuro de Brujo de nivel 6 (7, 8, 9) que se lanza una vez por descanso largo sin espacio. | Una elección nueva (un conjuro de la lista del Brujo del nivel que toca) guardada en `levels[].choices`, mostrada aparte en el bloque del Brujo con su uso diario. |
| Descubrimientos mágicos (Colegio del Saber 6) | `subclassFeature:magical discoveries\|bard\|xphb\|lore\|xphb\|6` | Dos conjuros (trucos o de un nivel con espacios) de Clérigo, Druida o Mago, siempre preparados; se puede sustituir uno al subir. | Elección de dos conjuros de esas listas al ganar el rasgo, sustitución al subir y mostrarlos como siempre preparados del bloque del Bardo. |
| Sabio de la escuela (Mago: Abjurador, Adivino, Evocador, Ilusionista 3) | `subclassFeature:abjuration savant\|wizard\|xphb\|abjurer\|xphb\|3` (y los de adivinación, evocación e ilusión) | Dos conjuros de Mago de su escuela de nivel 2 como máximo gratis en el libro y uno más cada vez que gana un nivel de espacios. | Entradas gratis del libro filtradas por escuela en la elección `spells` del Mago (nivel 3 y cada nivel de espacio nuevo). |
| Ilusiones mejoradas (Ilusionista 3) | `subclassFeature:improved illusions\|wizard\|xphb\|illusionist\|xphb\|3` | Ilusión menor (u otro truco de Mago si ya la conoce), que no cuenta para el límite. | Conceder el truco (o pedir otro si ya lo tiene) fuera del límite de trucos. |
| Dominio de conjuros (Mago 18) | `classFeature:spell mastery\|wizard\|xphb\|18` | Un conjuro de nivel 1 y otro de nivel 2 del libro (con tiempo de una acción) siempre preparados y a voluntad; se pueden cambiar tras un descanso largo. | Elegirlos de su libro (en la ficha, como la tierra del Círculo de la Tierra) y mostrarlos como siempre preparados. |
| Conjuros distintivos (Mago 20) | `classFeature:signature spells\|wizard\|xphb\|20` | Dos conjuros de nivel 3 del libro siempre preparados que se lanzan una vez por descanso sin espacio. | Elegirlos de su libro al ganar el rasgo y mostrarlos como siempre preparados. |

## Conjuros de dotes

Los conjuros a elegir de las dotes (`FeatData.spellChoices`, elección `featSpells`) se eligen al ganar la dote y, en
Lanzador de rituales, en los niveles en que da más. Falta:

- Sustituir uno de ellos al subir de nivel («Spell Change» de Iniciado en la magia).
- La dote base de Iniciado en la magia, con sus tres listas alternativas, no pide nada (los trasfondos usan sus
  versiones con una sola lista).
- Rasgos opcionales con conjuros a elegir (Pacto del tomo: trucos y rituales).
