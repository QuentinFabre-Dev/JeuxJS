/**
 * The shape every check answers in.
 *
 * Declared once and enforced by the API through structured outputs, which is
 * what removes the old `extractJson` / `scanCompleteObjects` machinery: there
 * is no truncated JSON left to recover from.
 *
 * A check picks its prompt, never its output shape. That is what keeps
 * `normaliseFinding` the single door into the findings list.
 *
 * Strict mode requires every property to be listed in `required` and
 * `additionalProperties: false` everywhere — hence `custom_label` being
 * nullable rather than optional.
 */
export const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Id of the sentence at fault, exactly as given (e.g. "p3s7").',
          },
          skill: {
            type: 'string',
            enum: ['grammar', 'spelling', 'consistency', 'clarity', 'tone', 'custom'],
          },
          custom_label: {
            type: ['string', 'null'],
            description:
              'For skill "custom": the client requirement, copied verbatim. Null otherwise.',
          },
          suggestion: {
            type: 'string',
            description: 'The full corrected sentence, ready to paste in place of the original.',
          },
          explanation: { type: 'string', description: 'One sentence: what is wrong and why.' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
        required: [
          'id',
          'skill',
          'custom_label',
          'suggestion',
          'explanation',
          'priority',
          'confidence',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['findings'],
  additionalProperties: false,
};
