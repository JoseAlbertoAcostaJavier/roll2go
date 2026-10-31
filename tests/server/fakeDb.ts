// Base de datos falsa para probar los servicios de lib/server. Cada modelo es un Proxy: cualquier método (find,
// findOne, updateOne, countDocuments…) registra la llamada y devuelve una consulta encadenable (select, sort, lean…)
// que resuelve el resultado configurado en `results["Modelo.método"]` (un valor o una función de los argumentos).
// Se crea dentro de vi.hoisted: `const db = await vi.hoisted(async () => (await import("./fakeDb")).createFakeDb());`
export function createFakeDb() {
  const calls: { model: string; op: string; args: unknown[] }[] = [];
  const results: Record<string, unknown> = {};

  const query = (value: unknown) => {
    const q: Record<string, unknown> = {
      lean: async () => value,
      then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(value).then(ok, ko),
    };
    for (const step of ["select", "sort", "collation", "limit", "skip"]) q[step] = () => q;
    return q;
  };

  const model = (name: string) =>
    new Proxy(
      {},
      {
        get: (_target, op) =>
          typeof op !== "string" || op === "then"
            ? undefined
            : (...args: unknown[]) => {
                calls.push({ model: name, op, args });
                const r = results[`${name}.${op}`];
                return query(typeof r === "function" ? r(...args) : r);
              },
      },
    );

  // Argumentos de cada llamada a `Modelo.método`
  const callsOf = (name: string, op: string) => calls.filter((c) => c.model === name && c.op === op).map((c) => c.args);

  const reset = () => {
    calls.length = 0;
    for (const key of Object.keys(results)) delete results[key];
  };

  return { results, model, callsOf, reset };
}
