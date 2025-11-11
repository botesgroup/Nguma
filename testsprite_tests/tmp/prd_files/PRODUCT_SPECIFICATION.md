# Product Specification Doc: Nguma

## 1. Vue d'ensemble

**Nguma** est une plateforme d'investissement privée permettant aux utilisateurs (Investisseurs) de déposer des fonds, de souscrire à des contrats d'investissement, et de percevoir des profits mensuels. La plateforme inclut un tableau de bord d'administration complet pour la gestion des utilisateurs, des transactions, des contrats et des paramètres globaux.

## 2. Rôles des Utilisateurs

Il existe deux rôles principaux dans l'application :

*   **Investisseur (Investor) :** Le rôle par défaut pour tout nouvel utilisateur. Les investisseurs peuvent gérer leurs propres investissements et leur profil.
*   **Administrateur (Admin) :** Un rôle avec des privilèges élevés qui peut superviser et gérer l'ensemble de la plateforme.

---

## 3. Fonctionnalités pour l'Investisseur

### 3.1. Authentification
*   **Inscription :** Un nouvel utilisateur peut créer un compte avec une adresse e-mail et un mot de passe.
*   **Connexion :** Un utilisateur existant peut se connecter.
*   **Déconnexion :** Un utilisateur connecté peut se déconnecter.
*   **Création automatique :** Lors de la première inscription, un profil, un portefeuille (`wallet`), et un rôle (`investor`) sont automatiquement créés pour l'utilisateur.

### 3.2. Gestion de Profil
*   **Complétion de profil :** Après l'inscription, l'utilisateur est forcé de compléter son profil (nom, prénom, etc.) avant de pouvoir accéder au reste de l'application.
*   **Mise à jour :** L'utilisateur peut mettre à jour les informations de son profil à tout moment.

### 3.3. Gestion du Portefeuille (Wallet)
*   L'utilisateur peut consulter son portefeuille, qui affiche trois soldes distincts :
    *   **Solde Principal (`total_balance`) :** Fonds disponibles pour l'investissement ou le retrait.
    *   **Solde Investi (`invested_balance`) :** Total des fonds actuellement bloqués dans des contrats actifs.
    *   **Solde de Profit (`profit_balance`) :** Total des profits générés, disponibles pour le retrait ou le réinvestissement.

### 3.4. Flux de Dépôt
1.  L'utilisateur initie une demande de dépôt en spécifiant un montant.
2.  La transaction est créée avec le statut `pending`.
3.  Les administrateurs sont notifiés.
4.  L'utilisateur reçoit une notification lorsque le dépôt est approuvé ou rejeté par un administrateur. Si approuvé, le montant est ajouté à son **Solde Principal**.

### 3.5. Flux de Retrait
1.  L'utilisateur peut demander un retrait **uniquement depuis son Solde de Profit**.
2.  La transaction est créée avec le statut `pending`.
3.  Les administrateurs sont notifiés.
4.  Si un administrateur approuve, le montant est déduit du **Solde de Profit** et du **Solde Principal**. L'utilisateur est notifié.

### 3.6. Gestion des Contrats
*   **Création :** L'utilisateur peut créer un nouveau contrat en investissant un montant depuis son **Solde Principal**. Le montant est alors transféré vers son **Solde Investi**.
*   **Consultation :** L'utilisateur peut voir la liste de tous ses contrats (actifs, terminés, etc.) avec leurs détails (montant, progression, dates).
*   **Demande de Remboursement Anticipé :**
    1.  Un utilisateur peut demander un remboursement pour un contrat **actif** ayant moins de **5 mois** de profits versés.
    2.  L'action change le statut du contrat à `pending_refund` et notifie les administrateurs.
    3.  L'utilisateur est notifié lorsque la demande est approuvée ou rejetée. Si approuvée, le montant remboursé (capital - profits déjà versés) est ajouté à son **Solde Principal**.

### 3.7. Notifications
*   L'utilisateur reçoit des notifications pour les actions importantes : approbation/rejet de dépôts, retraits, remboursements, et versement des profits mensuels.

---

## 4. Fonctionnalités pour l'Administrateur

### 4.1. Tableau de Bord
*   L'administrateur a accès à un tableau de bord principal affichant des statistiques globales : nombre total d'investisseurs, fonds totaux sous gestion, profits totaux générés, et montants des dépôts/retraits en attente.

### 4.2. Gestion des Utilisateurs (Investisseurs)
*   **Liste :** L'administrateur peut voir la liste de tous les investisseurs avec leurs informations clés (nom, email, soldes).
*   **Opérations :** Pour chaque utilisateur, l'admin peut :
    *   Voir les détails complets (profil, portefeuille, contrats, transactions).
    *   Modifier le profil de l'utilisateur.
    *   Activer ou désactiver le compte de l'utilisateur.
    *   Créditer manuellement le portefeuille d'un utilisateur.

### 4.3. Gestion des Transactions
*   **Dépôts en attente :** L'admin a une page dédiée pour voir tous les dépôts en attente. Il peut les **approuver** ou les **rejeter** (individuellement ou en masse).
*   **Retraits en attente :** L'admin a une page dédiée pour voir tous les retraits en attente. Il peut les **approuver** ou les **rejeter**.

### 4.4. Gestion des Remboursements
*   **Remboursements en attente :** L'admin a une page dédiée (`/admin/refunds`) pour voir toutes les demandes de remboursement de contrat.
*   Pour chaque demande, il peut **approuver** (ce qui exécute le remboursement) ou **rejeter** (ce qui remet le contrat en statut `active`).

### 4.5. Gestion des Contrats (CRUD)
*   **Lecture (Read) :** L'admin a une page dédiée (`/admin/contracts`) pour lister, rechercher et filtrer **tous les contrats** de la plateforme.
*   **Mise à Jour (Update) :** Depuis cette liste, l'admin peut **modifier** un contrat existant. Les champs modifiables sont :
    *   `status` (active, completed, cancelled, etc.)
    *   `end_date`
    *   `duration_months`
    *   `months_paid`
    *   `total_profit_paid`
    *   `monthly_rate`
*   **Suppression (Delete) :** La suppression est une "suppression logique" effectuée en modifiant le statut du contrat à `cancelled`.

---

## 5. Règles Métier Clés à Tester

*   Un retrait ne peut pas être supérieur au **Solde de Profit**.
*   Un investissement ne peut pas être supérieur au **Solde Principal**.
*   Une demande de remboursement n'est possible que si `months_paid < 5`.
*   Le montant remboursé est égal à `amount - total_profit_paid`.
*   Les soldes du portefeuille (`total_balance`, `invested_balance`, `profit_balance`) doivent être correctement mis à jour après chaque opération (investissement, approbation de dépôt, approbation de remboursement, versement de profit).
*   Les utilisateurs non-administrateurs ne doivent avoir aucun accès aux routes commençant par `/admin`.
*   Les utilisateurs doivent compléter leur profil avant d'accéder aux fonctionnalités principales.
