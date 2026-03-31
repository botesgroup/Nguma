import { supabase } from "@/integrations/supabase/client";

export const getMaintenanceMode = async (): Promise<boolean> => {
  const { data, error } = await supabase
    .from('global_settings')
    .select('value')
    .eq('key', 'maintenance_mode')
    .single();
  
  if (error) {
    console.error("Erreur lors de la récupération du mode maintenance:", error);
    return false;
  }
  
  return data?.value === true;
};

export const setMaintenanceMode = async (enabled: boolean): Promise<boolean> => {
  const { error } = await supabase
    .from('global_settings')
    .update({ 
      value: enabled,
      updated_at: new Date().toISOString()
    })
    .eq('key', 'maintenance_mode');
  
  if (error) {
    console.error("Erreur lors de la mise à jour du mode maintenance:", error);
    return false;
  }
  
  return true;
};
