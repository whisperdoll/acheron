import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import pluginHooks from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";

export default defineConfig([
  js.configs.recommended,
  tseslint.configs.recommended,
  pluginReact.configs.flat["jsx-runtime"],
  pluginHooks.configs["recommended-latest"],
  {
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "off",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-unused-expressions": ["off"],
    },
  },
  {
    ignores: [".erb/dll/renderer.dev.dll.js", "bin/*", "dist/**/*"],
  },
  {
    files: ["src/tokens/*"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
]);
