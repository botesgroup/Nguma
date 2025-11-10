### **Document d'Analyse et Feuille de Route – Projet Nguma**

Ce document a pour but de synthétiser l'état actuel de l'application Nguma et de définir les prochaines étapes de développement.

### **Partie 1 : État Actuel du Projet (Où nous sommes)**

#### **1.1. Mission et Concept Central**

Nguma est une plateforme de gestion d'investissements permettant à des utilisateurs de placer des fonds dans des contrats, de suivre leurs profits de manière transparente et de gérer leurs transactions. Le système est contrôlé par des administrateurs via un tableau de bord dédié, garantissant la sécurité et la supervision des opérations financières.

#### **1.2. Architecture Technique**

*   **Frontend :** L'application est construite avec **React** et **TypeScript**, en utilisant **Vite** comme outil de build. L'interface est conçue avec **shadcn-ui** et **Tailwind CSS**, offrant un design moderne et réactif.
*   **Backend & Base de Données :** Le projet repose entièrement sur **Supabase**, qui fournit la base de données PostgreSQL, le système d'authentification (Auth), la gestion des accès (RLS), et l'environnement pour les fonctions serveur (Edge Functions).
*   **Logique Métier :** Une grande partie de la logique métier critique (création de contrat, distribution des profits, approbation des transactions) est encapsulée dans des **fonctions PostgreSQL (RPC)**. C'est une approche robuste qui garantit la sécurité et l'atomicité des opérations financières.

#### **1.3. Analyse des Fonctionnalités Implémentées**

*   **Espace Investisseur :**
    *   **Tableau de Bord :** Affiche une vue d'ensemble claire des finances de l'utilisateur (**Montant Déposé**, Montant investi, Profits disponibles) et la liste de ses contrats actifs. Le graphique de performance visualise les profits mensuels générés **uniquement par les contrats actifs**, sur une période de 10 mois.
    *   **Création de Contrat :** L'utilisateur peut créer un nouveau contrat en investissant la totalité de son solde disponible. La durée est un paramètre global géré par l'admin.
    *   **Historique des Transactions :** Une page complète et performante avec recherche, filtrage par type, et **pagination** pour consulter tout l'historique.
    *   **Système de Dépôt/Retrait :** Le système de dépôt est actuellement une **simulation**. L'utilisateur déclare son intention de déposer, ce qui crée une transaction en attente que l'admin doit valider après une vérification manuelle (hors-plateforme). Le système de retrait est également manuel.

*   **Espace Administration :**
    *   **Tableau de Bord Global :** Fournit des statistiques sur l'ensemble de la plateforme (nombre d'investisseurs, fonds gérés, profits totaux, transactions en attente).
    *   **Gestion des Transactions :** Interfaces dédiées pour lister les dépôts et retraits en attente, et pour les **approuver** ou les **rejeter**.
    *   **Gestion des Utilisateurs :** Une liste paginée et consultable de tous les investisseurs avec leurs informations clés (incluant les nouveaux champs de profil).
    *   **Gestion des Paramètres :** Une interface pour modifier les variables globales de l'application, comme le taux de profit et la durée des contrats.

*   **Systèmes Automatisés :**
    *   **Distribution des Profits :** Un système intelligent basé sur un **Cron Job quotidien** qui distribue les profits selon un **modèle d'anniversaire** propre à chaque contrat, garantissant l'équité et la précision des paiements.
    *   **Système de Notifications :** Polling-based notifications avec alertes visuelles et **sonores**.

*   **Système de Profil Client Détaillé et Obligatoire :**
    *   **Nouvelle Structure :** La table `profiles` a été mise à jour avec des champs détaillés : `first_name`, `last_name`, `post_nom`, `birth_date`, `address`, `phone`, `country`.
    *   **Page de Profil :** Une page dédiée (`/profile`) permet aux utilisateurs de consulter et de mettre à jour ces informations.
    *   **"Gardien" de Profil :** Un système (`ProfileCompletionGuard`) force les utilisateurs à compléter tous les champs obligatoires de leur profil (prénom, nom, post-nom, téléphone, pays, adresse, date de naissance) avant d'accéder aux autres fonctionnalités de l'application. Un `AlertDialog` s'affiche sur la page de profil pour inviter l'utilisateur à compléter ses informations.
    *   **Formulaire d'Inscription :** Le formulaire d'inscription a été mis à jour pour collecter `first_name`, `last_name`, et `post_nom`.
    *   **Menu Utilisateur :** Un menu déroulant dans l'en-tête (`UserNav`) permet d'accéder au profil et à la déconnexion.

*   **Page d'Accueil (Landing Page) :**
    *   Contient une section FAQ.
    *   Le bouton "En savoir plus" redirige vers la page "Comment Ça Marche".
    *   Les animations 3D ont été retirées pour des raisons de performance.

---

### **Partie 2 : Journal des Modifications (Dernières Interventions)**

Cette section documente les améliorations et corrections récentes apportées au projet.

#### **2.1. Gestion des Contrats PDF**

*   **Téléversement par l'Admin :**
    *   Une interface a été ajoutée dans la section d'administration pour permettre le téléversement d'un **fichier PDF de contrat unique** pour chaque contrat d'un utilisateur.
    *   La base de données a été mise à jour pour stocker l'URL de chaque PDF de contrat.
    *   Les politiques de sécurité de Supabase Storage ont été configurées pour garantir que seuls les administrateurs peuvent téléverser des contrats et que seuls le propriétaire du contrat et les administrateurs peuvent les consulter.

*   **Téléchargement par l'Utilisateur :**
    *   Sur la page "Mes Contrats", un bouton "Télécharger PDF" a été ajouté à chaque carte de contrat. Ce bouton est actif uniquement si un PDF a été téléversé par l'administrateur.

*   **Contrat Générique pour la Création :**
    *   Le texte statique des termes et conditions dans la boîte de dialogue de création de contrat a été remplacé par un lien vers un **PDF de contrat générique**.
    *   Une section a été ajoutée dans les paramètres d'administration pour permettre le téléversement et la gestion de ce PDF générique.

#### **2.2. Améliorations de la Page de Profil**

*   **Correction du Bug de l'Alerte :**
    *   Le bug qui empêchait de fermer la boîte de dialogue "Profil incomplet" a été corrigé. Le bouton "Compris" est maintenant fonctionnel.

*   **Amélioration du Sélecteur de Date de Naissance :**
    *   Le calendrier de sélection de la date de naissance a été entièrement revu pour inclure des **listes déroulantes pour le mois et l'année**.
    *   Cette modification résout le problème de navigation dans les années et garantit une apparence visuelle cohérente avec le reste de l'application.

#### **2.3. Amélioration du Système de Dépôt**

*   **Ajout de la Preuve de Paiement :**
    *   Le processus de dépôt a été amélioré pour inclure un système de preuve de paiement :
        *   Pour les dépôts **Crypto**, l'utilisateur doit maintenant fournir l'**ID de la transaction (TxID)**.
        *   Pour les dépôts **Mobile Money**, l'utilisateur doit fournir son **numéro de téléphone**.
    *   La base de données a été mise à jour pour stocker ces informations.

*   **Mise à Jour de l'Interface Admin :**
    *   Le tableau des dépôts en attente affiche désormais la **preuve de paiement** (TxID ou numéro de téléphone), permettant à l'administrateur de vérifier plus facilement et rapidement la validité des dépôts.

#### **2.4. Résolution de la Dette Technique**

*   **Scriptage des Fonctions RPC :**
    *   Les fonctions RPC critiques `request_deposit` et `approve_deposit`, qui étaient auparavant créées manuellement, ont été **scriptées dans des fichiers de migration**. 
    *   Cette action cruciale élimine une dette technique majeure, rendant le projet plus robuste, maintenable et facilement redéployable.

#### **2.5. Améliorations du Tableau de Bord Administrateur (Session du 08/11/2025)**

Une session de développement intensive a été menée pour améliorer l'efficacité et l'ergonomie de l'espace d'administration.

*   **Tableau de Bord Interactif :**
    *   Les cartes de statistiques "Dépôts en attente" et "Retraits en attente" sont désormais **cliquables** et redirigent directement vers les pages de gestion respectives.

*   **Actions Rapides sur la Liste des Investisseurs :**
    *   Un menu "..." a été ajouté à chaque ligne de la table des investisseurs.
    *   **"Voir les détails" :** Ouvre une fenêtre modale avec une vue complète de l'utilisateur (profil, portefeuille, etc.) et permet de créditer manuellement son compte.
    *   **"Voir les contrats" :** Une page dédiée a été créée pour afficher les contrats d'un utilisateur spécifique. *(Note : cette fonctionnalité est actuellement bloquée par un problème de déploiement de base de données).*

*   **Améliorations de la Table des Investisseurs :**
    *   **Export CSV :** Un bouton "Exporter" a été ajouté pour télécharger la liste complète des investisseurs au format CSV.
    *   **Filtre par Statut :** Une liste déroulante permet de filtrer les investisseurs affichés (sur la page courante) par statut ("Actif", "Inactif", "Nouveau").

*   **Mises à Jour en Temps Réel :**
    *   Le tableau de bord utilise maintenant les **Supabase Realtime Subscriptions** pour mettre à jour les statistiques (comme les dépôts en attente) instantanément, sans nécessiter de rafraîchissement de la page.

*   **Améliorations de la Table des Investisseurs :**
    *   **Export CSV :** Un bouton "Exporter" a été ajouté pour télécharger la liste complète des investisseurs au format CSV.
    *   **Filtre par Statut :** Une liste déroulante permet de filtrer les investisseurs affichés (sur la page courante) par statut ("Actif", "Inactif", "Nouveau").

*   **Mises à Jour en Temps Réel :**
    *   Le tableau de bord utilise maintenant les **Supabase Realtime Subscriptions** pour mettre à jour les statistiques (comme les dépôts en attente) instantanément, sans nécessiter de rafraîchissement de la page.

*   **Traitement par Lot (En cours) :**
    *   L'interface pour le traitement en masse des dépôts (cases à cocher, boutons d'action) a été entièrement développée.
    *   Les fonctions backend (`approve_deposits_in_bulk`, `reject_deposits_in_bulk`) ont été créées. *(Note : cette fonctionnalité est également bloquée par le problème de déploiement).*

#### **2.6. Améliorations du Tableau de Bord Administrateur (Session du 10/11/2025)**

Une nouvelle session de développement a été menée pour améliorer davantage l'efficacité et l'ergonomie de l'espace d'administration, en se concentrant sur la gestion des utilisateurs et des transactions.

*   **Page des Paramètres (Admin Settings) :**
    *   **Contrôles de Formulaire Dynamiques :** Implémentation de contrôles de formulaire adaptés (interrupteurs pour les booléens, menus déroulants pour les sélections, champs numériques) basés sur le type de chaque paramètre.
    *   **Mise à jour de la Base de Données :** Ajout des colonnes `type` et `options` à la table `settings` pour supporter cette fonctionnalité.

*   **Gestion des Utilisateurs (Page `admin/users`) :**
    *   **Optimisation des Données :** Remplacement de la logique de récupération des données côté client par une fonction RPC (`get_investor_list_details`) plus efficace côté serveur, résolvant le problème N+1 et incluant le statut d'activation (`banned_until`) et le numéro de téléphone (`phone`).
    *   **Actions Utilisateur Étendues :** Le menu d'actions "..." pour chaque utilisateur inclut désormais :
        *   **"Créditer l'utilisateur" :** Ajout d'une boîte de dialogue pour créditer manuellement le portefeuille d'un utilisateur.
        *   **"Activer/Désactiver le compte" :** Ajout de la possibilité d'activer ou de désactiver un compte utilisateur avec une boîte de dialogue de confirmation. Un badge "Banni" s'affiche pour les utilisateurs désactivés.
        *   **"Modifier l'utilisateur" :** Ajout d'une boîte de dialogue pour modifier les informations de profil d'un utilisateur (prénom, nom, post-nom, téléphone).
    *   **Correction de Bug Majeur :** Résolution de l'erreur `DialogPortal must be used within Dialog` en refactorisant la structure des boîtes de dialogue pour qu'elles soient correctement imbriquées dans les menus déroulants.
    *   **Nettoyage :** Suppression du composant `UserList.tsx` obsolète.

*   **Gestion des Dépôts en Attente (Page `admin/deposits`) :**
    *   **Action "Ajuster le montant" :** Remplacement de l'action générique "Créditer l'utilisateur" par une action spécifique "Ajuster le montant" pour les dépôts en attente, permettant de modifier le montant d'un dépôt avant son approbation.
    *   **Mise à jour de la Base de Données :** Création de la fonction RPC `admin_adjust_deposit_amount` pour supporter cette fonctionnalité.

*   **Gestion des Retraits en Attente (Page `admin/withdrawals`) :**
    *   **Action "Créditer l'utilisateur" :** Ajout de l'option "Créditer l'utilisateur" dans le menu d'actions pour chaque retrait en attente.

*   **Gestion des Contrats PDF (Simplification) :**
    *   **Suppression de la Gestion par Contrat :** Suppression de la fonctionnalité de téléversement de PDF pour chaque contrat individuel. L'application utilise désormais exclusivement le contrat PDF générique géré dans les paramètres.
    *   **Nettoyage du Code :** Suppression de l'interface utilisateur de téléversement dans la boîte de dialogue "Gérer les Contrats" et suppression de la fonction `uploadContractPdf` du service.
    *   **Nettoyage de la Base de Données :** Suppression de la colonne `contract_pdf_url` de la table `contracts` et mise à jour de la fonction RPC `get_contracts_for_user` pour ne plus y faire référence.


---

### **Partie 3 : Feuille de Route (Ce que nous allons implémenter)**

Voici une proposition de feuille de route pour les futures évolutions du projet.

#### **2.1. Priorité Haute : Finaliser les Flux Financiers**

*   **Intégration d'une Passerelle de Paiement Semi-Automatique :**
    *   **Objectif :** Remplacer le système de dépôt simulé par une intégration réelle pour automatiser la création des transactions en attente.
    *   **Contexte :** L'intégration de Binance Pay a été tentée mais bloquée par la politique de restriction d'IP de Binance pour les clés API avec permissions d'écriture.
    *   **Action Requise :**
        1.  **Option A (Proxy) :** Explorer l'utilisation d'un service proxy tiers pour obtenir une adresse IP statique pour les Edge Functions, puis mettre cette IP sur liste blanche chez Binance. (Potentiellement coûteux et complexe).
        2.  **Option B (Autre Passerelle) :** Choisir un autre fournisseur de paiement fonctionnel en RDC (ex: **FlashPay**, **CinetPay**) qui est plus flexible avec les adresses IP dynamiques ou qui ne requiert pas de liste blanche IP stricte.
    *   **Implémentation :** Développer les Edge Functions (création de la demande de paiement) et le webhook (réception de la confirmation de paiement) nécessaires pour le fournisseur choisi.

#### **2.2. Fonctionnalités Majeures à Moyen Terme**

*   **Génération de Contrats en PDF :**
    *   **Objectif :** Permettre aux utilisateurs de télécharger une version PDF de leur contrat d'investissement lors de sa création.
    *   **Implémentation :** Utiliser une Edge Function avec une librairie comme `pdf-lib` ou un service externe pour générer le PDF à partir d'un modèle et des données du contrat. Le fichier serait ensuite stocké dans Supabase Storage.

*   **Notifications par E-mail :**
    *   **Objectif :** Envoyer un e-mail à l'utilisateur pour les notifications critiques (dépôt approuvé, profit reçu, etc.) afin qu'il soit informé même en dehors de l'application.
    *   **Action Requise :** Choisir un service d'envoi d'e-mails (ex: **Resend**) et obtenir une clé API.
    *   **Implémentation :** Créer une Edge Function qui se déclenche à chaque nouvelle notification pour envoyer l'e-mail correspondant.

#### **2.3. Évolutions Futures (Vision à Long Terme)**

*   **Introduction du Concept de "Projets" :** Faire évoluer le modèle pour permettre aux administrateurs de définir des projets d'investissement spécifiques (avec des taux/durées potentiellement différents) dans lesquels les utilisateurs peuvent choisir d'investir.
*   **Rapports Mensuels Automatisés :** Générer et envoyer automatiquement par e-mail un relevé de compte mensuel en PDF à chaque investisseur.
*   **Internationalisation (i18n) :** Traduire l'application en plusieurs langues (ex: Anglais) pour élargir l'audience.

---

### **Partie 4 : État Actuel et Prochaines Étapes Critiques**

#### **4.1. Blocage Actuel : Problème de Déploiement**

Le projet est actuellement dans un état **instable** et **bloqué**. Un problème de connexion réseau empêche la synchronisation des modifications locales de la base de données avec la base de données Supabase Cloud via la commande `supabase db push`.

**Conséquences :**
*   Plusieurs migrations de base de données critiques sont **en attente de déploiement**. Cela concerne la correction de la fonction `get_contracts_for_user` et la création des fonctions pour le traitement en masse.
*   Les fonctionnalités **"Voir les contrats"** et **"Traitement par lot des dépôts"** sont **non fonctionnelles** et génèrent des erreurs, car les fonctions backend dont elles dépendent ne sont pas déployées.

#### **4.2. Prochaine Étape Obligatoire**

**IL EST IMPÉRATIF DE NE PAS DÉVELOPPER DE NOUVELLES FONCTIONNALITÉS AVANT DE RÉSOUDRE CE PROBLÈME.**

1.  **Action Requise :** Attendre le rétablissement de la connexion réseau.
2.  **Commande à exécuter :** Lancer `supabase db push` pour appliquer toutes les migrations en attente.
3.  **Validation :** Tester les fonctionnalités "Voir les contrats" et "Traitement par lot" pour confirmer qu'elles fonctionnent comme prévu.

Une fois le projet stabilisé, la feuille de route définie dans la Partie 3 pourra être reprise.