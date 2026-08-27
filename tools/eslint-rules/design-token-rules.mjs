const PRIMITIVE_COLOR_PATTERN =
  /^(?:(?:bg|text|border(?:-[trblxy])?|ring|outline|fill|stroke|from|via|to|decoration|shadow|caret|accent|divide(?:-[xy])?|placeholder)-(?:black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{2,3})?(?:\/(?:\d{1,3}|\[[^\]]+\]))?|\[(?:color|background-color|border-color|outline-color|fill|stroke):[^\]]+\])$/;

const ARBITRARY_DESIGN_VALUE_PATTERN =
  /^(?:bg|text|border|ring|outline|fill|stroke|from|via|to|decoration|shadow|p[trblxy]?|m[trblxy]?|gap|space-[xy]|w|h|min-w|min-h|max-w|max-h|size|inset(?:-[xy])?|top|right|bottom|left|font|leading|tracking)-\[/;

function classUtilities(value) {
  return value.split(/\s+/).filter(Boolean);
}

function baseUtility(utility) {
  return utility.replace(/^(?:[a-z-]+:)+/, '').replace(/^!/, '');
}

function reportUtilities(context, node, pattern, messageId) {
  for (const utility of classUtilities(node.value)) {
    if (pattern.test(baseUtility(utility))) {
      context.report({ node, messageId, data: { utility } });
    }
  }
}

function inspectStringLiteral(context, node, pattern, messageId) {
  if (typeof node.value === 'string') {
    reportUtilities(context, node, pattern, messageId);
  }
}

function createRule(pattern, messageId, message) {
  return {
    meta: {
      type: 'problem',
      docs: { description: message },
      messages: { [messageId]: message },
      schema: [],
    },
    create(context) {
      return {
        Literal(node) {
          inspectStringLiteral(context, node, pattern, messageId);
        },
        TemplateElement(node) {
          reportUtilities(context, { ...node, value: node.value.raw }, pattern, messageId);
        },
      };
    },
  };
}

export const designTokenRules = {
  'no-primitive-color': createRule(
    PRIMITIVE_COLOR_PATTERN,
    'primitiveColor',
    'Use a semantic color token instead of the primitive Tailwind utility "{{utility}}".',
  ),
  'no-arbitrary-design-value': createRule(
    ARBITRARY_DESIGN_VALUE_PATTERN,
    'arbitraryDesignValue',
    'Use a named design token instead of the arbitrary utility "{{utility}}".',
  ),
};
