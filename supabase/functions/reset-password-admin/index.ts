import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    // Create admin client with service_role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Parse request body
    const { email, code, password } = await req.json();

    if (!email || !code || !password) {
      return new Response(JSON.stringify({ error: 'L\'email, le code et le nouveau mot de passe sont requis.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Attempting password reset for: ${email}`);

    // 1. Verify OTP via the internal RPC
    // This also marks the OTP as used if correct
    const { data: verifyData, error: verifyError } = await supabaseAdmin.rpc('verify_password_reset_otp_internal', {
      p_email: email,
      p_code: code,
    });

    if (verifyError) {
      console.error('RPC Error:', verifyError);
      return new Response(JSON.stringify({ error: 'Erreur lors de la vérification du code.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!verifyData.success) {
      return new Response(JSON.stringify({ error: verifyData?.error || 'Code invalide ou expiré.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Get User ID from profiles (where ID matches Auth UID)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError);
      return new Response(JSON.stringify({ error: 'Utilisateur non trouvé.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Update User Password using Admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
      password: password,
    });

    if (updateError) {
      console.error('Auth update error:', updateError);
      return new Response(JSON.stringify({ error: 'Erreur lors de la mise à jour du mot de passe.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Password successfully reset for user: ${profile.id}`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Mot de passe mis à jour avec succès.' 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
