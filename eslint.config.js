/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const eslint = require('@eslint/js')
const tseslint = require('typescript-eslint')
const eslintConfigPrettier = require('eslint-config-prettier')

module.exports = tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    ignores: ['node_modules/', 'dist/', 'js/', '*.json']
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    }
  }
)
