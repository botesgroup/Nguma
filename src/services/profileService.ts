import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { sendEmailNotification } from "./notificationOrchestrationService"; // Import the notification service

type Profile = Database['public']['Tables']['profiles']['Row'];

/**
 * Fetches the profile for the currently authenticated user.
 */
export const getProfile = async (): Promise<Profile | null> => {
  const userPromise = supabase.auth.getUser();
  
  // Timeout for getUser call
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error("Timeout getting auth user")), 10000)
  );

  let user: any;
  try {
    const result = await Promise.race([userPromise, timeoutPromise]) as any;
    user = result.data?.user;
  } catch (err) {
    throw err;
  }
  
  if (!user) {
    throw new Error("User not authenticated.");
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error("Could not fetch profile data.");
  }

  // Si le profil existe déjà, le retourner
  if (data) {
    return data;
  }

  // Si aucun profil n'existe (ex: 1ère connexion OAuth/email), le créer
  const nameParts = (user.user_metadata?.full_name || '').split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const newProfile: Profile = {
    id: user.id,
    email: user.email || '',
    first_name: user.user_metadata?.first_name || firstName,
    last_name: user.user_metadata?.last_name || lastName,
    avatar_url: user.user_metadata?.avatar_url || null,
    post_nom: null,
    phone: null,
    country: null,
    city: null,
    address: null,
    birth_date: null,
    updated_at: new Date().toISOString(),
    created_at: user.created_at,
    last_dormant_reminder_at: null,
  };

  const { data: insertedProfile, error: insertError } = await supabase
    .from('profiles')
    .insert(newProfile)
    .select()
    .single();

  if (insertError) {
    throw new Error("Could not create new user profile.");
  }

  return insertedProfile;
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
