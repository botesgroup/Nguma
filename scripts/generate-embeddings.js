/**
 * Script: Génération des embeddings pour la base de connaissances
 * 
 * Ce script génère les embeddings Gemini pour tous les articles
 * de la knowledge_base qui n'en ont pas encore.
 * 
 * Usage: node scripts/generate-embeddings.js
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kaqxoavnoabcnszzmwye.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

if (!SUPABASE_SERVICE_KEY || !GEMINI_API_KEY) {
    console.error('❌ Erreur: SUPABASE_SERVICE_ROLE_KEY et GEMINI_API_KEY doivent être définis')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function generateEmbeddings() {
    try {
        console.log('🔍 Récupération des articles sans embedding...')

        const { data: articles, error: fetchError } = await supabase
            .from('knowledge_base')
            .select('id, title, content')
            .is('embedding', null)
            .eq('is_active', true)

        if (fetchError) throw fetchError

        if (!articles || articles.length === 0) {
            console.log('✅ Tous les articles ont déjà des embeddings')
            return
        }

        console.log(`📚 ${articles.length} articles à traiter\n`)

        let processedCount = 0
        let errorCount = 0

        for (const article of articles) {
            try {
                const textToEmbed = `${article.title}\n\n${article.content}`

                console.log(`⏳ Traitement: "${article.title}"...`)

                // Générer l'embedding
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            model: 'models/text-embedding-004',
                            content: { parts: [{ text: textToEmbed }] }
                        })
                    }
                )

                if (!response.ok) {
                    const errorText = await response.text()
                    console.error(`❌ Erreur API Gemini pour "${article.title}":`, errorText)
                    errorCount++
                    continue
                }

                const embeddingData = await response.json()
                const embedding = embeddingData.embedding.values

                // Sauvegarder l'embedding
                const { error: updateError } = await supabase
                    .from('knowledge_base')
                    .update({ embedding: embedding })
                    .eq('id', article.id)

                if (updateError) {
                    console.error(`❌ Erreur sauvegarde pour "${article.title}":`, updateError)
                    errorCount++
                    continue
                }

                processedCount++
                console.log(`✅ Embedding généré pour: "${article.title}"`)

                // Pause pour respecter rate limit (2 req/sec max)
                await new Promise(resolve => setTimeout(resolve, 600))

            } catch (error) {
                console.error(`❌ Erreur pour "${article.title}":`, error.message)
                errorCount++
            }
        }

        console.log(`\n📊 Résumé:`)
        console.log(`   ✅ Traités: ${processedCount}/${articles.length}`)
        console.log(`   ❌ Erreurs: ${errorCount}`)

    } catch (error) {
        console.error('❌ Erreur générale:', error)
        process.exit(1)
    }
}

generateEmbeddings()
