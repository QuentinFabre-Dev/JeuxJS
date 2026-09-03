export const cyber = {
  id: 'cyber',
  label: 'Cyber Security',
  glossary: [
    'CVE', 'CVSS', 'SOC', 'EDR', 'XDR', 'IOC', 'SIEM', 'MFA', 'RCE', 'DDoS',
    'pentest', 'remédiation', 'surface d’attaque', 'moindre privilège',
  ],
  requirements: [
    'Une criticité annoncée doit être justifiée par un score ou un impact décrit.',
    'Une affirmation de vulnérabilité doit citer une preuve : une référence, un test ou une observation.',
  ],
  context:
    'This is a cyber security deliverable. A severity stated without a score or ' +
    'a described impact is a defect, not a stylistic choice; so is a vulnerability ' +
    'claimed without evidence. Technical acronyms are house vocabulary, not typos.',
};
