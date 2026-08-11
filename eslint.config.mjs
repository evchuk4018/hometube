import eslint from "@eslint/js";
import typescriptParser from "@typescript-eslint/parser";

export default [
  { ignores: [".next/**", "node_modules/**", "coverage/**"] },
  eslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } }
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-redeclare": "off"
    }
  }
];
