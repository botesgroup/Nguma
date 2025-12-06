import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type Profile = Database['public']['Tables']['profiles']['Row'];

/**
 * Fetches the profile for the currently authenticated user.
 */
export const getProfile = async (): Promise<Profile | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated.");

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116: no rows found
    console.error("Error fetching profile:", error);
    throw new Error("Could not fetch profile data.");
  }

  // Si le profil existe dans la table 'profiles', le retourner
  if (data) {
    return data;
  }

  // Si aucun profil n'existe (ex: 1ère connexion OAuth), construire un profil de base
  // à partir des données de l'utilisateur authentifié.
  if (!data && user) {
    // Essayer de séparer le nom complet en prénom et nom
    const fullName = user.user_metadata.full_name || '';
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    return {
      id: user.id,
      email: user.email || '',
      first_name: user.user_metadata.first_name || firstName,
      last_name: user.user_metadata.last_name || lastName,
      avatar_url: user.user_metadata.avatar_url || null,
      // Les autres champs seront null ou vides par défaut
      post_nom: null,
      phone: null,
      country: null,
      city: null,
      address: null,
      birth_date: null,
      updated_at: null,
      created_at: user.created_at, // On peut utiliser la date de création de l'utilisateur auth
      total_invested: 0,
      risk_profile: 'not_set',
      investment_goals: null,
      is_active: true,
      subscription_tier: 'standard',
      last_login: null
    } as Profile;
  }

  return null;
};

/**
 * Updates the profile for the currently authenticated user.
 */
export const updateProfile = async (profileData: Partial<Profile>) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated.");

  // Prevent updating the id
  const { id, ...updatableData } = profileData;

  const { data, error } = await supabase
    .from("profiles")
    .update({
      ...updatableData,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select()
    .single();

  if (error) {
    console.error("Error updating profile:", error);
    throw new Error("Could not update profile.");
  }

  return data;
};
