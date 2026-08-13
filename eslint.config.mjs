// Minimal config aimed at one job: catching undefined references.
//
// The customer/admin split moved code between modules, and a name that moved
// without its import is valid JavaScript until it executes - the bundler builds
// it happily and it fails as a white screen at runtime. `no-undef` finds these
// statically. Run with: npx eslint src --no-warn-ignored
import globals from "globals";

export default [
  {
    files: ["src/**/*.jsx", "src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.browser, React: "readonly" },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    linterOptions: { reportUnusedDisableDirectives: false },
    rules: {
      "no-undef": "error",
    },
  },
];
