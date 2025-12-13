-- Create a secure RPC for admins to send notifications
-- This function allows manual notification dispatch from the admin panel

CREATE OR REPLACE FUNCTION public.admin_send_notification(
    p_user_id UUID,
    p_message TEXT,
    p_priority TEXT,
    p_type TEXT DEFAULT 'admin'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    is_admin BOOLEAN;
BEGIN
    -- 1. Check if the caller is an admin
    SELECT public.has_role(auth.uid(), 'admin') INTO is_admin;
    
    IF NOT is_admin THEN
        RETURN json_build_object('success', false, 'error', 'Accès refusé. Seuls les administrateurs peuvent envoyer des notifications.');
    END IF;

    -- 2. Validate input
    IF p_message IS NULL OR trim(p_message) = '' THEN
        RETURN json_build_object('success', false, 'error', 'Le message ne peut pas être vide.');
    END IF;

    -- 3. Insert Notification
    INSERT INTO public.notifications (user_id, message, priority, type, is_read, created_at)
    VALUES (
        p_user_id,
        p_message,
        p_priority, -- 'urgent', 'high', 'medium', 'low'
        p_type,     -- 'admin', 'system', etc.
        false,
        now()
    );

    RETURN json_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Erreur serveur: ' || SQLERRM);
END;
$$;

-- Grant execution to authenticated users (security check is inside)
GRANT EXECUTE ON FUNCTION public.admin_send_notification(UUID, TEXT, TEXT, TEXT) TO authenticated;
