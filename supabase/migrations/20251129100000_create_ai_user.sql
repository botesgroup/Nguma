-- Création de l'utilisateur système pour l'IA
-- Nécessaire pour satisfaire la contrainte de clé étrangère sur chat_messages.sender_id

INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'ai-bot@nguma.com',
    '$2a$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN', -- Mot de passe bidon
    now(),
    NULL,
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"full_name": "Assistant Nguma", "avatar_url": ""}',
    now(),
    now(),
    '',
    '',
    '',
    ''
) ON CONFLICT (id) DO NOTHING;

-- Créer aussi une entrée dans public.profiles si nécessaire (dépend de votre implémentation)
INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    email,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'Assistant',
    'Nguma',
    'ai-bot@nguma.com',
    now(),
    now()
) ON CONFLICT (id) DO NOTHING;
