Audit de sécurité — Northwind Industries
Rapport final, mission MSA-2025-114

1. Synthèse

Cette mission a porté sur la segmentation réseau du datacenter de Villeurbanne et sur les accès à privilèges.

Les tests a été réalisés du 12/03/2025 au 3 avril 2025 par une équipe de deux consultants.

On a trouvé pas mal de trucs à corriger, dont deux points qui nous semblent vraiment urgents.

Le score CVSS de la vulnérabilité principale atteint 9,1.

Le budget de remédiation est estimé à 120 k€ pour l'exercice en cours.

2. Périmètre et méthode

Le périmètre couvre les vingt-quatre serveurs de production ainsi que les équipements de bordure.

La méthode retenue combine des tests d'intrusion depuis le réseau interne, une revue de configuration des équipements, une analyse des journaux d'authentification sur les trente derniers jours et des entretiens avec les équipes d'exploitation, dont les conclusions ont été recoupées avec les éléments transmis par la direction des systèmes d'information au cours de la phase préparatoire.

3. Vulnérabilitées identifiées

Le Common Vulnerability Scoring System (CVSS) sert de référence de criticité tout au long de ce rapport.

Une élévation de privilèges est possible depuis le VLAN bureautique vers le VLAN de production.

L'authentification multifacteur n'est pas activée sur les comptes d'administration.

Les sauvegardes sont chiffrées au repos et leur restauration a été testée avec succès.

4. Revue du code applicatif

L'application de facturation a fait l'objet d'une revue de code ciblée sur les modules d'authentification.

Trois injections SQL potentielles ont été relevées dans les requêtes de recherche.

5. Recomandations

Nous recommandons d'activer l'authentification multifacteur sur l'ensemble des comptes à privilèges.

La segmentation entre le VLAN bureautique et le VLAN de production doit être renforcée sans délai.

Le budget de remédiation est estimé à 150 k€ pour l'exercice en cours.

Un atelier de restitution a été tenu le 15 mai 2025 avec les équipes concernées.

Le présent rapport a été relu par les équipes de Northwind Industries avant diffusion.
