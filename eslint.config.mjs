import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import { designTokenRules } from './tools/eslint-rules/design-token-rules.mjs';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/.next/**', '**/generated/**'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['apps/marketplace-web/src/**/*.{ts,tsx}', 'apps/backoffice-web/src/**/*.{ts,tsx}'],
    plugins: {
      'design-tokens': {
        rules: designTokenRules,
      },
    },
    rules: {
      'design-tokens/no-primitive-color': 'error',
      'design-tokens/no-arbitrary-design-value': 'error',
    },
  },
  prettierConfig,
);
