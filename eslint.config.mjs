import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "**/.next/**",
    ".claude/**",
    ".codex/**",
    "tmp/**",
    "out/**",
    "**/out/**",
    "build/**",
    "**/build/**",
    "next-env.d.ts",
  ]),
  // Downgrade react-hooks v5 strict rules and no-explicit-any to warnings.
  // These rules were introduced/tightened in eslint-config-next 16 and flag
  // pre-existing patterns across the whole codebase. Address them incrementally.
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@next/next/no-img-element": "warn",
    },
  },
]);

export default eslintConfig;
