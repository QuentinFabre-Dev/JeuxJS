export const tax = {
  id: 'tax',
  label: 'Tax & Legal',
  glossary: [
    'CGI', 'TVA', 'IS', 'BOFiP', 'CIR', 'BEPS', 'OCDE',
    'redressement', 'abus de droit', 'prix de transfert', 'établissement stable',
  ],
  requirements: [
    'Une position fiscale doit citer son fondement : texte, doctrine ou jurisprudence.',
    'Un conseil doit distinguer ce qui est certain de ce qui est discutable.',
  ],
  context:
    'This is a tax and legal deliverable. A position stated without its legal ' +
    'basis is a defect. Certainty and arguability must be visibly distinguished: ' +
    'a debatable position written as settled law is the failure that costs a client.',
};
