import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import js from '@eslint/js';
import prettierRecommended from 'eslint-config-prettier';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import importX, { createNodeResolver } from 'eslint-plugin-import-x';
import jsdoc from 'eslint-plugin-jsdoc';
import noSecrets from 'eslint-plugin-no-secrets';
import prettierPlugin from 'eslint-plugin-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Helper: discover every lintable workspace that has a `tsconfig.json`.
 *
 * `packages/*` are npm workspaces; `plugin/` is the Claude Code mod, which is not a
 * workspace but carries its own `plugin/tsconfig.json` purely so ESLint can type-check
 * `plugin/hooks`. Each returned entry drives one type-aware config block below.
 */
function findWorkspaceTSConfigs() {
  const candidates = [
    ...(fs.existsSync(path.resolve(__dirname, 'packages'))
      ? fs
          .readdirSync(path.resolve(__dirname, 'packages'))
          .map((name) => path.posix.join('packages', name))
      : []),
    'plugin',
  ];

  return candidates
    .map((dir) => {
      const tsconfigPath = path.resolve(__dirname, dir, 'tsconfig.json');
      return fs.existsSync(tsconfigPath) ? { dir, tsconfig: tsconfigPath } : null;
    })
    .filter(Boolean);
}

/**
 * Helper: convert all `warn` severity levels to `error` in a rules object.
 */
function warnToError(rules) {
  return Object.fromEntries(
    Object.entries(rules).map(([key, value]) => {
      if (value === 'warn') return [key, 'error'];
      if (Array.isArray(value) && value[0] === 'warn') return [key, ['error', ...value.slice(1)]];
      return [key, value];
    })
  );
}

// `parseInt`'s second argument is the radix, not a fallback. The core `radix` rule only catches
// a *missing* radix (it accepts any identifier), so it does not see `parseInt(v, DEFAULT_SIZE)`,
// which only works while that constant happens to be 10. These selectors catch every
// non-literal-10 radix, on both `parseInt` and `Number.parseInt`. A genuine non-decimal parse
// takes an inline eslint-disable-next-line with a reason. Shared so any override that replaces
// `no-restricted-syntax` wholesale can re-spread it and keep the guard.
const RADIX_MESSAGE =
  "parseInt's second argument is the radix, not a fallback — pass the literal 10. " +
  'For a deliberate non-decimal parse, disable this rule inline with a reason.';

const noWrongRadixSelectors = [
  {
    selector: 'CallExpression[callee.name=parseInt][arguments.length=2][arguments.1.value!=10]',
    message: RADIX_MESSAGE,
  },
  {
    selector:
      'CallExpression[callee.property.name=parseInt][arguments.length=2][arguments.1.value!=10]',
    message: RADIX_MESSAGE,
  },
];

const baseRules = {
  ...warnToError(prettierPlugin.configs.recommended.rules),
  'prettier/prettier': 'error',
  'arrow-body-style': 'off',
  'prefer-arrow-callback': 'off',
  '@typescript-eslint/consistent-type-definitions': 'error',
  '@typescript-eslint/dot-notation': 'off',
  '@typescript-eslint/no-use-before-define': 'error',
  '@typescript-eslint/naming-convention': [
    'error',
    {
      selector: ['default'],
      format: ['camelCase'],
      leadingUnderscore: 'allow',
    },
    {
      selector: 'import',
      format: ['camelCase', 'PascalCase'],
    },
    {
      selector: ['enumMember'],
      format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
    },
    {
      selector: ['function'],
      format: ['PascalCase', 'camelCase'],
    },
    {
      selector: ['classProperty'],
      format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
      modifiers: ['const', 'readonly'],
    },
    {
      selector: ['property'],
      format: ['camelCase', 'PascalCase'],
      leadingUnderscore: 'allow',
    },
    {
      selector: ['typeLike'],
      format: ['PascalCase', 'UPPER_CASE'],
    },
    {
      selector: ['variable'],
      format: ['camelCase', 'PascalCase'],
      leadingUnderscore: 'allow',
    },
    {
      selector: ['variable'],
      format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
      modifiers: ['const'],
      leadingUnderscore: 'allow',
    },
    {
      selector: ['objectLiteralProperty'],
      format: null,
    },
  ],
  '@typescript-eslint/ban-tslint-comment': 'error',
  'no-console': ['error', { allow: ['warn', 'error'] }],
  'no-empty': 'error',
  'no-useless-constructor': 'off',
  'comma-dangle': [
    'error',
    {
      arrays: 'always-multiline',
      objects: 'always-multiline',
      imports: 'always-multiline',
      exports: 'always-multiline',
      functions: 'never',
    },
  ],
  'no-trailing-spaces': 'error',
  '@typescript-eslint/no-misused-new': 'error',
  '@typescript-eslint/no-non-null-assertion': 'error',
  'no-eval': 'error',
  'no-debugger': 'error',
  'no-caller': 'error',
  'no-bitwise': 'error',
  // Catches `parseInt(x)` with no radix at all. The *wrong*-radix half is enforced by
  // `noWrongRadixSelectors` above.
  radix: 'error',
  'spaced-comment': ['error', 'always'],
  complexity: 'error',
  eqeqeq: ['error', 'always'],
  'eol-last': ['error', 'always'],
  'object-curly-spacing': ['error', 'always'],
  '@typescript-eslint/explicit-member-accessibility': ['off', { accessibility: 'explicit' }],
  '@typescript-eslint/no-inferrable-types': 'off',
  'brace-style': 'off',
  'id-blacklist': 'off',
  'id-match': 'off',
  'max-len': [
    'error',
    {
      ignorePattern: '^import [^,]+ from |^export | implements',
      code: 140,
    },
  ],
  'no-underscore-dangle': 'off',
  // `claude-code` / `claude-code/testing` are engine-provided modules with no npm package
  // (the mod loads inside the Claude Code engine); nothing on disk resolves them.
  'import-x/no-unresolved': ['error', { ignore: ['^claude-code(/|$)'] }],
  'import-x/order': [
    'error',
    {
      groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object'],
      pathGroups: [
        {
          // workspace package (@ccstatus/core) sorts after third-party packages
          pattern: '@ccstatus/**',
          group: 'external',
          position: 'after',
        },
      ],
      'newlines-between': 'always',
      alphabetize: { order: 'asc', caseInsensitive: true },
      named: {
        enabled: true,
        types: 'types-last',
      },
    },
  ],
  'unused-imports/no-unused-imports': 'error',
  'unused-imports/no-unused-vars': 'error',
  curly: 'error',
  '@typescript-eslint/member-ordering': 'error',
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/explicit-function-return-type': 'error',
  '@typescript-eslint/explicit-module-boundary-types': 'error',
  // Enforce `import type` for type-only imports (permanent guard against verbatimModuleSyntax
  // drift). Auto-fixable.
  '@typescript-eslint/consistent-type-imports': [
    'error',
    {
      prefer: 'type-imports',
      fixStyle: 'separate-type-imports',
      // Allow inline `import()` type queries (e.g. `vi.importActual<typeof import('...')>()` in
      // test mocks); they cannot be hoisted to a top-level `import type`.
      disallowTypeAnnotations: false,
    },
  ],
  // File/function length caps as a non-blocking ratchet ('warn'): they flag genuinely oversized
  // modules without nagging on moderately large ones. Disabled for test files (see override below).
  'max-lines': ['warn', { max: 800, skipBlankLines: true, skipComments: true }],
  'max-lines-per-function': [
    'warn',
    { max: 500, skipBlankLines: true, skipComments: true, IIFEs: true },
  ],
  'no-restricted-syntax': ['error', ...noWrongRadixSelectors],
  'prefer-const': 'error',
  'jsdoc/check-line-alignment': ['error', 'always'],
  'jsdoc/no-blank-block-descriptions': ['error'],
  'jsdoc/no-blank-blocks': ['error'],
  'jsdoc/require-description-complete-sentence': ['error'],
  'no-secrets/no-secrets': ['error', { tolerance: 4.2 }],
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      'eslint.config.mjs',
      '.superpowers/**',
      // Generated plugin bundle: tsup output, committed but never hand-edited/linted.
      // See DEC-0003, DEC-0010, DEC-0012.
      'plugin/hooks/core.js',
      'plugin/hooks/core.d.ts',
    ],
  },
  ...[
    js.configs.recommended,
    ...tseslint.configs.recommended,
    ...tseslint.configs.stylistic,
    // `recommended-typescript` (not plain `recommended`): keeps require-jsdoc and the param/
    // return *description* rules, but drops the `{type}` tag requirements — TypeScript already
    // carries the types, so jsdoc type tags would be redundant. See the `jsdoc` settings below.
    jsdoc.configs['flat/recommended-typescript'],
    prettierRecommended,
  ].map((cfg) => (cfg.rules ? { ...cfg, rules: warnToError(cfg.rules) } : cfg)),
  {
    languageOptions: {
      // Everything here runs on Node (core, the Ink TUI, the mod, and build/test config).
      globals: { ...globals.node },
      parserOptions: {
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      'unused-imports': unusedImports,
      'import-x': importX,
      'no-secrets': noSecrets,
      prettier: prettierPlugin,
    },
    rules: baseRules,
    settings: {
      // TypeScript carries the types, so jsdoc tags omit `{type}` — `mode: 'typescript'`
      // stops the require-*-type rules from demanding redundant annotations.
      jsdoc: { mode: 'typescript' },
      'import-x/resolver-next': [createNodeResolver()],
    },
  },

  // One config per workspace tsconfig.json: type-aware parsing and TypeScript import resolution.
  ...findWorkspaceTSConfigs().map(({ dir, tsconfig }) => {
    return {
      // `.mts`/`.cts` included so ESM/CJS-explicit modules get the same parser service and
      // import resolver as the rest of the workspace.
      files: [`${dir}/**/*.{ts,tsx,mts,cts}`],
      // Build/test config files live at a workspace root and are not in its tsconfig
      // `include`, so the type-aware project service cannot see them — lint them with the
      // base (non-type-aware) config instead.
      ignores: ['**/*.config.{ts,mts,cts}'],
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir: __dirname,
        },
      },
      settings: {
        'import-x/resolver-next': [
          createTypeScriptImportResolver({ alwaysTryTypes: true, project: tsconfig }),
          createNodeResolver({ extensions: ['.ts', '.tsx', '.js', '.mjs', '.cjs'] }),
        ],
      },
    };
  }),

  // The TUI is React (Ink). Enforce the Rules of Hooks on its components.
  {
    files: ['packages/tui/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // Test files legitimately have long describe/it callbacks and large fixtures: exempt them from
  // the file/function length ratchet, which targets production source.
  {
    files: [
      '**/*.{test,spec}.{ts,tsx,js,mjs}',
      '**/__tests__/**/*.{ts,tsx,js,mjs}',
      '**/integration/**/*.{ts,tsx}',
    ],
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off',
    },
  }
);
