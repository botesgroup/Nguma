import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Edge Function: Generate Embeddings for Knowledge Base
 * 
 * Cette fonction génère les embeddings pour tous les articles de la knowledge_base
 * qui n'ont pas encore d'embedding.
 * 
 * Usage: POST /functions/v1/generate-knowledge-embeddings
 */

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
        if (!geminiApiKey) {
            throw new Error('GEMINI_API_KEY not configured')
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Récupérer tous les articles sans embedding
        const { data: articles, error: fetchError } = await supabase
            .from('knowledge_base')
            .select('id, title, content')
            .is('embedding', null)
            .eq('is_active', true)

        if (fetchError) throw fetchError

        if (!articles || articles.length === 0) {
            return new Response(
                JSON.stringify({
                    success: true,
                    message: 'Tous les articles ont déjà des embeddings',
                    processed: 0
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log(`Génération d'embeddings pour ${articles.length} articles...`)

        let processedCount = 0
        let errorCount = 0

        // Générer un embedding pour chaque article
        for (const article of articles) {
            try {
                // Combiner titre et contenu pour l'embedding
                const textToEmbed = `${article.title}\\n\\n${article.content}`

                // Générer l'embedding avec Gemini
                const embeddingResponse = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiApiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            model: 'models/text-embedding-004',
                            content: { parts: [{ text: textToEmbed }] }
                        })
                    }
                )

                if (!embeddingResponse.ok) {
                    console.error(`Erreur embedding pour article ${article.id}:`, await embeddingResponse.text())
                    errorCount++
                    continue
                }

                const embeddingData = await embeddingResponse.json()
                const embedding = embeddingData.embedding.values

                // Sauvegarder l'embedding dans la base
                const { error: updateError } = await supabase
                    .from('knowledge_base')
                    .update({ embedding: embedding })
                    .eq('id', article.id)

                if (updateError) {
                    console.error(`Erreur sauvegarde embedding pour article ${article.id}:`, updateError)
                    errorCount++
                    continue
                }

                processedCount++
                console.log(`✅ Embedding généré pour: "${article.title}"`)

                // Pause pour éviter rate limiting (2 req/sec max)
                await new Promise(resolve => setTimeout(resolve, 600))

            } catch (error) {
                console.error(`Erreur pour article ${article.id}:`, error)
                errorCount++
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: `Embeddings générés avec succès`,
                processed: processedCount,
                errors: errorCount,
                total: articles.length
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Error:', error)
        return new Response(
            JSON.stringify({
                success: false,
                error: error.message
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
