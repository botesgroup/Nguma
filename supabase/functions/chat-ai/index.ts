import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { authenticateUser } from '../_shared/auth.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // ** 1. Authenticate the user **
        const user = await authenticateUser(req);

        const { conversationId, message } = await req.json()

        if (!message || !conversationId) {
            throw new Error('Message and conversationId are required')
        }

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
        if (!geminiApiKey) {
            throw new Error('GEMINI_API_KEY not configured')
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // ** 2. Verify conversation ownership **
        const { data: conversation, error: convError } = await supabase
            .from('chat_conversations')
            .select('user_id')
            .eq('id', conversationId)
            .single();

        if (convError || !conversation) {
            throw new Error('Conversation not found.');
        }

        if (conversation.user_id !== user.id) {
            throw new Error('User is not the owner of this conversation.');
        }

        // 1. Générer l'embedding de la question
        const embeddingResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiApiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'models/text-embedding-004',
                    content: { parts: [{ text: message }] }
                })
            }
        )

        if (!embeddingResponse.ok) {
            throw new Error('Failed to generate question embedding')
        }

        const embeddingData = await embeddingResponse.json()
        const queryEmbedding = embeddingData.embedding.values

        // 2. Rechercher les documents similaires
        const { data: matchingDocs, error: matchError } = await supabase.rpc(
            'match_knowledge_documents',
            {
                query_embedding: queryEmbedding,
                match_threshold: 0.5,
                match_count: 3
            }
        )

        if (matchError) throw matchError

        // Timestamp de début pour analytics
        const startTime = Date.now()

        // ** 3. Get user context securely from the authenticated user **
        let userContext = ''
        const { data: profile } = await supabase
            .from('profiles')
            .select('subscription_tier, total_invested, risk_profile, investment_goals')
            .eq('id', user.id) // Use authenticated user.id
            .single()

        if (profile) {
            userContext = `\n**Contexte utilisateur:**\n- Niveau d'abonnement: ${profile.subscription_tier || 'standard'}\n- Investissement total: ${profile.total_invested || 0}€\n- Profil de risque: ${profile.risk_profile || 'non défini'}\n- Objectifs: ${profile.investment_goals || 'non définis'}`
        }

        // Récupérer les derniers messages de la conversation pour le contexte
        const { data: recentMessages } = await supabase
            .from('chat_messages')
            .select('sender_id, message')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .limit(6)

        // Construire l'historique de conversation (ordre chronologique)
        const conversationHistory = (recentMessages || [])
            .reverse()
            .map(msg => {
                const isAI = msg.sender_id === '00000000-0000-0000-0000-000000000000'
                const role = isAI ? 'Assistant' : 'Utilisateur'
                return `${role}: ${msg.message}`
            })
            .join('\\n')

        // Détecter les messages simples (salutations et politesse)
        const simpleMessages = ["merci", "ok", "d'accord", "super", "parfait", "cool", "top", "ok merci", "c'est bon", "compris", "ça marche", "salut", "slt", "bonjour", "hey", "coucou", "hello", "bonsoir"]
        const isSimpleMessage = simpleMessages.some(phrase =>
            message.toLowerCase().trim() === phrase ||
            message.toLowerCase().trim() === phrase + " !" ||
            message.toLowerCase().trim() === phrase + "!"
        )

        if (isSimpleMessage) {
            // Répondre directement sans RAG pour les messages simples
            // Adapter la réponse selon le type de message
            const isGreeting = ["salut", "slt", "bonjour", "hey", "coucou", "hello", "bonsoir"].includes(message.toLowerCase().trim())
            const politeReply = isGreeting
                ? "Salut ! 👋 Je suis là pour vous aider avec vos questions sur Nguma. Comment puis-je vous aider ?"
                : "Je vous en prie ! N'hésitez pas si vous avez d'autres questions. 😊"

            await supabase.from('chat_messages').insert({
                conversation_id: conversationId,
                sender_id: '00000000-0000-0000-0000-000000000000',
                message: politeReply,
                is_admin: false
            })

            await supabase.from('chat_conversations').update({
                last_message_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }).eq('id', conversationId)

            return new Response(
                JSON.stringify({ shouldEscalate: false, reply: politeReply }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 3. Vérifier si on a assez de confiance pour répondre (seuil abaissé)
        const bestMatch = matchingDocs?.[0]
        const shouldEscalate = !bestMatch || bestMatch.similarity < 0.5

        if (shouldEscalate) {
            // Escalade vers admin - créer notification
            const { data: conversation } = await supabase
                .from('chat_conversations')
                .select('user_id')
                .eq('id', conversationId)
                .single()

            if (conversation) {
                // Notifier les admins
                const { data: admins } = await supabase
                    .from('user_roles')
                    .select('user_id')
                    .eq('role', 'admin')

                if (admins && admins.length > 0) {
                    await supabase.from('notifications').insert(
                        admins.map(admin => ({
                            user_id: admin.user_id,
                            type: 'support',
                            priority: 'medium',
                            message: `Question complexe nécessitant votre attention`,
                            link_to: `/admin/support?conversation=${conversationId}`
                        }))
                    )
                }
            }

            const escalationMessage = "Je ne trouve pas la réponse dans ma base de connaissances. Je vous mets en attente et transfère votre demande à un administrateur. Vous recevrez une réponse dès que possible."

            await supabase.from('chat_messages').insert({
                conversation_id: conversationId,
                sender_id: '00000000-0000-0000-0000-000000000000',
                message: escalationMessage,
                is_admin: false
            })

            await supabase.from('chat_conversations').update({
                last_message_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }).eq('id', conversationId)

            return new Response(
                JSON.stringify({ shouldEscalate: true, reply: escalationMessage }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 4. Construire le contexte à partir des documents trouvés
        const context = matchingDocs
            .map((doc: any) => `**${doc.title}**\\n${doc.content}`)
            .join('\\n\\n---\\n\\n')

        const role = message.toLowerCase().includes('qui es-tu') || message.toLowerCase().includes('qui êtes-vous')
            ? "l'assistant virtuel de Nguma"
            : 'un conseiller';

        // 5. Générer une réponse naturelle avec Gemini (avec contexte enrichi)
        const prompt = `Tu es ${role} chez Nguma, une plateforme d'investissement fiable.
            ${ userContext }

** Informations disponibles:**
            ${ context }

** Conversation précédente:**
            ${ conversationHistory || 'Aucun historique' }

** Question de l'utilisateur :** "${message}"

            ** Ton rôle:**
                Tu es un humain, pas un robot.Réponds naturellement comme si tu parlais à un ami qui te fait confiance pour l'aider avec ses investissements.
${ userContext ? 'Utilise le contexte utilisateur pour personnaliser tes réponses (adapte selon son niveau, son profil de risque, etc.).' : '' }

** Style de réponse:**
            - Parle comme un humain: utilise "je", sois empathique, montre que tu comprends
                - Adapte la longueur: courte si question simple, détaillée si question complexe
                    - Sois chaleureux mais professionnel
                        - Sois concis et direct.Évite les redondances et va droit au but, surtout pour les questions simples.
- Utilise des exemples concrets quand c'est pertinent
            - Si l'utilisateur fait référence à la conversation, utilise l'historique
                - Émojis OK mais avec modération(😊, 👍, ✅)
                    - Réponds UNIQUEMENT en français

                        ** Important :** Ne dis JAMAIS "selon la base de connaissances" ou "d'après les informations".Parle comme si TU savais ces informations de toi - même.`

        const generateResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiApiKey}`,
        {
            method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.8, // Plus créatif et naturel
                    maxOutputTokens: 1000, // Augmenté pour permettre des réponses complètes
                    topP: 0.95,
                    topK: 40
                }
            })
        }
        )

        if (!generateResponse.ok) {
            const errorBody = await generateResponse.text();
            throw new Error(`Failed to generate AI response: ${generateResponse.status} ${errorBody}`);
        }

const generateData = await generateResponse.json()

const aiReply = generateData.candidates[0].content.parts[0].text
let isTruncated = false;

// Gérer MAX_TOKENS (réponse trop longue)
if (generateData.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
    console.warn('Gemini hit MAX_TOKENS, response was truncated.')
    aiReply += "\n\n[... La réponse a été tronquée. Veuillez reformuler votre question pour plus de détails ou précisez votre demande.]";
    isTruncated = true;
}

// Vérifier réponse valide
if (!aiReply) {
    console.error('Invalid response:', JSON.stringify(generateData))
    throw new Error('AI response invalid')
}

// 6. Enregistrer
await supabase.from('chat_messages').insert({
    conversation_id: conversationId,
    sender_id: '00000000-0000-0000-0000-000000000000',
    message: aiReply,
    is_admin: false
})

await supabase.from('chat_conversations').update({
    last_message_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
}).eq('id', conversationId)

// 7. Tracker les analytics
const responseTime = Math.floor((Date.now() - startTime) / 1000)
await supabase.from('chat_analytics').upsert({
    conversation_id: conversationId,
    ai_answered: true,
    escalated_to_admin: false,
    first_response_time_seconds: responseTime
}, {
    onConflict: 'conversation_id'
})

return new Response(
    JSON.stringify({ shouldEscalate: false, reply: aiReply, confidence: bestMatch.similarity, isTruncated }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
)

    } catch (error) {
    console.error('Error:', error)
    return new Response(
        JSON.stringify({ error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
}
})
