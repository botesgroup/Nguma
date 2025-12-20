import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { sendEmailNotification } from "./notificationOrchestrationService"; // Import the notification service

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

  // Si le profil existe déjà, le retourner
  if (data) {
    return data;
  }

  // Si aucun profil n'existe (ex: 1ère connexion OAuth/email), le créer
  if (!data && user) {
    // Essayer de séparer le nom complet en prénom et nom
    const fullName = user.user_metadata.full_name || '';
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const newProfile: Profile = {
      id: user.id,
      email: user.email || '',
      first_name: user.user_metadata.first_name || firstName,
      last_name: user.user_metadata.last_name || lastName,
      avatar_url: user.user_metadata.avatar_url || null,
      post_nom: null,
      phone: null,
      country: null,
      city: null,
      address: null,
      birth_date: null,
      updated_at: null,
      created_at: user.created_at,
      total_invested: 0,
      risk_profile: 'not_set',
      investment_goals: null,
      is_active: true,
      subscription_tier: 'standard',
      last_login: null,
    };

    // Insérer le nouveau profil dans la base de données
    const { data: insertedProfile, error: insertError } = await supabase
      .from('profiles')
      .insert(newProfile)
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting new profile:", insertError);
      throw new Error("Could not create new user profile.");
    }

    // Si l'insertion réussit, envoyer l'e-mail de bienvenue
    if (insertedProfile) {
      try {
        await sendEmailNotification({
          template_id: 'welcome_new_user',
          to: newProfile.email,
          name: fullName || `${newProfile.first_name} ${newProfile.last_name}`.trim() || 'Nouvel utilisateur',
          userId: newProfile.id,
        });
      } catch (emailError) {
        console.error("Failed to send welcome email:", emailError);
        // Do not throw, email is a non-critical side effect
      }
    }

    return insertedProfile;
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

  // Send a notification email as a side effect
  if (data) {
    try {
      const fullName = `${data.first_name || ''} ${data.last_name || ''}`.trim();
      await sendEmailNotification({
        template_id: 'profile_updated_by_user',
        to: data.email,
        name: fullName || 'Cher utilisateur',
        userId: data.id,
        date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      });
    } catch (emailError) {
      console.error("Profile updated, but failed to send notification email:", emailError);
      // Do not re-throw, as the primary action was successful
    }
  }

  return data;
};
