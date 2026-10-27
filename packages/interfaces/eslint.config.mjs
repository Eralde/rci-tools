// @ts-check

import eslint from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import {defineConfig} from 'eslint/config';
import jsdoc from 'eslint-plugin-jsdoc';
import tseslint from 'typescript-eslint';

/** @typedef {import('eslint').Linter.RulesRecord} RulesRecord */

const OFF = 'off';
const WARN = 'warn';
const ERROR = 'error';

// Rules ported from the mndw ESLint config.
// Formatting is up to dprint; the core formatting rules deprecated in ESLint 9 are replaced with `@stylistic/*`.
/** @type {RulesRecord} */
const JS_RULES = {
  'complexity': OFF,
  'constructor-super': ERROR,
  'curly': ERROR,
  'eqeqeq': [ERROR, 'always'],
  'guard-for-in': ERROR,
  'id-denylist': [WARN, 'e', 'cb', 'x'],
  'max-classes-per-file': OFF,
  'max-lines-per-function': [WARN, {max: 75}],
  'no-bitwise': ERROR,
  'no-caller': ERROR,
  'no-cond-assign': ERROR,
  'no-debugger': ERROR,
  'no-duplicate-imports': ERROR,
  'no-empty': OFF,
  'no-eval': ERROR,
  'no-fallthrough': ERROR,
  'no-invalid-this': OFF,
  'no-new-wrappers': ERROR,
  'no-restricted-imports': [ERROR, 'rxjs/Rx'],
  'no-throw-literal': ERROR,
  'no-undef-init': ERROR,
  'no-underscore-dangle': OFF,
  'no-unsafe-finally': ERROR,
  'no-unused-labels': ERROR,
  'no-useless-escape': OFF,
  'no-var': ERROR,
  'object-shorthand': OFF,
  'one-var': OFF,
  'prefer-const': ERROR,
  'radix': ERROR,
  'sort-keys': OFF,
  'use-isnan': ERROR,
  'valid-typeof': OFF,

  'jsdoc/check-alignment': ERROR,
  'jsdoc/no-types': ERROR,

  '@stylistic/eol-last': ERROR,
  '@stylistic/member-delimiter-style': [
    ERROR,
    {
      multiline: {delimiter: 'semi', requireLast: true},
      singleline: {delimiter: 'semi', requireLast: false},
    },
  ],
  '@stylistic/new-parens': ERROR,
  '@stylistic/newline-per-chained-call': WARN,
  '@stylistic/no-trailing-spaces': [ERROR, {ignoreComments: true}],
  '@stylistic/object-curly-spacing': [ERROR, 'never'],
  '@stylistic/padding-line-between-statements': [
    WARN,
    {blankLine: 'always', prev: '*', next: 'return'},
    {blankLine: 'always', prev: 'block-like', next: ['const', 'let']},
    {blankLine: 'always', prev: '*', next: ['const', 'let', 'var', 'export']},
    {blankLine: 'always', prev: ['const', 'let', 'var', 'export'], next: '*'},
    {blankLine: 'any', prev: ['const', 'let', 'var', 'export'], next: ['const', 'let', 'var', 'export']},
    {blankLine: 'always', prev: '*', next: ['if', 'class', 'for', 'do', 'while', 'switch', 'try']},
    {blankLine: 'always', prev: ['if', 'class', 'for', 'do', 'while', 'switch', 'try'], next: '*'},
  ],
  '@stylistic/quote-props': [WARN, 'consistent-as-needed'],
  '@stylistic/quotes': [ERROR, 'single'],
  '@stylistic/spaced-comment': [ERROR, 'always', {markers: ['/']}],
  '@stylistic/type-annotation-spacing': ERROR,
};

/** @type {RulesRecord} */
const TS_RULES = {
  '@typescript-eslint/array-type': OFF,
  '@typescript-eslint/consistent-type-assertions': OFF,
  '@typescript-eslint/dot-notation': WARN,
  '@typescript-eslint/explicit-member-accessibility': [
    WARN,
    {accessibility: 'explicit', overrides: {constructors: 'no-public'}},
  ],
  '@typescript-eslint/member-ordering': OFF,
  '@typescript-eslint/naming-convention': [
    ERROR,
    {selector: 'variable', format: ['camelCase', 'UPPER_CASE'], filter: 'NDM'},
    {selector: 'enum', format: ['UPPER_CASE']},
    {selector: 'class', format: ['StrictPascalCase'], leadingUnderscore: 'allow'},
    {selector: 'interface', format: ['StrictPascalCase'], leadingUnderscore: 'allow'},
  ],
  '@typescript-eslint/no-deprecated': WARN,
  '@typescript-eslint/no-empty-function': OFF,
  // traits and entities declare `interface X extends Y {}` + `class X extends Y implements X` (ts-mixer)
  '@typescript-eslint/no-empty-object-type': [ERROR, {allowInterfaces: 'with-single-extends'}],
  '@typescript-eslint/no-explicit-any': OFF,
  '@typescript-eslint/no-inferrable-types': OFF,
  '@typescript-eslint/no-non-null-assertion': ERROR,
  '@typescript-eslint/no-redundant-type-constituents': OFF, // incorrectly handles `<some_type> | null`
  '@typescript-eslint/no-shadow': ERROR,
  '@typescript-eslint/no-unsafe-assignment': OFF,
  '@typescript-eslint/no-unsafe-declaration-merging': OFF, // same ts-mixer pattern
  '@typescript-eslint/no-unused-vars': [
    ERROR,
    {
      args: 'all',
      argsIgnorePattern: '^_',
      caughtErrors: 'all',
      caughtErrorsIgnorePattern: '^_',
      destructuredArrayIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      ignoreRestSiblings: true,
    },
  ],
  '@typescript-eslint/no-use-before-define': WARN,
  '@typescript-eslint/non-nullable-type-assertion-style': OFF, // conflicts with `no-non-null-assertion`
  '@typescript-eslint/prefer-nullish-coalescing': OFF,
  '@typescript-eslint/prefer-regexp-exec': OFF,
  '@typescript-eslint/restrict-plus-operands': OFF,
  '@typescript-eslint/restrict-template-expressions': OFF,
  '@typescript-eslint/unbound-method': [ERROR, {ignoreStatic: true}],
  '@typescript-eslint/unified-signatures': ERROR,
  'dot-notation': OFF,
  'no-shadow': OFF,
  'no-use-before-define': OFF,
};

export default defineConfig(
  {ignores: ['dist/**']},
  {
    files: ['src/**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      jsdoc,
      '@stylistic': stylistic,
    },
    rules: {
      ...JS_RULES,
      ...TS_RULES,
    },
  },
);
