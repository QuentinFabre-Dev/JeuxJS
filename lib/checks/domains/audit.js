export const audit = {
  id: 'audit',
  label: 'Audit & Assurance',
  // Never reported as a spelling mistake, and the canonical spelling the
  // terminology check aligns variants on.
  glossary: [
    'ISA', 'IFRS', 'PCAOB', 'GAAP', 'EBITDA', 'FTE',
    'contrôle interne', 'seuil de signification', 'diligence',
    'lettre d’affirmation', 'réserve', 'assertion',
  ],
  // Requirements every deliverable of this practice carries. A quoted term is
  // settled by a search, an unquoted one by the model.
  requirements: [
    'Une conclusion d’audit doit être rattachée à une assertion et à un élément probant.',
    'Une anomalie signalée doit indiquer si elle est significative au regard du seuil retenu.',
  ],
  context:
    'This is an audit deliverable. Conclusions must be traceable to evidence, ' +
    'hedged language is expected where evidence is partial, and an unqualified ' +
    'claim about an entity’s accounts is a serious defect rather than a style issue.',
};
