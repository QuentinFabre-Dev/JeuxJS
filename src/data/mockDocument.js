// GENERATED — do not edit by hand.
// Source: tools/build-sample-contract.py, the same one that produces
// public/samples/contrat-prestation-services.docx. The demo engine matches
// findings to sentences by exact text, so both must come from one source.
//
// Run: python3 tools/build-sample-contract.py

export const MOCK_DOCUMENT = {
  kind: "docx",
  title: "Contrat de prestation de services.docx",
  subtitle: "NOVATEK Conseil SAS — Groupe Meridian SA",
  pages: [
    // ── Page 1 ─────────────────────────────
    [
      { kind: "heading", text: "CONTRAT DE PRESTATION DE SERVICES" },
      { kind: "p", text: "Entre les soussignés : NOVATEK Conseil SAS, société par actions simplifiée au capital de 50 000 euros, immatriculée au RCS de Paris sous le numéro 892 451 337, dont le siège social est situé 14 rue de Londres, 75009 Paris, représentée par Madame Claire Fontaine en qualité de Présidente, ci-après dénommée « le Prestataire »." },
      { kind: "p", text: "Et : Groupe Meridian SA, société anonyme au capital de 1 200 000 euros, immatriculée au RCS de Lyon sous le numéro 401 228 940, dont le siège social est situé 8 avenue Jean Jaurès, 69007 Lyon, représentée par Monsieur Paul Vasseur en qualité de Directeur Général, ci-après dénommée « le Client »." },
      { kind: "p", text: "Il a été convenu ce qui suit." },
      { kind: "heading", text: "Article 1 — Objet du contrat" },
      { kind: "p", text: "Le présent contrat a pour objet de définir les conditions dans lesquelles le Prestataire réalise, pour le compte du Client, une mission d'accompagnement à la refonte de son système d'information de gestion." },
      { kind: "p", text: "La mission comprend un audit de l'existant, la rédaction des spécifications fonctionnelles et l'assistance au déploiement." },
      { kind: "heading", text: "Article 2 — Documents contractuels" },
      { kind: "p", text: "Les documents contractuels comprennent le présent contrat et son annexe 1 décrivant le détail des prestations." },
      { kind: "p", text: "Les livrables mentionnés à l'article 2 sera remis au Client selon le calendrier convenu entre les parties." },  // FINDING grammar
      { kind: "p", text: "En cas de contradiction entre le contrat et son annexe, les stipulations du contrat prévalent." },
      { kind: "heading", text: "Article 3 — Durée" },
      { kind: "p", text: "Le présent contrat est conclu pour une durée de douze mois à compter du 1er mars 2025." },
      { kind: "p", text: "Le présent contrat prend effet à la date de signature et court jusqu'à sa resiliation dans les conditions prévues à l'article 11." },  // FINDING spelling
      { kind: "p", text: "Il est expressément convenu que le contrat prend effet le 1er avril 2025." },  // FINDING consistency
      { kind: "p", text: "Chacune des parties s'engagent à respecter le calendrier figurant en annexe." },  // FINDING grammar
      { kind: "heading", text: "Article 4 — Conditions financières" },
      { kind: "p", text: "Le montant total des prestations est fixé à 45 000 euros hors taxes." },  // FINDING consistency
      { kind: "p", text: "Ce montant est ferme et non révisable pendant toute la durée du contrat." },
      { kind: "p", text: "Les frais de déplacement engagés par le Prestataire sont refacturés au réel, sur présentation des justificatifs." },
      { kind: "heading", text: "Article 5 — Modalités de paiement" },
      { kind: "p", text: "Les factures sont émises mensuellement et payables à trente jours fin de mois." },
      { kind: "p", text: "Tout paiment intervenant après cette date donnera lieu à des pénalités de retard calculées au taux légal." },  // FINDING spelling
      { kind: "heading", text: "Article 6 — Obligations du Prestataire" },
      { kind: "p", text: "Novatech Conseil met en œuvre les moyens humains et techniques nécessaires à la bonne exécution de la mission." },  // FINDING consistency
      { kind: "p", text: "Le Prestataire remettra une PSSI conforme aux exigences du Client." },  // FINDING consistency
      { kind: "p", text: "On fera au mieux pour livrer dans les temps." },  // FINDING tone
      { kind: "heading", text: "Article 7 — Obligations du Client" },
      { kind: "p", text: "Le Client met à disposition du Prestataire les informations et accès nécessaires à la réalisation de la mission." },
      { kind: "p", text: "Le Client devra juste nous prévenir en cas de souci sur les accès." },  // FINDING tone
      { kind: "p", text: "Le Client désigne un interlocuteur unique chargé du suivi de la mission." },
      { kind: "heading", text: "Article 8 — Confidentialité" },
      { kind: "p", text: "Les parties s'engagent à préserver la confidentialité des informations échangées dans le cadre du présent contrat, et notamment la politique de sécurité des systèmes d'information (PSSI) du Client." },
      { kind: "p", text: "Le Prestataire garantit la confidentailité des informations transmises par le Client pendant toute la durée du contrat." },  // FINDING spelling
    ],
    // ── Page 2 ─────────────────────────────
    [
      { kind: "p", text: "Cette obligation demeure en vigueur pendant cinq années à compter du terme du contrat, sauf si les informations concernées sont tombées dans le domaine public sans qu'aucune faute ne soit imputable à la partie qui les a reçues, étant précisé que la charge de la preuve de cette divulgation antérieure, qui doit être établie par tout moyen écrit, incombe à celle-ci, laquelle devra en informer l'autre partie dans un délai raisonnable." },  // FINDING clarity
      { kind: "heading", text: "Article 9 — Propriété intellectuelle" },
      { kind: "p", text: "Les livrables réalisés dans le cadre de la mission deviennent la propriété du Client à compter de leur paiement intégral." },
      { kind: "p", text: "Le Prestataire conserve la propriété de ses méthodes et outils préexistants, celui-ci ne pouvant les revendiquer." },  // FINDING clarity
      { kind: "heading", text: "Article 10 — Responsabilité" },
      { kind: "p", text: "La responsabilité du Prestataire est limitée aux dommages directs et plafonnée au montant total des sommes effectivement versées au titre du présent contrat." },
      { kind: "p", text: "Le Prestataire justifie d'une assurance responsabilité civile professionnelle en cours de validité." },
      { kind: "heading", text: "Article 11 — Résiliation" },
      { kind: "p", text: "Chaque partie peut résilier le présent contrat par lettre recommandée avec accusé de réception, moyennant un préavis de deux mois." },
      { kind: "p", text: "En cas de manquement grave de l'une des parties à ses obligations, l'autre partie peut résilier le contrat de plein droit quinze jours après une mise en demeure restée sans effet." },
      { kind: "heading", text: "Article 12 — Droit applicable et litiges" },
      { kind: "p", text: "Le présent contrat est soumis au droit français." },
      { kind: "p", text: "À défaut de résolution amiable, tout litige relatif à sa validité, son interprétation ou son exécution relève de la compétence exclusive du Tribunal de commerce de Paris." },
      { kind: "p", text: "Fait à Paris, en deux exemplaires originaux, le 24 février 2025." },
      { kind: "heading", text: "Annexe 1 — Description des prestations" },
      { kind: "p", text: "La mission se déroule en trois phases : cadrage, spécifications et accompagnement au déploiement." },
      { kind: "p", text: "La phase de cadrage comprend l'audit de l'existant et la restitution d'un diagnostic écrit." },
      { kind: "p", text: "Le budget global de la mission s'élève à 48 000 euros hors taxes, réparti entre les trois phases." },
      { kind: "p", text: "Le calendrier prévisionnel prévoit une restitution finale au plus tard le 28 février 2026." },
    ],
  ],
};
