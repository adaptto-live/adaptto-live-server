/* eslint-env node */
require('@rushstack/eslint-patch/modern-module-resolution')

module.exports = {
  root: true,
  'extends': [
    'eslint:recommended',
    'eslint-config-typescript'
  ],
  parserOptions: {
    ecmaVersion: 'latest'
  },
  ignorePatterns: ["ecosystem.config.js"]
}
