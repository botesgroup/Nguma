/**
 * SOLUTION SIMPLIFIÉE: Générer Embeddings via Dashboard Supabase
 * 
 * Le script HTML ne fonctionne pas à cause des politiques RLS.
 * Voici une solution qui utilise la politique admin existante.
 */

// ============================================================
// ÉTAPES À SUIVRE:
// ============================================================

// 1. Connectez-vous à Nguma.org en tant qu'ADMIN
// 2. Ouvrez la console DevTools (F12)
// 3. Copiez-collez tout le code ci-dessous et appuyez sur Entrée

// ============================================================
// CODE À EXÉCUTER
// ============================================================

const GEMINI_KEY = 'AIzaSyA6KU2E_BKJewFG8JfLIGdvhR3h68wCn1A'; // Clé Gemini

// IDs des 18 articles sans embedding
const articleIds = [
    '6b66ee86-caf2-46b2-9624-89df91dbfec3', // Qui est BOTES GROUP
    'dd57ba82-9c07-4533-8b0e-f2b57af91215', // Qu'est-ce que le contrat
    '0a9c765d-ee09-4a84-8c86-8823a9c2fb46', // Comment fonctionne
    '0e3d9887-e3ad-4e98-ab1e-62354713ad13', // Capital remboursable
    '1e497a86-139f-4097-9b69-4eb478ebbb2c', // Montant minimum
    'dcd546b7-566e-4588-8db9-b883634fbd00', // Durée contrat
    '1f86f34a-d053-49ca-a85e-3619974ce5f6', // Calcul profits
    'c99918a7-870e-4ecb-ba70-f8cc011e717f', // Quand retirer
    'f7e351aa-3ae3-4a1d-9eb5-832c7f7c83df', // Assurance Capital
    'bcf2b03a-6ad2-46ea-8a1b-bb58b5db4bc5', // Multiples contrats
    'a09efcec-af2e-4cf3-9769-fdd571e75405', // Site indisponible
    '22f62794-4a45-44e5-9152-7a7a47e88ce7', // Ponzi/parrainage
    '4c4ff1c7-e3a5-4d5f-b512-b1838965b1c8', // Risques
    'f153558e-d18f-4233-9a67-941b5b2ce628', // Frais cachés
    '5d59693f-bd33-437b-a00e-987937949902', // Contact
    'b139b252-ec7e-49c4-bd2c-d67b5aec52a2', // Créer premier contrat
    'c656bc7b-8984-4a8d-ac2f-66c5b04f8a50', // Faire dépôt
    'e103f175-f5e3-46c6-8c82-a59b3d24c2a9'  // Retirer profits
];

async function generateAllEmbeddings() {
    console.log('🚀 Démarrage génération embeddings...');
    let success = 0;
    let errors = 0;

    for (let i = 0; i < articleIds.length; i++) {
        const id = articleIds[i];
        console.log(`\n⏳ [${i + 1}/${articleIds.length}] Traitement article ${id}...`);

        try {
            // 1. Récupérer l'article depuis Supabase (utilise votre session admin)
            const { data: articles, error: fetchError } = await window.supabase
                .from('knowledge_base')
                .select('title, content')
                .eq('id', id)
                .single();

            if (fetchError || !articles) {
                console.error(`❌ Impossible de récupérer l'article:`, fetchError);
                errors++;
                continue;
            }

            console.log(`   📖 Titre: "${articles.title}"`);

            // 2. Générer l'embedding avec Gemini
            const text = `${articles.title}\n\n${articles.content}`;
            const embResp = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: 'models/text-embedding-004',
                        content: { parts: [{ text }] }
                    })
                }
            );

            if (!embResp.ok) {
                console.error(`❌ Erreur API Gemini:`, await embResp.text());
                errors++;
                continue;
            }

            const embData = await embResp.json();
            const embedding = embData.embedding.values;

            // 3. Sauvegarder l'embedding (utilise votre session admin)
            const { error: updateError } = await window.supabase
                .from('knowledge_base')
                .update({ embedding: embedding })
                .eq('id', id);

            if (updateError) {
                console.error(`❌ Erreur sauvegarde:`, updateError);
                errors++;
                continue;
            }

            success++;
            console.log(`   ✅ Embedding sauvegardé !`);

            // Pause pour rate limit (max 2 req/sec pour Gemini)
            if (i < articleIds.length - 1) {
                await new Promise(r => setTimeout(r, 600));
            }

        } catch (error) {
            console.error(`❌ Erreur pour article ${id}:`, error);
            errors++;
        }
    }

    console.log(`\n\n🎉 TERMINÉ !`);
    console.log(`   ✅ Succès: ${success}/${articleIds.length}`);
    console.log(`   ❌ Erreurs: ${errors}`);

    if (success === articleIds.length) {
        console.log('\n✨ Tous les embeddings ont été générés avec succès !');
        console.log('🤖 Le chatbot est maintenant prêt à répondre aux questions.');
    }
}

// Lancer la génération
generateAllEmbeddings();
