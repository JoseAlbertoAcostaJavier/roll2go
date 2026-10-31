import { NextRequest, NextResponse } from "next/server";
import { sessionOf } from "@/lib/server/campaigns/campaignApi";
import { officialNameTables } from "@/lib/server/catalog/nameTables";
import { rateLimit, tooManyRequests } from "@/lib/server/rateLimit";
import { generateName, nameTableFor, PRONOUNS, type Pronoun } from "@/lib/rules/dnd2024/creation/names";

const SYSTEM = "dnd-2024";

// ?species=dwarf&pronouns=he,they → { name }: «Nombre Apellido» según la especie (o Humano) y los pronombres
export async function GET(req: NextRequest) {
  const session = await sessionOf(req);
  if (!session) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const limited = await rateLimit("name_generator", session.id, 600, 3600);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const sp = req.nextUrl.searchParams;
  const species = (sp.get("species") ?? "").trim().toLowerCase().slice(0, 80);
  const pronouns = (sp.get("pronouns") ?? "").split(",")
    .filter((p): p is Pronoun => PRONOUNS.some((x) => x.id === p));

  // Las tablas de los libros oficiales del sistema, sin depender de los libros elegidos para el personaje
  const tables = await officialNameTables(SYSTEM);
  const table = nameTableFor(tables, species);
  const name = table ? generateName(table, [...new Set(pronouns)]) : "";
  if (!name) return NextResponse.json({ error: "No hay tablas de nombres disponibles." }, { status: 404 });
  return NextResponse.json({ name });
}
