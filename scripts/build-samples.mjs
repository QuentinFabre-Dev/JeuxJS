/**
 * Fabrique les documents d'exemple servis par l'application.
 *
 *     npm run build:samples
 *
 * Ce sont de vrais fichiers Word, pas des approximations : c'est le format que
 * l'outil traite tous les jours, et un exemple qui ne ressemble pas au travail
 * réel ne démontre rien. Les fautes qu'ils portent sont plantées exprès —
 * orthographe, accord, acronyme employé avant sa définition, un montant écrit
 * de deux façons, deux formats de date, un ton qui déraille — et le rapport
 * rompt son SoW de trois manières différentes.
 *
 * Les fichiers produits sont versionnés : ce script sert à les modifier, pas à
 * les régénérer à chaque installation.
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  AlignmentType,
  Document,
  Header,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} = require('docx');

const title = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_1 });
const body = (...runs) => new Paragraph({ children: runs.map((run) => (typeof run === 'string' ? new TextRun(run) : run)) });
const bold = (text) => new TextRun({ text, bold: true });
const italic = (text) => new TextRun({ text, italics: true });

const header = (text) =>
  new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text, size: 16, color: '888888' })],
      }),
    ],
  });

const report = new Document({
  creator: 'Ryder',
  title: 'Audit de sécurité — Northwind Industries',
  sections: [
    {
      headers: { default: header('Confidentiel — Northwind Industries') },
      children: [
        new Paragraph({
          heading: HeadingLevel.TITLE,
          children: [bold('Audit de sécurité — Northwind Industries')],
        }),
        body('Rapport final, mission MSA-2025-114.'),

        title('1. Synthèse'),
        body(
          'Cette mission a porté sur la segmentation réseau du datacenter de Villeurbanne et sur les accès à privilèges.'
        ),
        // Accord fautif.
        body('Les tests a été réalisés du 12/03/2025 au 3 avril 2025 par une équipe de deux consultants.'),
        // Ton qui déraille dans une synthèse de livrable client.
        body("On a trouvé pas mal de trucs à corriger, dont deux points qui nous semblent vraiment urgents."),
        // CVSS employé ici, défini seulement en section 3.
        body('Le score ', bold('CVSS'), ' de la vulnérabilité principale atteint 9,1.'),
        // Premier montant : 120 k€.
        body("Le budget de remédiation est estimé à 120 k€ pour l'exercice en cours."),

        title('2. Périmètre et méthode'),
        body('Le périmètre couvre les vingt-quatre serveurs de production ainsi que les équipements de bordure.'),
        // Phrase que personne ne lit deux fois par choix.
        body(
          "La méthode retenue combine des tests d'intrusion depuis le réseau interne, une revue de configuration des équipements, une analyse des journaux d'authentification sur les trente derniers jours et des entretiens avec les équipes d'exploitation, dont les conclusions ont été recoupées avec les éléments transmis par la direction des systèmes d'information au cours de la phase préparatoire."
        ),

        // Faute d'orthographe dans un titre.
        title('3. Vulnérabilitées identifiées'),
        body('Le ', italic('Common Vulnerability Scoring System'), ' (CVSS) sert de référence de criticité tout au long de ce rapport.'),
        body('Une élévation de privilèges est possible depuis le VLAN bureautique vers le VLAN de production.'),
        body("L'authentification multifacteur n'est pas activée sur les comptes d'administration."),
        body('Les sauvegardes sont chiffrées au repos et leur restauration a été testée avec succès.'),

        // Sujet explicitement exclu du SoW, traité quand même.
        title('4. Revue du code applicatif'),
        body("L'application de facturation a fait l'objet d'une revue de code ciblée sur les modules d'authentification."),
        body('Trois injections SQL potentielles ont été relevées dans les requêtes de recherche.'),

        // Faute d'orthographe dans un titre, à nouveau.
        title('5. Recomandations'),
        body(
          "Nous recommandons d'activer l'authentification multifacteur sur l'ensemble des comptes à privilèges."
        ),
        body('La segmentation entre le VLAN bureautique et le VLAN de production doit être renforcée sans délai.'),
        // Même libellé, montant différent.
        body("Le budget de remédiation est estimé à 150 k€ pour l'exercice en cours."),
        // Date postérieure à l'échéance contractuelle du SoW.
        body('Un atelier de restitution a été tenu le 15 mai 2025 avec les équipes concernées.'),
        body('Le présent rapport a été relu par les équipes de Northwind Industries avant diffusion.'),
      ],
    },
  ],
});

const sow = new Document({
  creator: 'Ryder',
  title: 'Statement of Work — Northwind Industries',
  sections: [
    {
      headers: { default: header('Contrat signé — ne pas modifier') },
      children: [
        new Paragraph({
          heading: HeadingLevel.TITLE,
          children: [bold('Statement of Work — Northwind Industries')],
        }),
        body('Mission MSA-2025-114, signée le 2 février 2025.'),

        title('1. Livrables'),
        body('Le prestataire remet un rapport final comportant une synthèse en tête de document.'),
        body('Le prestataire organise un atelier de restitution avec les équipes concernées.'),

        title('2. Périmètre'),
        body('La mission couvre la segmentation réseau du datacenter de Villeurbanne.'),
        body('La mission couvre les accès à privilèges et leur authentification.'),

        title('3. Hors périmètre'),
        body('La revue du code applicatif est expressément ', bold('exclue'), ' du périmètre de la mission.'),

        title('4. Méthode'),
        body('Les travaux sont conduits selon la méthodologie EBIOS Risk Manager.'),

        title('5. Calendrier'),
        body('Le rapport final est remis au plus tard le 30 avril 2025.'),
      ],
    },
  ],
});

for (const [document, path] of [
  [report, 'public/samples/rapport-exemple.docx'],
  [sow, 'public/samples/sow-exemple.docx'],
]) {
  writeFileSync(path, await Packer.toBuffer(document));
  console.log(`✔ ${path}`);
}
