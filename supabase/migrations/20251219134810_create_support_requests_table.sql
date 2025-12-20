-- Migration: create_support_requests_table
-- Date: 2025-12-19
-- Description: Crée la table public.support_requests et les fonctions RPC/Trigger associées pour gérer les demandes de support.

-- Table: public.support_requests
CREATE TABLE public.support_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    email TEXT NOT NULL, -- Email de l'utilisateur au moment de la soumission
    name TEXT,           -- Nom de l'utilisateur au moment de la soumission
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open', -- 'open', 'in_progress', 'closed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour la recherche rapide par utilisateur ou statut
CREATE INDEX idx_support_requests_user_id ON public.support_requests(user_id);
CREATE INDEX idx_support_requests_status ON public.support_requests(status);

-- Enable RLS
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own support requests"
ON public.support_requests FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own support requests"
ON public.support_requests FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Admin full access
CREATE POLICY "Admins can manage all support requests"
ON public.support_requests FOR ALL
TO service_role, authenticated -- Assuming admins have elevated privileges (e.g., through user_roles check in RPC)
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger to update updated_at timestamp
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.support_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RPC Function: public.submit_support_request
CREATE OR REPLACE FUNCTION public.submit_support_request(
    p_subject TEXT,
    p_message TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_email TEXT;
    v_name TEXT;
    v_request_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        -- If user is not authenticated, we can use their email from the form
        -- (assuming frontend would handle anonymous submissions differently or reject them)
        -- For now, we require authenticated users for this RPC.
        RETURN jsonb_build_object('success', FALSE, 'error', 'User not authenticated.');
    END IF;

    -- Get user email and name from profile
    SELECT email, first_name || ' ' || last_name INTO v_email, v_name
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_email IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'User profile not found or email missing.');
    END IF;

    -- Insert into support_requests table
    INSERT INTO public.support_requests (user_id, email, name, subject, message)
    VALUES (v_user_id, v_email, v_name, p_subject, p_message)
    RETURNING id INTO v_request_id;

    RETURN jsonb_build_object('success', TRUE, 'support_request_id', v_request_id);

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;

-- Function Trigger: on_support_request_created_send_notifications
CREATE OR REPLACE FUNCTION public.on_support_request_created_send_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    admin_record RECORD;
BEGIN
    -- Enqueue notification for the user who submitted the request
    INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
    VALUES (
        'support_request_received_user',
        NEW.user_id,
        NEW.email, -- Email soumis avec la demande
        jsonb_build_object(
            'name', NEW.name,
            'support_request_id', NEW.id,
            'subject', NEW.subject
        )
    );

    -- Enqueue notifications for all admins
    FOR admin_record IN
        SELECT u.id, u.email FROM auth.users u
        JOIN public.user_roles ur ON u.id = ur.user_id
        WHERE ur.role = 'admin'
    LOOP
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            'new_support_request_admin',
            admin_record.id,
            admin_record.email,
            jsonb_build_object(
                'name', NEW.name,
                'email', NEW.email,
                'userId', NEW.user_id,
                'support_request_id', NEW.id,
                'subject', NEW.subject,
                'message', NEW.message
            )
        );
    END LOOP;

    RETURN NEW;
END;
$$;

-- Trigger: After insert on public.support_requests
CREATE TRIGGER on_support_request_created
AFTER INSERT ON public.support_requests
FOR EACH ROW EXECUTE FUNCTION public.on_support_request_created_send_notifications();
