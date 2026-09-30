import { NextRequest, NextResponse } from "next/server";

// GET /api/roll?dice=2d6%2B3
export function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("dice") ?? "").replace(/\s/g, "");
  const m = /^(\d{1,2})d(\d{1,3})([+-]\d{1,4})?$/i.exec(raw);
  if (!m) {
    return NextResponse.json(
      { error: "Formato no válido. Prueba con 1d20, 2d6+3 o 4d8-1." },
      { status: 400 }
    );
  }
  const count = Number(m[1]);
  const sides = Number(m[2]);
  const modifier = Number(m[3] ?? 0);
  if (count < 1 || count > 50 || sides < 2) {
    return NextResponse.json(
      { error: "Usa entre 1 y 50 dados de 2 o más caras." },
      { status: 400 }
    );
  }
  const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
  const total = rolls.reduce((a, b) => a + b, 0) + modifier;
  return NextResponse.json({ dice: `${count}d${sides}${m[3] ?? ""}`, sides, rolls, modifier, total });
}
