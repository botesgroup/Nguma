-- ============================================================
-- SCRIPT: Peuplement Base de Connaissances Nguma
-- ============================================================
-- Insère le contenu du contrat, FAQ et guides dans knowledge_base
-- pour améliorer les réponses du chatbot IA

-- ============================================================
-- 1. CONTRAT NGUMA (Articles structurés)
-- ============================================================

INSERT INTO knowledge_base (title, content, category, is_active) VALUES

-- Article 1-2: Identification et Objet
('Qui est BOTES GROUP S.A.R.L ?',
'BOTES GROUP S.A.R.L est l''entreprise derrière Nguma. Elle est enregistrée en République Démocratique du Congo avec:
- RCCM : KNM/RCCM/24-B-00077
- N.I.N. : 01-H5300-N52168J
- Siège : 295, Avenue Mbomu, Lingwala, Kinshasa – RDC
- Contact : +243 838 953 447

L''entreprise est représentée par Monsieur Esaïe BOTENDJA, fondateur et créateur du Robot Trading Nguma.', 
'company', true),

('Qu''est-ce que le contrat Nguma ?',
'Le contrat Nguma est un contrat de gestion automatisée exécuté par le robot de trading Nguma. 

**Important** :
- Ce n''est PAS un produit d''investissement bancaire
- Ce n''est PAS une épargne
- Ce n''est PAS un placement garanti

C''est une plateforme de gestion déléguée qui met en relation votre capital avec le Robot Trading Nguma opérant sur MetaTrader 5.',
'contracts', true),

-- Article 3: Nature du contrat
('Comment fonctionne la plateforme Nguma ?',
'Nguma est une plateforme de visualisation et de gestion. Elle permet uniquement :

1. **La création et la gestion des contrats** : Vous pouvez créer un nouveau contrat en choisissant le montant.
2. **La visualisation des profits** : Vous voyez vos profits mensuels dans votre tableau de bord.
3. **Les demandes de dépôt et retrait** : Vous pouvez demander à déposer ou retirer vos profits.

**Fonctionnement décentralisé** :
Les exécutions opérationnelles, sauvegardes et calculs sont traités **hors plateforme**, de manière décentralisée. Cela signifie que même si le site est indisponible, vos contrats restent actifs et sécurisés.',
'general', true),

-- Article 4: Capital
('Le capital investi est-il remboursable ?',
'**NON. Le capital investi est DÉFINITIVEMENT NON REMBOURSABLE.**

Points importants :
- ❌ Il ne peut PAS être retiré pendant le contrat
- ❌ Il ne peut PAS être retiré après le contrat
- ❌ Aucune situation personnelle ne donne droit à un remboursement

Le capital est considéré comme un **montant à risque** utilisé dans le processus de trading algorithmique.

**Ce que vous pouvez retirer** : Uniquement les **profits** mensuels (20% par mois). Le capital reste définitivement dans le système.',
'contracts', true),

('Quel est le montant minimum pour créer un contrat ?',
'Il n''y a pas de montant minimum fixe. Vous choisissez **librement** le montant que vous souhaitez investir dans votre contrat.

**Conseil** : Investissez uniquement l''argent que vous êtes prêt à perdre, car le capital n''est pas remboursable et le trading comporte des risques.',
'contracts', true),

-- Article 5: Durée
('Quelle est la durée d''un contrat Nguma ?',
'Un contrat Nguma a une **durée fixe de 10 mois**.

- ✅ Le contrat expire automatiquement après 10 mois
- ❌ Il n''est PAS renouvelé automatiquement
- ℹ️ Vous pouvez créer un nouveau contrat après expiration

Pendant ces 10 mois, vous recevez 20% de votre capital chaque mois, soit 200% au total sur la période.',
'contracts', true),

-- Article 6: Rendements
('Comment sont calculés les profits ?',
'Les profits sont calculés ainsi :

**Taux mensuel** : 20% du capital investi
**Durée** : 10 mois
**Total** : 200% du capital

**Répartition** :
- **Mois 1 à 5** : Considérés comme retour sur investissement (ROI) = 100% du capital
- **Mois 6 à 10** : Considérés comme intérêts = 100% supplémentaires

**Exemple** : Si vous investissez 1000 USD
- Vous recevez 200 USD chaque mois
- Pendant 10 mois
- Total des profits : 2000 USD

**Retrait** : Les profits deviennent retirables dès leur apparition dans votre tableau de bord.',
'contracts', true),

('Quand puis-je retirer mes profits ?',
'Vous pouvez retirer vos profits **dès qu''ils apparaissent** dans votre tableau de bord.

**Processus** :
1. Les profits sont distribués mensuellement (20% du capital)
2. Ils apparaissent dans votre solde "Profits"
3. Vous pouvez immédiatement faire une demande de retrait
4. Les admins traitent votre demande de retrait

**Important** : Vous ne pouvez retirer QUE les profits, jamais le capital investi.',
'payments', true),

-- Article 7: Assurance Capital
('Qu''est-ce que l''Assurance Capital ?',
'L''**Assurance Capital** est une **option payante et facultative** que vous pouvez souscrire lors de la création de votre contrat.

**Garantie** :
- ✅ Couvre 5 mois de profits garantis (équivalent à 100% du capital)
- ✅ Même en cas d''arrêt des opérations, pertes ou perturbations sévères du marché
- ⚠️ Ne couvre PAS les intérêts des mois 6 à 10

**Sans assurance** :
- ❌ Aucune garantie n''est fournie, même partielle
- ⚠️ Vous assumez tous les risques

**Conseil** : L''assurance est recommandée si vous voulez sécuriser au minimum votre capital investi (vous récupérez 100% via les 5 premiers mois garantis).',
'contracts', true),

-- Article 8: Multiples contrats
('Puis-je avoir plusieurs contrats en même temps ?',
'**OUI**, vous pouvez ouvrir **plusieurs contrats simultanément**.

**Fonctionnement** :
- Chaque contrat est traité **indépendamment**
- Chaque contrat a ses propres rendements
- Chaque contrat a sa propre échéance (10 mois)

**Exemple** : Vous pouvez avoir :
- Contrat 1 : 1000 USD créé en janvier
- Contrat 2 : 500 USD créé en mars
- Contrat 3 : 2000 USD créé en juin

Tous seront gérés séparément avec leurs propres calendriers de profits.',
'contracts', true),

-- Article 9: Sécurité
('Que se passe-t-il si le site Nguma est indisponible ?',
'En cas d''indisponibilité du site (maintenance, piratage, panne), **vos contrats restent protégés**.

**Architecture décentralisée** :
- Les contrats restent **actifs** hors plateforme
- Les profits déjà générés **ne sont pas annulés**
- Les opérations internes se poursuivent **indépendamment du site**

**Données sécurisées** :
- Bases de données externes
- Sauvegardes régulières
- Systèmes indépendants de Nguma.org

**Contact** : En cas de problème, contactez BOTES GROUP S.A.R.L via :
- Téléphone : +243 838 953 447
- Adresse : 295, Avenue Mbomu, Lingwala, Kinshasa – RDC',
'security', true),

-- Article 10-11: Interdictions et Risques
('Nguma est-il un système Ponzi ou de parrainage ?',
'**NON. Nguma n''est NI un système Ponzi, NI un système de parrainage.**

**Pourquoi ?**
- ❌ Aucun système de parrainage n''existe
- ❌ Aucune affiliation
- ❌ Aucun recrutement
- ❌ Nguma ne repose pas sur l''argent de nouveaux membres

**Ce qui est interdit** :
- Présenter Nguma comme un placement garanti
- Faire du recrutement ou parrainage
- Promettre des rendements à autrui en utilisant le nom de Nguma
- Diffuser des informations fausses

**Ce qu''est Nguma** : Une plateforme de gestion de contrats exécutés par un robot de trading sur MetaTrader 5.',
'general', true),

('Quels sont les risques liés à Nguma ?',
'Le trading algorithmique comporte des **risques élevés**. Vous devez comprendre :

**Risques** :
1. ⚠️ Les performances passées ne garantissent pas les résultats futurs
2. ⚠️ Le capital peut être partiellement ou totalement perdu
3. ⚠️ Les marchés financiers sont imprévisibles
4. ⚠️ Sans assurance, aucune garantie n''est fournie

**Responsabilité** :
- Vous investissez **volontairement**, sans pression
- Vous êtes **seul responsable** de votre décision
- Investissez uniquement l''argent que vous êtes **prêt à perdre**

**Protection légale** :
Vous ne pouvez engager aucune action judiciaire concernant :
- La perte de capital (sans assurance)
- Les variations du marché
- Les interruptions techniques de MetaTrader 5
- La faillite du broker',
'general', true);

-- ============================================================
-- 2. FAQ EXISTANTES (depuis Index.tsx)
-- ============================================================

INSERT INTO knowledge_base (title, content, category, is_active) VALUES

('Y a-t-il des frais cachés ?',
'**NON, aucun frais caché.**

La transparence est au cœur de nos valeurs. Tous les frais ou commissions éventuels sont **clairement indiqués** avant que vous ne preniez une décision.

**Frais possibles** :
- Frais d''assurance capital (si vous optez pour l''assurance)
- Frais de retrait (si applicables)

Tout est affiché AVANT validation, aucune surprise.',
'payments', true),

('Qui contacter si le site devient indisponible ou subit une tentative de piratage ?',
'**Coordonnées officielles de BOTES GROUP S.A.R.L** :

📞 **Téléphone** : +243 838 953 447
📍 **Adresse** : 295, Avenue Mbomu, Lingwala, Kinshasa – RDC
🏢 **RCCM** : KNM/RCCM/24-B-00077

**Architecture sécurisée** :
Nguma fonctionne de manière **décentralisée**. La plateforme sert uniquement à visualiser vos contrats. L''exécution, la gestion et la sécurisation des opérations sont traitées **en dehors de la plateforme**, à travers différentes bases de données et systèmes de sauvegarde.

**En cas d''indisponibilité** :
- Vos contrats restent actifs
- Vos données sont sauvegardées
- Contactez l''entreprise via les coordonnées ci-dessus',
'security', true);

-- ============================================================
-- 3. GUIDES PRATIQUES
-- ============================================================

INSERT INTO knowledge_base (title, content, category, is_active) VALUES

('Comment créer mon premier contrat ?',
'**Étapes pour créer un contrat** :

1. **Connectez-vous** à votre compte Nguma
2. **Déposez des fonds** dans votre portefeuille (section "Transactions" > "Déposer")
3. **Attendez l''approbation** du dépôt par les admins
4. Une fois approuvé, allez dans **"Tableau de bord"**
5. Cliquez sur **"Nouveau Contrat"**
6. Choisissez :
   - Le montant à investir
   - Si vous voulez l''**Assurance Capital** (recommandé)
7. Acceptez les termes du contrat
8. Confirmez la création

Votre contrat démarre immédiatement et vous recevrez votre premier profit 1 mois après.',
'contracts', true),

('Comment faire un dépôt ?',
'**Processus de dépôt** :

1. Allez dans **"Transactions"** > **"Déposer"**
2. Choisissez la **méthode de paiement** (crypto, mobile money, etc.)
3. Entrez le **montant** que vous souhaitez déposer
4. Suivez les **instructions de paiement** affichées
5. **Envoyez la preuve** de paiement (capture d''écran, reçu)
6. **Attendez l''approbation** par les administrateurs

**Délai** : Les dépôts sont généralement approuvés sous 24h.

Une fois approuvé, le montant apparaît dans votre portefeuille et vous pouvez créer un contrat.',
'payments', true),

('Comment retirer mes profits ?',
'**Processus de retrait** :

1. Allez dans **"Transactions"** > **"Retirer"**
2. Vérifiez que vous avez des **profits disponibles** (pas le capital)
3. Entrez le **montant** à retirer
4. Choisissez la **méthode de retrait** (même que dépôt généralement)
5. Fournissez les **coordonnées de paiement** (numéro, adresse wallet, etc.)
6. Validez la demande

**Traitement** : Les administrateurs traitent les demandes et effectuent le paiement.

**Important** : Vous ne pouvez retirer QUE les profits, jamais le capital investi.',
'payments', true);
