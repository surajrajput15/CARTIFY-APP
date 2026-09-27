import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import react from 'eslint-plugin-react'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // .tmp_smoke_profile is a throwaway Chrome profile from smoke runs; p0*/tmp_* .mjs
  // are one-off debug probes (all gitignored).
  globalIgnores(['dist', 'coverage', '.tmp_smoke_profile', 'p0*.mjs', 'tmp_*.mjs', '_tmp_smoke']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: {
      react,
    },
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      'react/jsx-no-undef': 'error',
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/jsx-key': 'warn',
      'react/no-unescaped-entities': 'off',
      'react/prop-types': 'off',
      // The omit-idiom (`const { keep, ...rest } = x`) and `_`-prefixed throwaway
      // params are intentional (DEC/F-05).
      'no-unused-vars': ['error', {
        args: 'after-used',
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
    },
  },
  // Test files run under Vitest, which provides globals like `vi`, `describe`, `it`.
  {
    files: ['src/**/*.test.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        vi: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
      },
    },
  },
  // Vercel serverless functions (api/*) run in Node.js, not the browser.
  {
    files: ['api/**/*.{js,jsx}'],
    languageOptions: {
      globals: globals.node,
    },
  },
  // Context files intentionally export a Provider component AND a consumer hook together —
  // a widespread, working React pattern. The fast-refresh rule is not applicable to them.
  {
    files: ['src/context/**/*.{js,jsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
