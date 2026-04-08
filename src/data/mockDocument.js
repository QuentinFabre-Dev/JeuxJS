// Document fictif utilisé pour la preview.
// Les phrases marquées par "// FINDING" correspondent EXACTEMENT à un
// `original` de mockFindings.js (matching par texte + numéro de page).
//
// Chaque page est un tableau de blocs typés :
//   - { kind: 'heading', text: '...' }   → titre de section
//   - { kind: 'p',       text: '...' }   → paragraphe / phrase
//
// Les phrases qui matchent un finding sont rendues comme des "marks"
// cliquables dans <DocumentPreview />.

export const MOCK_DOCUMENT = {
  title: "Rapport interne \u2014 Q1 2025",
  subtitle: "Synthèse trimestrielle et plan d'action",
  pages: [
    // ── Page 1 ──────────────────────────────────────────────
    [
      { kind: 'heading', text: '1. Introduction' },
      {
        kind: 'p',
        text:
          "Ce document présente la synthèse du premier trimestre 2025 et les axes d'amélioration identifiés par les différentes équipes opérationnelles.",
      },
      {
        kind: 'p',
        text: "Salut l\u2019équipe, j\u2019espère que vous allez bien :)", // FINDING tone
      },
      {
        kind: 'p',
        text: "Le rapport présente les chifres clés du dernier trimestre.", // FINDING spelling
      },
      {
        kind: 'p',
        text:
          "Les équipes commerciales et marketing doit collaborer plus étroitement.", // FINDING grammar
      },
      {
        kind: 'p',
        text:
          "Nous reviendrons en détail sur chacun de ces points dans les sections suivantes.",
      },
    ],

    // ── Page 2 ──────────────────────────────────────────────
    [
      { kind: 'heading', text: '2. Validation des livrables' },
      {
        kind: 'p',
        text:
          "La gouvernance documentaire impose un circuit de validation à plusieurs niveaux pour chaque document publié à l'externe.",
      },
      {
        kind: 'p',
        text:
          "Aucun des documents transmis n\u2019ont été validés par la direction.", // FINDING grammar
      },
      {
        kind: 'p',
        text:
          "Le projet sera livré au T2 2025 avec un budget de 120 k\u20ac.", // FINDING consistency
      },
      {
        kind: 'p',
        text:
          "Un comité de pilotage sera organisé courant avril pour ajuster ces éléments.",
      },
    ],

    // ── Page 3 ──────────────────────────────────────────────
    [
      { kind: 'heading', text: '3. Sécurité et conformité' },
      {
        kind: 'p',
        text:
          "Les colaborateurs doivent suivre la procédure de sécurité.", // FINDING spelling
      },
      {
        kind: 'p',
        text:
          "Dans le cadre de la mise en \u0153uvre opérationnelle de la stratégie globale, il conviendra, le moment venu, d\u2019articuler les briques fonctionnelles de manière à garantir un alignement transverse.", // FINDING clarity
      },
      {
        kind: 'p',
        text:
          "Une formation obligatoire est planifiée pour l'ensemble des équipes au cours du second trimestre.",
      },
    ],

    // ── Page 4 ──────────────────────────────────────────────
    [
      { kind: 'heading', text: '4. Planning et arbitrages' },
      {
        kind: 'p',
        text:
          "Plusieurs décisions ont été prises lors des réunions hebdomadaires pour adapter le calendrier projet.",
      },
      {
        kind: 'p',
        text:
          "Suite à la réunion de lundi, on a décidés de reporter le lancement.", // FINDING grammar
      },
      {
        kind: 'p',
        text: "C\u2019est juste impossible de respecter ce planning.", // FINDING tone
      },
      {
        kind: 'p',
        text:
          "Une révision complète du calendrier est en cours, en lien avec le PMO.",
      },
    ],

    // ── Page 5 ──────────────────────────────────────────────
    [
      { kind: 'heading', text: '5. Engagements RSE' },
      {
        kind: 'p',
        text:
          "L\u2019entreprise s\u2019engage à respecter les engagement RSE.", // FINDING spelling
      },
      {
        kind: 'p',
        text:
          "Le livrable final, qui devra être validé par les parties prenantes, sera mis à disposition.", // FINDING clarity
      },
      {
        kind: 'p',
        text:
          "Le détail des engagements et indicateurs de suivi est annexé en fin de document.",
      },
    ],

    // ── Page 6 ──────────────────────────────────────────────
    [
      { kind: 'heading', text: '6. Gestion documentaire' },
      {
        kind: 'p',
        text:
          "Cette procédure remplace la version v1.2 datée du 14/03/2024.", // FINDING consistency
      },
      {
        kind: 'p',
        text: "Merci de bien vouloir faire le nécessaire ASAP.", // FINDING tone
      },
      {
        kind: 'p',
        text:
          "Toute modification doit faire l'objet d'une revue par le référent qualité avant publication.",
      },
    ],

    // ── Page 7 ──────────────────────────────────────────────
    [
      { kind: 'heading', text: '7. Sécurité des accès' },
      {
        kind: 'p',
        text:
          "La politique de gestion des mots de passe a été mise à jour cette année.",
      },
      {
        kind: 'p',
        text:
          "Les utilisateurs peuvent réinitialiser leur mot de passe à tout moment.", // FINDING consistency
      },
      {
        kind: 'p',
        text:
          "Pour rappel, le service IT reste joignable en cas de difficulté.",
      },
    ],

    // ── Page 8 ──────────────────────────────────────────────
    [
      { kind: 'heading', text: '8. Conclusion' },
      {
        kind: 'p',
        text:
          "L'audit met en lumière plusieurs points d'amélioration que nous traiterons par ordre de priorité.",
      },
      {
        kind: 'p',
        text:
          "Il est à noter qu\u2019un certain nombre d\u2019éléments restent à clarifier.", // FINDING clarity
      },
      {
        kind: 'p',
        text:
          "Une réunion de restitution sera planifiée la semaine prochaine pour partager les conclusions.",
      },
    ],
  ],
};
