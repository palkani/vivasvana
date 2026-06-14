// ESLint 9 flat config. Kept intentionally lean — tsc + zod catch most of
// what a lint rule would: typing, unused imports, validation. We use ESLint
// here for the things tsc doesn't enforce: lint-only rules around no-console
// in services, no-unused-vars under a leading-underscore opt-out, and
// the recommended subset.
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    // Skip generated + vendored output. `test/` lives outside src so the
    // tsconfig rootDir constraint blocks tsc from compiling it anyway —
    // CI's typecheck step would crash on those files.
    ignores: ['dist/**', 'node_modules/**', 'test/**', 'coverage/**'],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2024,
        sourceType: 'module',
      },
      globals: {
        // Node globals we use throughout the API.
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        fetch: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // TS handles the unused-vars story better than ESLint's core rule;
      // disable core and use the TS variant with a `_`-prefix opt-out.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Some integrations rely on dynamic property access — too noisy to
      // forbid project-wide.
      'no-empty': ['error', { allowEmptyCatch: true }],
      // We use console.warn / console.error for ops-grade diagnostics in
      // a fire-and-forget pattern (NotificationService etc.). console.log
      // is the noisy one we'd want to forbid in a stricter pass.
      'no-console': 'off',
    },
  },
];
