// supabase/functions/cron-check-deposit-cycle/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4';

// Initialiser Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Headers CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Fonction principale pour vérifier l'état des dépôts
const checkDepositStatus = async (): Promise<{ success: boolean; message: string }> => {
  try {
    // Récupérer les paramètres système (seulement deposit_enabled)
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('key, value')
      .eq('key', 'deposit_enabled'); // Only fetch deposit_enabled

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      return { success: false, message: `Error fetching settings: ${settingsError.message}` };
    }

    const isEnabled = settings?.[0]?.value === 'true';
    
    if (!isEnabled) {
      return { success: true, message: 'Dépôts désactivés par l\'administrateur' };
    }

    return { success: true, message: 'Dépôts activés' };
  } catch (error) {
    console.error('Error in checkDepositStatus:', error);
    return { success: false, message: `Erreur: ${(error as Error).message}` };
  }
};

serve(async (req) => {
  // Gérer les requêtes CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Vérifier que la méthode est POST
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Seules les requêtes POST sont autorisées" }),
        { 
          status: 405, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Vérifier l'en-tête d'autorisation
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Exécuter la vérification du statut de dépôt
    console.log('Exécution de la vérification du statut de dépôt...');
    const result = await checkDepositStatus();
    console.log('Résultat de la vérification:', result);

    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Error in cron-check-deposit-cycle function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erreur inconnue' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

serve(async (req) => {
  // Gérer les requêtes CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Vérifier que la méthode est POST
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Seules les requêtes POST sont autorisées" }),
        { 
          status: 405, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Vérifier l'en-tête d'autorisation
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Exécuter la vérification du cycle de dépôt
    console.log('Exécution de la vérification du cycle de dépôt...');
    const result = await checkDepositCycleChange();
    console.log('Résultat de la vérification:', result);

    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Error in cron-check-deposit-cycle function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erreur inconnue' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});