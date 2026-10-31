import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Capas: las páginas y rutas de app/ piden los datos a lib/server, nunca a los modelos de Mongoose
const noModels = [
  { group: ["@/lib/models/*", "**/lib/models/*"], message: "Usa un servicio de lib/server/<dominio> en lugar del modelo." },
  { group: ["mongoose"], message: "Usa un servicio de lib/server/<dominio>; para ids, lib/server/ids." },
];
const noServer = {
  group: ["@/lib/server/*", "**/lib/server/*"],
  message: "Este código no importa código de servidor.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["app/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": ["error", { patterns: noModels }] },
  },
  // Los componentes no importan código de servidor (los tipos compartidos viven en lib/shared)
  {
    files: ["app/components/**/*.{ts,tsx}"],
    ignores: ["app/components/proxy.ts"], // no es un componente: se queda aquí sin activar (ver la spec, §2.6)
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...noModels,
            { ...noServer, message: "Los componentes no importan código de servidor; pásale los datos desde la página." },
          ],
        },
      ],
    },
  },
  // Las reglas y lo compartido son puros: ni servidor, ni modelos, ni mongoose, ni next
  {
    files: ["lib/rules/**/*.{ts,tsx}", "lib/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...noModels,
            { ...noServer, message: "lib/rules y lib/shared son puros: no importan código de servidor." },
            { group: ["next", "next/*"], message: "lib/rules y lib/shared son puros: no dependen de Next.js." },
          ],
        },
      ],
    },
  },
  // Los modelos no dependen de los servicios
  {
    files: ["lib/models/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ ...noServer, message: "Los modelos no importan servicios de lib/server." }] },
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
