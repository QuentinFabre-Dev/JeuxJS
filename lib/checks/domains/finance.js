export const finance = {
  id: 'finance',
  label: 'Financial Services',
  glossary: [
    'EBITDA', 'ROI', 'TRI', 'BFR', 'CAPEX', 'OPEX', 'LBO', 'M&A', 'KYC', 'AML',
    'flux de trésorerie', 'valorisation', 'multiple', 'covenant',
  ],
  requirements: [
    'Un montant doit porter son unité, sa devise et sa période.',
    'Une projection doit être présentée comme une hypothèse, jamais comme un fait.',
  ],
  context:
    'This is a financial deliverable. Figures without a unit, a currency or a ' +
    'period are defects. Projections stated in the indicative as if they were ' +
    'facts are the most costly error in this practice.',
};
