# Rasgos de conjuro pendientes

Ninguno. Los rasgos del XPHB que daban o cambiaban conjuros y que la ficha no aplicaba (Secretos mágicos, Arcano
místico, Descubrimientos mágicos, Sabio de la escuela, Ilusiones mejoradas, Dominio de conjuros, Conjuros distintivos),
la sustitución de los conjuros de Iniciado en la magia, su dote base con tres listas y el Pacto del tomo se aplican desde
la ampliación de conjuros (`docs/superpowers/specs/2026-10-25-ampliacion-conjuros-design.md`).

Si aparece otro rasgo con conjuros sin tratar, se añade aquí con su clave, qué da y qué falta, y a `NOT_A_CHOICE`
(`lib/rules/dnd2024/featureChoices.ts`) mientras tanto.

## Listas de conjuros bajo demanda

El creador (`/api/rules/spells`; al rehacer la creación, `/api/characters/[id]/spells/list`) y el asistente de subir de
nivel (`/api/characters/[id]/spells/list`) piden las listas al servidor cuando las necesitan, en filas ligeras sin
resumen, componentes, duración ni libro.
Por eso, en el creador y el asistente los conjuros se muestran sin la línea de resumen ni la duración y los componentes
(la ficha del conjuro, al abrirla, sí los trae). La ficha del personaje con `?tab=conjuros` sigue recibiendo las listas
completas desde la página (cada pestaña es una navegación); en las demás, solo los conjuros que tiene (para imprimir).
