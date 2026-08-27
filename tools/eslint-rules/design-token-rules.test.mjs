import assert from 'node:assert/strict';
import test from 'node:test';
import { Linter } from 'eslint';
import { designTokenRules } from './design-token-rules.mjs';

function lint(code, ruleId) {
  const linter = new Linter();
  return linter.verify(code, [
    {
      languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
      plugins: { 'design-tokens': { rules: designTokenRules } },
      rules: { [ruleId]: 'error' },
    },
  ]);
}

test('rejects primitive Tailwind color utilities', () => {
  const messages = lint(
    "const className = 'bg-blue-500 text-white';",
    'design-tokens/no-primitive-color',
  );

  assert.equal(messages.length, 2);
});

test('rejects primitive colors behind variants, opacity modifiers, and directional utilities', () => {
  const messages = lint(
    "const className = 'hover:border-t-red-500 bg-black/[.5] dark:text-white';",
    'design-tokens/no-primitive-color',
  );

  assert.equal(messages.length, 3);
});

test('rejects arbitrary CSS color properties', () => {
  const messages = lint(
    "const className = '[color:#fff] [background-color:rgb(1,2,3)]';",
    'design-tokens/no-primitive-color',
  );

  assert.equal(messages.length, 2);
});

test('accepts semantic Tailwind color utilities', () => {
  const messages = lint(
    "const className = 'bg-primary text-primary-foreground';",
    'design-tokens/no-primitive-color',
  );

  assert.equal(messages.length, 0);
});

test('rejects arbitrary color, spacing, and typography values', () => {
  const messages = lint(
    "const className = 'bg-[#111111] p-[18px] text-[13px] font-[Inter]';",
    'design-tokens/no-arbitrary-design-value',
  );

  assert.equal(messages.length, 4);
});

test('accepts named spacing and typography tokens', () => {
  const messages = lint(
    "const className = 'p-page-gutter gap-content text-body font-sans';",
    'design-tokens/no-arbitrary-design-value',
  );

  assert.equal(messages.length, 0);
});
