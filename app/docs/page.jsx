/**
 * Documentation interne : ce que fait réellement la partie IA.
 *
 * Page volontairement non liée depuis l'application — elle s'atteint par son
 * adresse, `/docs`, et reste derrière la même porte que le reste du site. Elle
 * décrit le code tel qu'il est, avec ses constantes réelles et ses limites
 * connues : une documentation qui embellit le système qu'elle décrit ne sert
 * personne.
 */
export const metadata = {
  title: 'Ryder — documentation technique',
  robots: { index: false, follow: false },
};

const Section = ({ id, title, lead, children }) => (
  <section id={id} className="scroll-mt-8">
    <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
    {lead && <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{lead}</p>}
    <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-600">{children}</div>
  </section>
);

const Table = ({ head, rows }) => (
  <div className="overflow-x-auto">
    <table className="w-full border-collapse text-left text-[13px]">
      <thead>
        <tr className="border-b border-slate-200">
          {head.map((cell) => (
            <th key={cell} className="py-2 pr-4 font-medium text-slate-500">
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index} className="border-b border-slate-100 align-top">
            {row.map((cell, cellIndex) => (
              <td
                key={cellIndex}
                className={`py-2 pr-4 ${cellIndex === 0 ? 'font-medium text-slate-800' : 'text-slate-600'}`}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Code = ({ children }) => (
  <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[12px] text-slate-700">
    {children}
  </code>
);

const Note = ({ children }) => (
  <p className="border-l-2 border-slate-300 pl-3 text-[13px] italic text-slate-500">{children}</p>
);

export default function DocsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-12">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Ce qui se passe côté IA
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Documentation technique de la revue : les flux, les décisions, les
          bibliothèques et les limites. Elle décrit le code tel qu'il est, avec
          ses constantes réelles — pas l'intention qu'il avait.
        </p>
      </header>

      <div className="space-y-14">
        <Section
          id="trajet"
          title="1. Le trajet d'un document"
          lead="Sept étapes, dont trois seulement appellent un modèle."
        >
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong className="text-slate-800">Extraction</strong>, dans le
              navigateur. Le fichier est lu et découpé en phrases numérotées
              (<Code>p3s7</Code> = page 3, phrase 7). Ces identifiants sont la
              colonne vertébrale du reste : le modèle y répond, le visualiseur
              les surligne, le régénérateur les retrouve dans le fichier.
            </li>
            <li>
              <strong className="text-slate-800">Contrôles déterministes</strong>,
              dans le navigateur. Terminologie, chiffres, exigences à motif.
              Aucun appel, aucun coût, ~30 ms pour 200 pages.
            </li>
            <li>
              <strong className="text-slate-800">Plan</strong>. Les skills cochés
              deviennent une liste de tâches. Un contrôle non sélectionné ne
              produit aucune tâche, et une tâche est la seule chose qui coûte.
            </li>
            <li>
              <strong className="text-slate-800">Exécution</strong>, côté serveur.
              Les tâches partent en parallèle (12 à la fois par défaut) vers
              l'API OpenAI.
            </li>
            <li>
              <strong className="text-slate-800">Vérification</strong>. Un second
              appel challenge les findings douteux.
            </li>
            <li>
              <strong className="text-slate-800">Triage</strong>, par vous.
              Accepté, rejeté, ou laissé ouvert.
            </li>
            <li>
              <strong className="text-slate-800">Régénération</strong>, dans le
              navigateur. Le fichier d'origine est modifié sur place avec les
              seules corrections acceptées.
            </li>
          </ol>
          <Note>
            Les résultats sont diffusés au fil de l'eau (server-sent events) :
            le premier finding apparaît vers la première seconde, pas à la fin.
          </Note>
        </Section>

        <Section
          id="ou"
          title="2. Ce qui tourne où"
          lead="La question qui compte pour un livrable client : qu'est-ce qui sort de la machine ?"
        >
          <Table
            head={['Étape', 'Lieu', 'Ce qui circule']}
            rows={[
              ['Extraction, OCR', 'Navigateur', 'Rien'],
              ['Contrôles déterministes', 'Navigateur', 'Rien'],
              ['Contrôles de jugement', 'Serveur → OpenAI', 'Le texte des phrases concernées'],
              ['Vérification', 'Serveur → OpenAI', 'Phrases et revendications'],
              ['Conformité au SoW', 'Serveur → OpenAI', 'Le SoW et des extraits du livrable'],
              ['Régénération du document', 'Navigateur', 'Rien'],
            ]}
          />
          <p>
            La clé d'API vit dans le process serveur et n'atteint jamais le
            navigateur. Aucun document n'est stocké côté serveur : le texte
            transite dans la requête et disparaît avec elle. La régénération du
            fichier corrigé, elle, ne fait aucun aller-retour réseau.
          </p>
        </Section>

        <Section
          id="controles"
          title="3. Les sept contrôles"
          lead="L'unité de travail n'est pas un « agent » mais un contrôle : un id, les skills qu'il couvre, le moteur qui l'exécute, sa portée."
        >
          <Table
            head={['Contrôle', 'Question posée', 'Moteur']}
            rows={[
              ['terminology', 'Acronyme employé avant sa définition, variante d\'un terme du glossaire', 'JS, navigateur'],
              ['figures', 'Deux écritures d\'un même montant, libellés identiques à valeurs différentes, formats de date mélangés', 'JS, navigateur'],
              ['patterns', 'Exigence client entre guillemets : le terme apparaît-il ?', 'JS, navigateur'],
              ['mechanical', 'Orthographe, accords, temps, ponctuation', <>GPT‑5 mini, 1 page/appel</>],
              ['clarity-tone', 'Phrases qu\'on relit deux fois, ton inadapté', <>GPT‑5, 1 page/appel</>],
              ['consistency', 'Contradictions entre pages distantes, dérive terminologique', <>GPT‑5, document entier</>],
              ['requirements', 'Exigences client demandant un jugement', <>GPT‑5, 1 page/appel</>],
            ]}
          />
          <p>
            Cocher « Consistency » en active trois, sur deux moteurs : ce que la
            comparaison de caractères peut prouver reste dans le navigateur, ce
            qui demande de comprendre deux phrases part au modèle.
          </p>
          <p>
            Une exigence client <strong className="text-slate-800">entre
            guillemets</strong> est traitée comme une recherche (gratuite,
            instantanée) ; sans guillemets, elle part au modèle. La convention
            est explicite plutôt que devinée.
          </p>
        </Section>

        <Section
          id="pas-agents"
          title="4. Pourquoi ce n'est pas un système d'agents"
          lead="Le mot a été envisagé deux fois, puis écarté deux fois."
        >
          <p>
            Un agent suppose qu'on délègue une décision à un modèle : quand
            s'arrêter, quel outil appeler, quoi faire ensuite. Ici, rien de
            tout cela. Le plan est calculé par du code avant le premier appel,
            les tâches sont indépendantes, et le nombre de passes est fixé par
            la politique — jamais par le modèle. Une boucle libre sur une API
            payante, c'est un budget sans règle d'arrêt.
          </p>
          <p>
            <strong className="text-slate-800">LangGraph</strong> a été écarté
            parce que le graphe s'est aplati : un planificateur, un fan‑out, une
            fusion. Ni boucle, ni état partagé complexe. Un pool borné et un
            générateur asynchrone font le travail en ~150 lignes testables.
          </p>
          <p>
            <strong className="text-slate-800">LangChain</strong> a été écarté
            parce que son intérêt était d'abstraire le fournisseur, or ce qu'on
            veut du modèle est précisément ce qu'une couche d'abstraction
            rabote : <Code>reasoning.effort</Code>, les sorties structurées
            strictes, la ventilation exacte de l'<Code>usage</Code> par palier.
            Le SDK officiel <Code>openai</Code> est plus direct et mieux typé.
          </p>
        </Section>

        <Section
          id="appels"
          title="5. Comment le modèle est appelé"
          lead="Responses API d'OpenAI, sorties structurées strictes, raisonnement bridé."
        >
          <Table
            head={['Réglage', 'Valeur', 'Pourquoi']}
            rows={[
              ['Palier principal', <Code>gpt-5</Code>, 'Jugement rédactionnel'],
              ['Petit palier', <Code>gpt-5-mini</Code>, 'Passe mécanique et vérification : 5× moins cher pour un résultat que rien ne distingue'],
              ['Raisonnement', <Code>effort: minimal</Code>, 'Les jetons de raisonnement sont facturés en sortie et payés en latence. Sur des défauts au niveau de la phrase, réfléchir plus longtemps n\'achète rien de mesurable'],
              ['Sortie', <Code>json_schema, strict</Code>, 'Le schéma est contraint côté API : plus de JSON tronqué à rattraper'],
              ['Plafond de sortie', '2 048 jetons (4 096 pour le SoW)', 'Protection la moins chère contre un modèle qui décide d\'être exhaustif'],
              ['Instructions', 'Identiques d\'un appel à l\'autre', 'Éligibles au cache de prompt, servi au dixième du prix'],
              ['Concurrence', '12 appels simultanés', <>Réglable par <Code>ANALYSIS_CONCURRENCY</Code></>],
              ['Reprises', '3, gérées par le SDK', 'Une revue finit en retard plutôt qu\'en erreur'],
            ]}
          />
          <p>
            Les paliers se changent par variables d'environnement
            (<Code>ANALYSIS_MODEL_MAIN</Code>, <Code>ANALYSIS_MODEL_FAST</Code>)
            sans toucher au code.
          </p>
        </Section>

        <Section
          id="prompts"
          title="6. Les prompts"
          lead="Ce sont des fichiers Markdown versionnés, pas des chaînes enfouies dans le code."
        >
          <Table
            head={['Fichier', 'Rôle']}
            rows={[
              [<Code>_system.md</Code>, 'Règles communes : ne rien inventer, un finding par problème, répondre avec l\'id de la phrase, ignorer les artefacts d\'extraction, une liste vide est une bonne réponse'],
              [<Code>mechanical.md</Code>, 'Orthographe et grammaire seulement — interdiction explicite de signaler le style'],
              [<Code>clarity-tone.md</Code>, 'Clarté et ton — interdiction explicite de signaler l\'orthographe'],
              [<Code>consistency.md</Code>, 'Un finding doit impliquer deux endroits du document et nommer l\'autre page'],
              [<Code>requirements.md</Code>, 'Exigences client : signaler une rupture, pas une absence de couverture'],
              [<Code>critic.md</Code>, 'Vérification : garder, écarter, ajuster'],
              [<Code>sow-extract.md</Code>, 'Lire un SoW et lister ce qu\'il engage'],
              [<Code>sow-verify.md</Code>, 'Confronter chaque engagement au livrable'],
            ]}
          />
          <p>
            Le gabarit ne connaît que des <Code>{'{{variables}}'}</Code> —
            phrases, langue, glossaire, contexte métier. Pas de conditionnelle,
            pas de boucle : dès qu'un prompt demande de la logique, la logique
            repart en JavaScript.
          </p>
          <p>
            Chaque prompt interdit explicitement le domaine du voisin. C'est ce
            qui évite qu'une même phrase soit signalée deux fois pour deux
            raisons différentes, ce qui coûte au lecteur plus que ça ne lui
            rapporte.
          </p>
        </Section>

        <Section
          id="verification"
          title="7. La vérification"
          lead="Le premier avis n'est pas le dernier : un second appel challenge les findings arguables."
        >
          <Table
            head={['Politique', 'Ce qui est vérifié']}
            rows={[
              [<Code>off</Code>, 'Rien'],
              [<Code>uncertain</Code>, <>Confiance sous 0,8, <em>et</em> tout ce qui est marqué <Code>high</Code> — défaut</>],
              [<Code>all</Code>, 'Tout, le plus coûteux'],
            ]}
          />
          <p>Trois règles la rendent utile plutôt que décorative :</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Le critique ne voit <strong className="text-slate-800">jamais le
              raisonnement</strong> du premier relecteur — seulement la phrase
              et la revendication. Montré le raisonnement, il approuve par
              mimétisme.
            </li>
            <li>
              Il tourne sur le petit palier : un critique plus cher que le
              relecteur qu'il contrôle ne survivrait pas à la première facture.
            </li>
            <li>
              Les findings déterministes ne lui sont pas soumis. Payer un modèle
              pour confirmer une comparaison de chaînes serait absurde.
            </li>
          </ul>
          <p>
            Les candidats partent par paquets de 12. Un candidat sans verdict
            n'est <strong className="text-slate-800">pas</strong> supprimé : un
            critique laconique ne doit pas effacer des findings en silence. La
            revue publie son <strong className="text-slate-800">taux de
            rejet</strong> — un critique à 0 % est un critique à éteindre,
            encore faut-il pouvoir le voir.
          </p>
          <p>
            Les findings s'affichent <em>avant</em> d'être vérifiés, puis les
            verdicts les amendent : un rejet retire la carte, un ajustement
            déplace priorité et confiance. La relecture ne coûte donc rien sur
            le temps du premier résultat.
          </p>
        </Section>

        <Section
          id="estimation"
          title="8. L'estimation affichée avant lancement"
          lead="Décocher un skill a un prix, et le seul moment où ce prix sert est à côté de l'interrupteur qui le change."
        >
          <p>
            La durée est bornée comme le pool se comporte réellement : jamais
            plus rapide que son appel le plus lent, ni que le temps total divisé
            par la concurrence. C'est une estimation, et elle est présentée
            comme telle — le reçu de fin de revue donne les chiffres réels, lus
            dans l'<Code>usage</Code> renvoyé par l'API.
          </p>
          <Table
            head={['Hypothèse', 'Valeur']}
            rows={[
              ['Jetons par page', '550'],
              ['En-tête de prompt', '700 jetons'],
              ['Sortie typique', '400 à 800 jetons selon le contrôle'],
              ['Prix GPT‑5', '1,25 $ / 10 $ par million (entrée / sortie)'],
              ['Prix GPT‑5 mini', '0,25 $ / 2 $ par million'],
            ]}
          />
          <Note>
            Ces chiffres sortent du code (<Code>lib/checks/estimate.js</Code>) et
            sont verrouillés par des tests : un changement de tarif qui ferait
            diverger la documentation et l'application casse la suite de tests.
          </Note>
        </Section>

        <Section
          id="sow"
          title="9. La conformité au SoW"
          lead="Une question différente de la qualité, donc une forme de résultat différente."
        >
          <p>
            Un finding qualité pointe une phrase qui est fausse ; un écart
            contractuel pointe une phrase qui est <em>absente</em>. Il n'y a
            rien à surligner pour un engagement manquant — d'où un panneau et un
            endpoint séparés.
          </p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong className="text-slate-800">Lire le SoW</strong> et lister
              ce qu'il engage : livrables, périmètre, exclusions, contraintes,
              format, dates. Chaque engagement cite sa clause mot pour mot. Les
              clauses de paiement, de responsabilité et de droit applicable sont
              ignorées : de vraies obligations, mais pas des obligations qu'un
              livrable peut tenir ou rompre.
            </li>
            <li>
              <strong className="text-slate-800">Présélectionner localement</strong>
              , gratuitement, les phrases du livrable par recouvrement de
              vocabulaire (40 au maximum par engagement). Envoyer le livrable
              entier avec chaque engagement serait l'implémentation évidente et
              la coûteuse.
            </li>
            <li>
              <strong className="text-slate-800">Vérifier</strong> par paquets de
              6 engagements : <Code>met</Code>, <Code>partial</Code>,{' '}
              <Code>missing</Code>, <Code>contradicted</Code>, avec les
              identifiants des phrases qui portent le verdict.
            </li>
          </ol>
          <p>
            <strong className="text-slate-800">Le verdict global n'est pas une
            moyenne.</strong> Un seul engagement contredit, ou un engagement
            critique manquant, donne « rupture » quel que soit le score. Un
            livrable qui traite un sujet explicitement exclu n'est pas « un peu
            moins conforme » qu'un livrable un peu mince. Un paquet dont la
            vérification échoue laisse ses engagements <Code>unchecked</Code> —
            jamais tenus.
          </p>
        </Section>

        <Section
          id="regeneration"
          title="10. La régénération du document corrigé"
          lead="Le fichier d'origine est modifié sur place. Rien n'est reconstruit."
        >
          <p>
            Reconstruire le document depuis le texte extrait rendrait le bon
            contenu et plus rien de la mise en page. Les octets d'origine sont
            donc conservés à l'ouverture, et les corrections appliquées dedans.
          </p>
          <p>
            Le piège : dans un vrai document Word, une phrase est éclatée sur
            plusieurs <em>runs</em>, parce que Word coupe à chaque changement de
            formatage, chaque passage du correcteur, chaque marque de révision.
            La mécanique en trois temps :
          </p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              <Code>locate</Code> retrouve la phrase malgré des espaces
              différents, sur une forme normalisée avec carte d'offsets ;
            </li>
            <li>
              <Code>changedSpan</Code> resserre au segment qui change réellement,
              en rognant préfixe et suffixe communs ;
            </li>
            <li>
              seuls les nœuds que ce segment touche sont réécrits.
            </li>
          </ol>
          <p>
            Mesuré : une correction orthographique touche{' '}
            <strong className="text-slate-800">1 run sur 5</strong> au lieu de 4,
            et gras comme italique survivent. Le même resserrement préserve un
            saut de ligne dans un fichier texte.
          </p>
          <Table
            head={['Format', 'Où vit le texte', 'Traité']}
            rows={[
              ['TXT / MD', 'Le fichier lui-même', 'Oui'],
              ['DOCX', <>Nœuds <Code>{'<w:t>'}</Code> de <Code>document.xml</Code>, en-têtes, pieds de page, notes</>, 'Oui'],
              ['PPTX', <>Nœuds <Code>{'<a:t>'}</Code> des diapositives et des notes</>, 'Oui'],
              ['PDF', 'Texte positionné caractère par caractère', 'Non — corriger un mot déplacerait toute la ligne'],
            ]}
          />
          <p>
            Deux corrections acceptées sur la même phrase sont fusionnées par la
            part que chacune modifie, puisque toutes deux ont été écrites contre
            la même phrase d'origine. Si elles touchent les mêmes mots, la
            seconde est signalée plutôt qu'appliquée à l'aveugle.
          </p>
          <p>
            Le fichier produit s'appelle <Code>nom_RyderReviewed.ext</Code>.
            Seuls les findings acceptés sont appliqués : un finding rejeté ou
            encore ouvert laisse le document intact.
          </p>
        </Section>

        <Section
          id="libs"
          title="11. Les bibliothèques"
          lead="Ce qui lit, ce qui écrit, ce qui appelle."
        >
          <Table
            head={['Bibliothèque', 'Rôle', 'Où']}
            rows={[
              [<Code>openai</Code>, 'Appels au modèle, Responses API', 'Serveur'],
              [<Code>mammoth</Code>, 'DOCX → texte et HTML pour le visualiseur (lecture seule)', 'Navigateur'],
              [<Code>pdfjs-dist</Code>, 'PDF → texte et géométrie des pages', 'Navigateur'],
              [<Code>jszip</Code>, 'Ouvrir et réécrire les archives DOCX et PPTX', 'Navigateur'],
              [<Code>tesseract.js</Code>, 'Reconnaissance de texte sur les PDF scannés', 'Navigateur'],
              [<Code>exceljs</Code>, 'Export des findings en tableur', 'Navigateur'],
              [<Code>next</Code>, 'Application et routes serveur', 'Les deux'],
              [<Code>@xmldom/xmldom</Code>, 'Analyseur XML pour les tests d\'aller-retour', 'Tests'],
              [<Code>docx</Code>, 'Génération des documents d\'exemple', 'Script'],
            ]}
          />
          <p>
            L'analyse du PPTX est écrite dans le projet
            (<Code>pptxParser.js</Code>) : lire la géométrie des formes, les
            héritages de mise en page et l'ordre des diapositives demandait plus
            de contrôle qu'une bibliothèque générique n'en donne.
          </p>
          <p>
            Les moteurs de correction n'utilisent aucune bibliothèque de
            correction : orthographe et grammaire passent par le modèle, et les
            contrôles déterministes sont du JavaScript écrit ici. LanguageTool a
            été évalué puis écarté — il économisait un centime sur une revue qui
            en coûte quatorze, contre un service Java à héberger.
          </p>
        </Section>

        <Section
          id="limites"
          title="12. Les limites connues"
          lead="Ce que le système ne sait pas faire, dit ici plutôt que découvert en production."
        >
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-slate-800">Le PDF ne peut pas être
              régénéré.</strong> Il peut être analysé, pas corrigé.
            </li>
            <li>
              <strong className="text-slate-800">Une correction ne peut pas
              traverser une fin de paragraphe.</strong> Une marque de paragraphe
              est de la structure, pas des caractères. Ces corrections sont
              écartées et nommées dans le rapport.
            </li>
            <li>
              <strong className="text-slate-800">PowerPoint ne reflue pas.</strong>{' '}
              Une correction plus longue peut déborder de sa zone de texte. Les
              diapositives dont le texte a grandi sont nommées ; savoir si elles
              débordent vraiment dépend de la police et de l'ajustement
              automatique.
            </li>
            <li>
              <strong className="text-slate-800">La présélection du SoW compare
              des mots, pas du sens.</strong> Un engagement formulé dans un
              vocabulaire entièrement différent de celui du livrable peut être
              déclaré manquant à tort. Traitez le résultat comme une alerte à
              vérifier, pas comme un feu vert.
            </li>
            <li>
              <strong className="text-slate-800">Certains findings ne proposent
              aucune correction.</strong> « Cet acronyme est défini plus loin »
              ou « ces deux montants divergent » désignent quelque chose à
              regarder ; le bon correctif est une décision que seul l'auteur peut
              prendre. Ils apparaissent sans bloc de remplacement et n'entrent
              pas dans le document régénéré.
            </li>
            <li>
              <strong className="text-slate-800">La limite horaire est au
              mieux.</strong> Elle compte dans la mémoire d'une seule instance
              serverless et repart à zéro au démarrage à froid.
            </li>
            <li>
              <strong className="text-slate-800">Le corpus d'évaluation est
              mince.</strong> Deux documents annotés valident le harnais, pas la
              qualité des prompts. Les chiffres de précision et de rappel de la
              revue complète restent à mesurer sur un vrai corpus.
            </li>
          </ul>
        </Section>

        <Section
          id="garde-fous"
          title="13. Les garde-fous de dépense"
          lead="Un mot de passe décide qui entre ; il ne dit rien de combien on peut brûler une fois dedans."
        >
          <Table
            head={['Mécanisme', 'Défaut', 'Force']}
            rows={[
              [<Code>SITE_PASSWORD</Code>, 'Non défini', 'Cookie signé HMAC, vérifié par le proxy et par chaque route'],
              [<Code>MAX_PAGES</Code>, '80', 'Dur — refusé avant le moindre appel'],
              [<Code>MAX_CALLS_PER_REVIEW</Code>, '200', 'Dur — refusé avant le moindre appel'],
              [<Code>REVIEWS_PER_HOUR</Code>, '30', 'Au mieux — mémoire d\'une instance'],
              ['Plafond de dépense OpenAI', 'À définir sur le compte', 'Le seul qui tienne face à un mot de passe qui fuite ou à un bug'],
            ]}
          />
        </Section>

        <Section id="tests" title="14. Ce qui est vérifié automatiquement">
          <Table
            head={['Commande', 'Ce qu’elle couvre']}
            rows={[
              [<Code>npm test</Code>, 'Fonctions pures : planification, estimation, fusion des corrections, politiques de vérification, contrôles déterministes, sessions, garde-fous — plus deux allers-retours Word et PowerPoint complets'],
              [<Code>npm run bench</Code>, 'Précision et rappel des contrôles déterministes sur un corpus annoté'],
              [<Code>npm run bench -- --model</Code>, 'La revue complète, appels réels : annonce la dépense et demande confirmation'],
              [<Code>npm run check:rewrite -- fichier.docx</Code>, 'Régénération d\'un document réel : applique une correction d\'épreuve par phrase et vérifie que rien d\'autre n\'a bougé'],
            ]}
          />
        </Section>
      </div>

      <footer className="mt-16 border-t border-slate-200 pt-6 text-[12px] text-slate-400">
        Page non liée depuis l'application et non indexée. Elle décrit le code
        de la branche courante ; les plans détaillés vivent dans{' '}
        <Code>docs/</Code>.
      </footer>
    </main>
  );
}
