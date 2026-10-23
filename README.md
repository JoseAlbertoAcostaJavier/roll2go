# roll2go
Roll2Go es un proyecto de TFG para la carrera de Ingeniería Informática en la UMA. 
# ¿Para que sirve Roll2Go?
Inspirado en diversas aplicaciones web como Nivel20, Pathbuilder o DnDBeyond, Roll2Go ha sido diseñado a modo de nexo entre usuarios y Directores de juego a la hora de crear campañas y personajes para diversos sistemas. A diferencia de otros navegadores web, Roll2Go incluye una opción gratuita para exportar los personajes directamente a modelo FoundryVTT, mediante un ID único asociado a cada personaje.

# Despliegue
Tras desplegar la ficha de personaje (hojas `sheet.version` 2), ejecuta una vez:

- `npm run import:5etools -- --data <carpeta data de 5etools>`: vuelve a importar el catálogo (corrige las competencias de armas del Pícaro y el Monje).
- `npm run migrate:levels`: convierte los personajes antiguos a la hoja v2. Los que no se pueden convertir (falta su clase o su trasfondo en el catálogo) se listan al final y se quedan como estaban.
