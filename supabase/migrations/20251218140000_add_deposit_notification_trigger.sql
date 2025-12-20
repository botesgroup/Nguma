-- Migration to add a trigger that automatically notifies users when deposits are enabled.
-- This calls the 'notify-deposit-availability' edge function.

CREATE OR REPLACE FUNCTION public.handle_deposit_enabled_trigger()
RETURNS TRIGGER AS $$
DECLARE
    project_url TEXT := 'https://kaqxoavnoabcnszzmwye.supabase.co';
    -- Clé service_role de secours (trouvée dans les migrations précédentes)
    v_service_role_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthcXhvYXZub2FiY25zenptd3llIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTkwNDAwMSwiZXhwIjoyMDc3NDgwMDAxfQ.l6iDy-ISTSRA1tUytD_P_x1luN8vTtVQZ4_iEndV34c';
    v_final_key TEXT;
BEGIN
    -- Se déclenche seulement si 'deposit_enabled' passe à 'true'
    IF NEW.key = 'deposit_enabled' AND NEW.value = 'true' AND (OLD.value IS NULL OR OLD.value != 'true') THEN
        
        -- On essaie d'abord de récupérer la clé depuis la table app_secrets (créée dans une migration précédente)
        BEGIN
            SELECT value INTO v_final_key FROM public.app_secrets WHERE key = 'service_role_key';
        EXCEPTION WHEN OTHERS THEN
            v_final_key := NULL;
        END;

        -- Si non trouvée dans app_secrets, on utilise la clé de secours
        IF v_final_key IS NULL OR v_final_key = '' THEN
            v_final_key := v_service_role_key;
        END IF;
        
        RAISE NOTICE 'Triggering deposit availability notification with service_role...';
        
        PERFORM net.http_post(
            url := project_url || '/functions/v1/notify-deposit-availability',
            headers := jsonb_build_object(
                'content-type', 'application/json',
                'apikey', v_final_key,
                'authorization', 'Bearer ' || v_final_key
            ),
            body := jsonb_build_object('triggered_by', 'database_trigger')
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_deposit_enabled_change ON public.settings;
CREATE TRIGGER on_deposit_enabled_change
AFTER UPDATE ON public.settings
FOR EACH ROW
EXECUTE FUNCTION public.handle_deposit_enabled_trigger();
