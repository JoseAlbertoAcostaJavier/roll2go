# Rediseño de la pestaña Información de la ficha — diseño

Fecha: 2026-10-24. Parte 6 del creador/ficha de D&D 2024 (tras ficha, subir de nivel y conjuros).

## 1. Objetivo

La pestaña **Información** de la ficha (`app/components/characters/sheet/InfoTab.tsx`) tiene cajas demasiado grandes para valores de una sola cifra (Iniciativa, Velocidad, Clase de armadura, Bonificación por competencia) y nada se puede pulsar. Como en Nivel20, el jugador debe poder pulsar cualquier valor y ver **qué es** y **de dónde sale su número**.

Éxito:
- Los valores de combate ocupan una franja compacta; la pestaña cabe en menos pantalla y no desborda a 375 px.
- Características, tiradas de salvación, habilidades, Clase de armadura, Iniciativa y Velocidad abren un diálogo con su descripción en español y el desglose de su valor, cuyas partes suman el total que muestra la ficha.
- El desglose revela y corrige los huecos de reglas conocidos (§4.4).

Fuera de alcance: bonificadores manuales (pestaña «Personalizar» de Nivel20; llegará con los objetos mágicos), traducir las descripciones del resto del catálogo, cambios en Ataques y Otras competencias salvo el espaciado.

## 2. Disposición

De arriba abajo:

1. **Características**: las seis fichas actuales, más bajas (modificador grande, puntuación en una píldora). Cada ficha es un botón.
2. **Franja de combate**: la tarjeta de **Puntos de golpe** (con `HpEditor` para el dueño; texto para los demás) y, a su lado, cuatro fichas compactas de una línea: **CA**, **Iniciativa**, **Velocidad** y **Competencia** (etiqueta pequeña encima, valor debajo, altura ≈ 56 px). CA, Iniciativa y Velocidad son botones; Competencia no (no tiene desglose). El aviso de armadura sin competencia se muestra como un icono de alerta en la ficha de CA y su texto va en el diálogo.
   - Escritorio: PG ocupa 1 columna y las cuatro fichas el resto en una fila.
   - Móvil (< `sm`): PG a todo el ancho y las cuatro fichas en una cuadrícula de 2 × 2.
3. **Tiradas de salvación** y **Habilidades**, en dos columnas como ahora (`lg:grid-cols-[1fr_1.4fr]`). Cada fila es un botón (marca de competencia, nombre, total). En Habilidades, Percepción, Perspicacia e Investigación muestran también su valor pasivo («Pasiva 13») en texto pequeño.
4. **Ataques** y **Otras competencias**, sin cambios.

Los botones muestran el estado de foco visible y el cursor de enlace, sin parecer botones de acción: la fila entera es el área pulsable y al pasar el ratón se resalta con `bg-surface`.

## 3. Diálogo de detalle

Un componente `StatDialog` (en `app/components/characters/sheet/`), con el mismo comportamiento que la ficha de conjuro (`SpellDialog`): `role="dialog"`, `aria-modal`, foco atrapado, Escape cierra, el foco vuelve al botón que lo abrió (capturado al pulsar), fondo oscurecido.

Contenido:
- **Título**: el nombre con su característica cuando aplica: «Engaño (Car)», «Salvación de Destreza», «Fuerza», «Clase de armadura», «Iniciativa», «Velocidad».
- **Descripción**: el texto en español de §5, en un recuadro como en Nivel20.
- **Desglose**: «Los modificadores que afectan a … son los siguientes:» y una tabla de filas `etiqueta | valor` con signo (`+3`, `−1`, `+0`) y una última fila **Total** en negrita. Para la Velocidad, los valores van en pies con su equivalencia en metros en el total.
- **Notas** (opcional): textos breves bajo la tabla, p. ej. el aviso de armadura sin competencia o «Valor pasivo: 13».

Un solo diálogo abierto a la vez; lo abre el `InfoTab` con el desglose ya calculado (no hay petición al servidor). Lo ven el dueño y el DM por igual (es solo lectura).

## 4. Desglose en las reglas

### 4.1 Tipo

En `lib/rules/dnd2024/derive/breakdown.ts` (puro, sin Next ni mongoose):

```ts
export type Part = { label: string; value: number };
export type Breakdown = { parts: Part[]; total: number; notes?: string[] };
```

Invariante: `total === sum(parts.value)` salvo cuando hay un tope; en ese caso se añade una parte negativa con la etiqueta «Máximo 20» (o «Máximo 30») para que la suma siga cuadrando.

### 4.2 Qué se desglosa

`Derived` gana un campo `breakdowns` (los valores numéricos existentes no cambian):

```ts
breakdowns: {
  abilities: Record<Ability, Breakdown>;   // puntuación
  saves: Record<Ability, Breakdown>;
  skills: Record<string, Breakdown>;       // por id de habilidad
  ac: Breakdown;
  initiative: Breakdown;
  speed: Breakdown;                        // en pies
}
```

- **Característica**: «Puntuación base» (de `baseAbilities`), «Trasfondo», una parte por cada mejora de característica con su nivel («Mejora de característica (nivel 4)»), una por dote con +1 («Dote: Alerta»), una por don épico («Don épico: …») y, si se aplica el tope, «Máximo 20/30». El total es la puntuación. Las notas dicen el modificador resultante («Modificador +3»).
- **Salvación**: «Modificador de <Característica>» y «Competencia» (o «Sin competencia» con +0).
- **Habilidad**: «Modificador de <Característica>», y «Competencia», «Pericia» (doble), «Polivalente» (§4.4) o «Sin competencia» (+0). Notas: valor pasivo `10 + total` en Percepción, Perspicacia e Investigación.
- **Iniciativa**: «Modificador de Destreza» y, con la dote Alerta, «Dote: Alerta» (+competencia).
- **CA**: la regla que gana, con sus partes: «Armadura: <nombre>» (CA base de la armadura), «Modificador de Destreza» (con «(máx. 2)» en la etiqueta si la armadura lo limita, u omitida si no admite Destreza); o «Sin armadura» 10 + Destreza; o «Defensa sin armadura (Bárbaro)» 10 + Destreza + Constitución; o «(Monje)» 10 + Destreza + Sabiduría. «Escudo» +2 si lo lleva. Notas: el aviso de armadura sin competencia (`armorWarning`).
- **Velocidad**: «Velocidad de <especie o legado>» y los bonificadores de §4.4.

Los desgloses se calculan en las mismas funciones que hoy calculan los valores (`abilityScores`, `saveRows`, `skillRows`, `armorClass`, y la iniciativa y velocidad de `derive/index.ts`), de modo que el valor y su desglose no se puedan separar: cada función devuelve el desglose y el valor sale de su `total`.

### 4.3 Nombres

Etiquetas en español; los nombres de dotes, armaduras, especies y clases salen de `nameEs ?? name` del catálogo, como en el resto de la ficha.

### 4.4 Huecos de reglas que se corrigen

El desglose hace visibles reglas del Manual 2024 que hoy no se suman. Se corrigen en esta parte, con pruebas:

- **Polivalente** (Bardo 2, «Jack of All Trades»): suma la mitad del bonificador por competencia, redondeando hacia abajo, a las pruebas de habilidad sin competencia ni pericia. Etiqueta «Polivalente».
- **Movimiento rápido** (Bárbaro 5, «Fast Movement»): +10 pies si no lleva armadura pesada.
- **Movimiento sin armadura** (Monje 2, «Unarmored Movement»): +10/15/20/25/30 pies según el nivel de Monje (columna de su tabla de clase; si falta, la progresión del Manual: 2–5 → 10, 6–9 → 15, 10–13 → 20, 14–17 → 25, 18–20 → 30) si no lleva armadura ni escudo.
- **Dote Veloz** («Speedy»): +10 pies.

Las claves de catálogo de estos rasgos y dotes van en constantes con nombre en el módulo, como `ALERT_FEAT`.

## 5. Descripciones

Archivo de datos `lib/rules/dnd2024/statTexts.ts` (o `.json`) con textos breves en español, propios, inspirados en el SRD 5.2.1 en español (CC BY 4.0), para:
- las 18 habilidades (qué cubre y ejemplos de uso),
- las 6 características,
- las tiradas de salvación (un texto común con el nombre de la característica),
- Clase de armadura, Iniciativa y Velocidad.

Si falta el texto de una habilidad, se usa la descripción del catálogo (`kind: "skill"`, `descriptionEs || description`), cargada con las demás entradas de la ficha.

## 6. Errores y casos límite

- Personaje con hoja v1 o sin catálogo: el diálogo muestra lo que haya; un desglose vacío muestra solo el Total.
- Característica por encima del tope: la parte «Máximo 20» lo compensa (§4.1).
- Armadura sin competencia: la CA no cambia; el aviso aparece en la ficha de CA (icono) y en las notas del diálogo.
- Sin JavaScript (impresión): los botones se imprimen como texto; el diálogo no se imprime.

## 7. Pruebas

- **Unitarias** (vitest, `tests/dnd2024/breakdown.test.ts`): para cada desglose, `sum(parts) === total` y el total coincide con el valor de `Derived`. Casos: característica con trasfondo, mejora a nivel 4, dote con +1 y tope de 20; habilidad con pericia; Bardo 2 sin competencia → «Polivalente» +1; Alerta en la iniciativa; CA con armadura media (Destreza máx. 2) y escudo; Defensa sin armadura de Bárbaro y de Monje; Bárbaro 5 con y sin armadura pesada; Monje 6 con y sin armadura; dote Veloz.
- **Navegador**: como dueño, pulsar una característica, una salvación, una habilidad, CA, Iniciativa y Velocidad; Escape y foco de vuelta; a 375 px sin desplazamiento horizontal. La vista del DM se revisa en el código (`isOwner` solo afecta a `HpEditor`).

## 8. Archivos

- Crear: `lib/rules/dnd2024/derive/breakdown.ts`, `lib/rules/dnd2024/statTexts.ts`, `app/components/characters/sheet/StatDialog.tsx`, `tests/dnd2024/breakdown.test.ts`.
- Modificar: `lib/rules/dnd2024/derive/abilities.ts`, `derive/ac.ts`, `derive/index.ts`, `app/components/characters/sheet/InfoTab.tsx`.
