// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Normalize path separators for cross-platform compatibility.
//
// `import.meta.dirname` returns OS-native separators: backslashes on Windows
// (e.g. C:\Users\...) and forward slashes on Linux/macOS (/home/runner/...).
//
// TypeScript resolves tsconfig paths using forward slashes internally via its
// own `normalizePath()`. When `project` receives a backslash path from Node on
// Windows, TypeScript's internal assertion `resolvedPath === normalizedPath`
// fails with "Debug Failure. Expected A === B".
//
// Converting to forward slashes before passing the path to `parserOptions`
// ensures TypeScript receives a path it has already normalised, eliminating
// the mismatch on both Windows and Linux CI runners.
const rootDir = import.meta.dirname.replace(/\\/g, '/');

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: {
          defaultProject: 'tsconfig.eslint.json',
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
);
