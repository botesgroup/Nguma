-- Migration: Fix OAuth Profile Creation
-- Description: Améliore le trigger handle_new_user pour gérer correctement les métadonnées OAuth (Google)
--              en extrayant le prénom/nom depuis full_name si nécessaire et en récupérant l'avatar.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_first_name TEXT;
    v_last_name TEXT;
    v_full_name TEXT;
    v_avatar_url TEXT;
    v_meta JSONB;
BEGIN
    v_meta := NEW.raw_user_meta_data;

    -- 1. Stratégie de récupération du Prénom / Nom
    -- Essayer d'abord les champs explicites
    v_first_name := COALESCE(v_meta->>'first_name', '');
    v_last_name := COALESCE(v_meta->>'last_name', '');

    -- Si vide, essayer de parser full_name ou name
    IF v_first_name = '' AND v_last_name = '' THEN
        v_full_name := COALESCE(v_meta->>'full_name', v_meta->>'name', '');
        
        IF v_full_name != '' THEN
            -- Découpage simple au premier espace
            -- Position du premier espace
            IF position(' ' in v_full_name) > 0 THEN
                v_first_name := split_part(v_full_name, ' ', 1);
                v_last_name := substring(v_full_name from position(' ' in v_full_name) + 1);
            ELSE
                -- Pas d'espace, tout dans le prénom
                v_first_name := v_full_name;
                v_last_name := '';
            END IF;
        END IF;
    END IF;

    -- 2. Récupération de l'avatar
    -- Google envoie souvent 'avatar_url' ou 'picture'
    v_avatar_url := COALESCE(v_meta->>'avatar_url', v_meta->>'picture', '');

    -- 3. Insertion du profil
    INSERT INTO public.profiles (id, email, first_name, last_name, post_nom, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        v_first_name,
        v_last_name,
        COALESCE(v_meta->>'post_nom', ''),
        v_avatar_url
    );

    -- 4. Insertion du portefeuille
    INSERT INTO public.wallets (user_id)
    VALUES (NEW.id);

    -- 5. Assignation du rôle par défaut
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'investor');

    -- Enqueue admin notification for new user registration
    INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
    SELECT
        'new_user_registered_admin',
        u.id, -- ID de l'admin
        u.email, -- Email de l'admin
        jsonb_build_object(
            'name', v_first_name || ' ' || v_last_name, -- Nom du nouvel utilisateur
            'email', NEW.email, -- Email du nouvel utilisateur
            'userId', NEW.id::text -- ID du nouvel utilisateur
        )
    FROM auth.users u
    JOIN public.user_roles ur ON u.id = ur.user_id
    WHERE ur.role = 'admin';

    RETURN NEW;
END;
$$;
