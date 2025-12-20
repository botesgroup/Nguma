-- Migration: Automate Dormant Funds Reminders with pg_cron
-- Date: 2025-12-13
-- Description: 
-- 1. Adds 'last_dormant_reminder_at' column to profiles.
-- 2. Creates 'process_dormant_funds_reminders' function to find and email users.
-- 3. Schedules the job with pg_cron.

-- 1. ADD COLUMN FOR TRACKING
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_dormant_reminder_at TIMESTAMPTZ;

-- 1.5 CREATE SECURE SECRETS TABLE (Best Practice)
CREATE TABLE IF NOT EXISTS public.app_secrets (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- CRITICAL SECURITY: Revoke access from everyone except the database system
REVOKE ALL ON public.app_secrets FROM PUBLIC;
REVOKE ALL ON public.app_secrets FROM anon;
REVOKE ALL ON public.app_secrets FROM authenticated;
-- Only postgres (admin) and service_role can access implicitly

-- Insert the key safely (Use ON CONFLICT to avoid errors on re-run)
INSERT INTO public.app_secrets (key, value, description)
VALUES ('service_role_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthcXhvYXZub2FiY25zenptd3llIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTkwNDAwMSwiZXhwIjoyMDc3NDgwMDAxfQ.l6iDy-ISTSRA1tUytD_P_x1luN8vTtVQZ4_iEndV34c', 'Supabase Service Role Key for Internal Cron Jobs')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 2. CREATE PROCESSING FUNCTION
CREATE OR REPLACE FUNCTION public.process_dormant_funds_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user RECORD;
    v_count INTEGER := 0;
    v_batch_size INTEGER := 50; -- Limit batch to avoid timeouts
    v_support_phone TEXT;
    
    -- CONFIGURATION (A REMPLACER PAR L'UTILISATEUR)
    -- L'URL doit pointer vers votre Edge Function
    v_project_url TEXT := 'https://kaqxoavnoabcnszzmwye.supabase.co';
    -- CLE SECRETE (Service Role)
    v_service_role_key TEXT;
    v_payload JSONB;
BEGIN
    -- SECURE RETRIEVAL: Read from the secure `app_secrets` table
    SELECT value INTO v_service_role_key FROM public.app_secrets WHERE key = 'service_role_key';
    
    IF v_service_role_key IS NULL OR v_service_role_key = 'REPLACE_WITH_SERVICE_ROLE_KEY' THEN
        -- Fallback log specifically for debugging (but shouldn't print the key)
        RAISE WARNING 'Service Role Key is missing or invalid in app_secrets';
        RETURN jsonb_build_object('success', false, 'error', 'Configuration error: Missing Service Role Key');
    END IF;
    -- Get support phone for emails
    SELECT value INTO v_support_phone FROM public.settings WHERE key = 'support_whatsapp_number';

    -- BATCH LOGIC: Select users and build a single JSON array
    WITH target_users AS (
        SELECT p.id, p.email, p.first_name, p.last_name, w.total_balance
        FROM public.profiles p
        JOIN public.wallets w ON p.id = w.user_id
        WHERE w.total_balance >= 50
        AND (p.last_dormant_reminder_at IS NULL OR p.last_dormant_reminder_at < now() - INTERVAL '7 days')
        AND NOT EXISTS (
            SELECT 1 FROM public.contracts c 
            WHERE c.user_id = p.id AND c.created_at > now() - INTERVAL '24 hours'
        )
        LIMIT v_batch_size
    ),
    batch_json AS (
        SELECT jsonb_agg(
            jsonb_build_object(
                'to', tu.email,
                'name', COALESCE(tu.first_name || ' ' || tu.last_name, 'Investisseur'),
                'amount', tu.total_balance,
                'support_phone', v_support_phone
            )
        ) as recipients
        FROM target_users tu
    )
    SELECT recipients INTO v_payload FROM batch_json;

    -- If we have users to process
    IF v_payload IS NOT NULL AND jsonb_array_length(v_payload) > 0 THEN
        v_count := jsonb_array_length(v_payload);

        -- Enqueue ONE Batch Request
        INSERT INTO public.notifications_queue (template_id, recipient_email, notification_params)
        VALUES (
            'dormant_funds_reminder_batch', -- This template ID triggers batch processing in send-resend-email
            NULL, -- No single recipient email for batch, will be handled by params
            jsonb_build_object(
                'recipients', v_payload
            )
        );

        -- Update timestamps for all processed users
        UPDATE public.profiles p
        SET last_dormant_reminder_at = now()
        FROM (
            SELECT p.id
            FROM public.profiles p
            JOIN public.wallets w ON p.id = w.user_id
            WHERE w.total_balance >= 50
            AND (p.last_dormant_reminder_at IS NULL OR p.last_dormant_reminder_at < now() - INTERVAL '7 days')
            AND NOT EXISTS (
                SELECT 1 FROM public.contracts c 
                WHERE c.user_id = p.id AND c.created_at > now() - INTERVAL '24 hours'
            )
            LIMIT v_batch_size
        ) as sub
        WHERE p.id = sub.id;
        
    END IF;

    RETURN jsonb_build_object('success', true, 'processed_count', v_count);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 3. VALIDATE AND SCHEDULE CRON JOB
-- Remove existing job if any to avoid duplicates
-- Remove existing job if any to avoid duplicates (Idempotent)
DO $$
BEGIN
    PERFORM cron.unschedule('dormant-funds-reminder');
EXCEPTION WHEN OTHERS THEN
    -- Ignore error if job doesn't exist
    NULL;
END $$;

-- Schedule job to run every day at 09:00 AM UTC
-- Note: Requires pg_cron extension enabled
SELECT cron.schedule(
    'dormant-funds-reminder', -- Job name
    '0 9 * * *',              -- Schedule (Daily at 9:00 AM)
    'SELECT public.process_dormant_funds_reminders()'
);
