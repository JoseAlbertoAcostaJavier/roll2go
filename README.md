# roll2go
Roll2Go es un proyecto de TFG para la carrera de Ingeniería Informática en la UMA. 
# ¿Para que sirve Roll2Go?
Inspirado en diversas aplicaciones web como Nivel20, Pathbuilder o DnDBeyond, Roll2Go ha sido diseñado a modo de nexo entre usuarios y Directores de juego a la hora de crear campañas y personajes para diversos sistemas. A diferencia de otros navegadores web, Roll2Go incluye una opción gratuita para exportar los personajes directamente a modelo FoundryVTT, mediante un ID único asociado a cada personaje.

# Despliegue
Tras desplegar la ficha de personaje (hojas `sheet.version` 2), ejecuta una vez:

- `npm run import:5etools -- --data <carpeta data de 5etools>`: vuelve a importar el catálogo (corrige las competencias de armas del Pícaro y el Monje).
- `npm run migrate:levels`: convierte los personajes antiguos a la hoja v2. Los que no se pueden convertir (falta su clase o su trasfondo en el catálogo) se listan al final y se quedan como estaban.

Tras desplegar la subida de nivel:

- Vuelve a ejecutar `npm run import:5etools -- --data <carpeta data de 5etools>` (rasgos enlazados de clase y subclase, estilos de combate por clase, maestrías solo con armas base) y **reinicia el servidor** después: el catálogo se guarda en caché hasta 1 h.
- Los personajes que ya tomaron un nivel con rasgos que antes no se importaban (p. ej. el nivel 3 de subclase: Student of War, Hunter's Prey…) no reciben esas elecciones solos: hay que borrar ese nivel y volver a subirlo.

Tras desplegar los conjuros:

- Vuelve a ejecutar `npm run import:5etools -- --data <carpeta data de 5etools>` y **reinicia el servidor**: los conjuros ganan clases, etiquetas, mejora y nombre en español, y las clases su modo de lanzamiento. Hasta reimportar, el catálogo descarta las clases y los conjuros guardados con el formato anterior. La reimportación también trae las tierras del Círculo de la Tierra (se eligen en la ficha), los conjuros de las invocaciones y los conjuros a elegir de las dotes (Iniciado en la magia…).
- Los personajes creados antes con una dote de conjuros elegidos (p. ej. el Acólito) no los tienen guardados: hay que rehacer su creación (si son de nivel 1) o anotarlos. Los Clérigos Taumaturgos y Druidas Magos eligen el truco que les falta en su siguiente subida.
