import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { id, content } = await req.json()

        if (!content) {
            throw new Error('Content is required')
        }

        // Get Gemini API key from environment
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
        if (!geminiApiKey) {
            throw new Error('GEMINI_API_KEY not configured')
        }

        // Generate embedding using Gemini API
        const embeddingResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiApiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'models/text-embedding-004',
                    content: {
                        parts: [{ text: content }]
                    }
                })
            }
        )

        if (!embeddingResponse.ok) {
            const errorText = await embeddingResponse.text()
            console.error('Gemini API error:', errorText)
            throw new Error(`Failed to generate embedding: ${errorText}`)
        }

        const embeddingData = await embeddingResponse.json()
        const embedding = embeddingData.embedding.values

        // If ID is provided, update the knowledge base entry
        if (id) {
            const supabase = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            )

            const { error } = await supabase
                .from('knowledge_base')
                .update({ embedding })
                .eq('id', id)

            if (error) throw error
        }

        return new Response(
            JSON.stringify({ embedding, success: true }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            },
        )
    } catch (error) {
        console.error('Error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            },
        )
    }
})
