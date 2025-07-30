import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import jest from 'eslint-plugin-jest'
import { globalIgnores } from "eslint/config"

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      'semi': ['error', 'never']
    }
  },
  {
    files: ['**/__tests__/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
    plugins: {
      jest
    },
    languageOptions: {
      globals: jest.environments.globals.globals
    },
    rules: {
      ...jest.configs.recommended.rules
    }
  },
  globalIgnores([
    'ecosystem.config.js'
  ])
)