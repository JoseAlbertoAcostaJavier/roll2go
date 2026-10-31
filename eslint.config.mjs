import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Capas: las páginas y rutas de app/ piden los datos a lib/server, nunca a los modelos de Mongoose
const noModels = [
  { group: ["@/lib/models/*"], message: "Usa un servicio de lib/server/<dominio> en lugar del modelo." },
  { group: ["mongoose"], message: "Usa un servicio de lib/server/<dominio>; para ids, lib/server/ids." },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["app/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": ["error", { patterns: noModels }] },
  },
  // Los componentes solo pueden tomar tipos de lib/server (el código de servidor no llega al navegador)
  {
    files: ["app/components/**/*.{ts,tsx}"],
    ignores: ["app/components/proxy.ts"], // no es un componente: se queda aquí sin activar (ver la spec, §2.6)
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...noModels,
            {
              group: ["@/lib/server/*"],
              allowTypeImports: true,
              message: "Los componentes no importan código de servidor; pásale los datos desde la página.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
