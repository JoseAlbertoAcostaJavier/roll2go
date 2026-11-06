# Detalles de la ficha — diseño

Fecha: 2026-11-04. Referencias: capturas de D&D Beyond (habilidades con pericia, acciones con maestría, «Vista Item» de Raciones y «Vista Arma» de Gran hacha) y los iconos `public/assets/icons/Items.svg` y `public/assets/icons/Melee Weapons.svg`.

## 1. Objetivo

Pulir la ficha para que se lea como D&D Beyond: pericia con un círculo dentro de otro, estrella de maestría en las armas, notas útiles en Acciones, conjuros de dote y especie con su tirada y daño, «Características» editables con el género de la creación, y una ficha de objeto y de arma con la disposición de D&D Beyond, también desde Acciones.

Fuera de alcance: «Pulido de reglas» (fase siguiente), descripciones de maestría de 5etools (se usan textos propios).

## 2. Habilidades: pericia

- `SkillsBox`: competencia = punto relleno de marca; pericia = punto relleno dentro de un anillo del mismo color (un solo marcador, no dos); sin competencia = anillo atenuado. Texto accesible «Pericia» / «Competencia» / «Sin competencia».

## 3. Acciones

- Armas en la tabla: si el personaje tiene maestría con el arma (`Attack.mastery`), el icono del arma lleva una estrella pequeña (esquina superior) con etiqueta accesible «Maestría: {nombre}».
- Notas de armas: «{Sencilla|Marcial}, {propiedades en español}, {maestría si la tiene}, Alcance {corto/largo en m}» (sin repetir lo que ya está en Alcance si no es arma arrojadiza o a distancia), en el orden de D&D Beyond.
- Notas de conjuros: componentes («V, S, M»), «Concentración» y «Ritual» si lo son; el origen («Truco · Mago», «Nivel 1 · Iniciado en la magia (mago)») pasa debajo del nombre.
- Conjuros de dote, especie o legado (`OtherSpell`): llevan la característica con la que se lanzan (la elegida en la dote o el legado; si no hay elección, la de su concesión en el catálogo; si no se sabe, Inteligencia) y su tirada (`bonificador + modificador`) y CD (`8 + bonificador + modificador`); pasan a la tabla con su daño como los de clase.
- El nombre de un arma (en la tabla de Acciones) abre la ficha de objeto (§5) de su línea del inventario; el ataque sin armas no.

## 4. Características (pestaña Trasfondo)

- «Género»: de solo lectura, los pronombres elegidos en la creación (`character.pronouns`: «Él», «Ella», «Elle», unidos por « / »); sin pronombres, «—».
- Altura, Ojos, Fe, Pelo, Piel, Edad y Peso: campos de texto visibles para el dueño (borde y fondo de campo, sin «Añadir…»), que guardan al salir o con Intro como hoy; para los demás, el texto o «—».
- Rasgos de personalidad, Ideales, Vínculos, Defectos y Apariencia: sin cambios.

## 5. Ficha de objeto y de arma

- Cabecera: icono (armas con `Melee Weapons.svg`; el resto con `Items.svg`), nombre y debajo, en cursiva, «{Tipo}, {rareza o «común»}» y «En Equipo» / «En {contenedor}».
- Filas con etiqueta en negrita: armas — «Competente» (Sí/No), «Tipo de ataque» (Cuerpo a cuerpo / A distancia), «Alcance», «Daño» (con el bonificador del personaje, el mismo que la tabla de Acciones), «Tipo de daño» (con su icono); todos — «Peso», «Coste», «Propiedades» (armas), «CA» y «Sigilo» (armaduras), «Capacidad» (contenedores), «Fuente» (libro).
- Descripción de 5etools; después, si el personaje tiene maestría con el arma, «★ Maestría: {nombre}» con un texto propio breve en español de cada maestría (Hendir, Rozar, Mellar, Empujar, Debilitar, Ralentizar, Derribar, Vejar; sin copiar texto de 5etools).
- Dueño: al pie, «Cantidad» con − y +, «Mover» (menú como en el panel) y «Quitar»; los demás, sin controles.

## 6. Pruebas

- vitest: notas de arma (Daga: «Sencilla, Sutil, Ligera, Arrojadiza, Mellar, Alcance 6/18 m»), notas de conjuro (Descarga de fuego «V, S»; Detectar magia «V, S · Concentración · Ritual»), conjuro de dote con característica elegida (Iniciado en la magia con int → tirada y CD) y su daño en Acciones, pronombres a texto, filas de la ficha de arma (Gran hacha con daño del personaje y competencia), textos de maestría.
- En verde: vitest, `tsc`, `eslint`; `next build` al final.
- Navegador: «Elara Prueba» (Acciones, Características, fichas), personaje de prueba Pícaro con pericia y maestría; 375 px; borrar el personaje.
