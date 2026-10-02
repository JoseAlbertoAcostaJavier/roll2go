import { NextRequest, NextResponse } from "next/server";
/*
  Esta API maneja las solicitudes GET para lanzar dados.
  Aunque ahora mismo es simple, y lo único que hace es tiradas de dados, a futuro podría ampliarse esta API para
  incluir más funcionalidades relacionadas con la creación de fichas de personajes, en específico, como en el caso
  de hacer las tiradas de características al crear un personaje, el hitdice, incluso la tirada de iniciativa, de
  habilidades, etc. 
*/
// GET /api/roll?dice=2d6%2B3
export function GET(req: NextRequest) {
  /*
  raw es la expresión de dados que se obtiene de la query string. 
  De /api/roll?dice=2d6%2B3, quita los espacios, de ahi 2d6 +3 hace
  que valga lo mismo que 2d6+3.
  */
  const raw = (req.nextUrl.searchParams.get("dice") ?? "").replace(/\s/g, "");
  /*
  m valida el formato con una expresiób regular
  Se lee de la siguiente manera; de uno a dos digitos (¿Cuántos dados?),
  una d, de uno a tres digitos (¿Cuántas caras?) y de manera opcional, un
  + o - seguido de un modificador. cada parentesis queda guardado en,
  m[1], m[2] y m[3] respectivamente. Si el texto no encaja con este formato
  entonces m es null y se devuelve un error. La i al final del codigo permite
  que si la D está en mayúscula, también se acepte. Por ejemplo 2D6+3 
  es lo mismo que 2d6+3.
  */
  const m = /^(\d{1,2})d(\d{1,3})([+-]\d{1,4})?$/i.exec(raw);
  if (!m) {
    return NextResponse.json(
      { error: "Formato no válido. Prueba con 1d20, 2d6+3 o 4d8-1." },
      { status: 400 },
    );
  }
  const count = Number(m[1]);
  const sides = Number(m[2]);
  const modifier = Number(m[3] ?? 0);
  if (count < 1 || count > 99 || sides < 2) {
    return NextResponse.json(
      { error: "Usa entre 1 y 99 dados de 2 o más caras." },
      { status: 400 },
    );
  }
/*
  rolls es una lista con tantos elementos como dados
  y rellena cada uno con un número aleatorio haciendo uso de Math.random()
  . Esto da un número entre 1 y 0 multiplicado por las caras
*/
  const rolls = Array.from(
    { length: count },
    () => 1 + Math.floor(Math.random() * sides),
  );
  //Suma el array de rolls y le suma el valor del modificador.
  const total = rolls.reduce((a, b) => a + b, 0) + modifier;
  return NextResponse.json({
    dice: `${count}d${sides}${m[3] ?? ""}`,
    sides,
    rolls,
    modifier,
    total,
  });
}
