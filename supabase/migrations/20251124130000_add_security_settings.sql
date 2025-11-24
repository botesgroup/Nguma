-- Add security configuration settings
-- These settings allow admins to configure security features via /admin/settings

-- First, add missing columns if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'label') THEN
        ALTER TABLE public.settings ADD COLUMN label TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'category') THEN
        ALTER TABLE public.settings ADD COLUMN category TEXT DEFAULT 'general';
    END IF;
END $$;

INSERT INTO public.settings (key, value, type, label, description, category) VALUES
  (
    '2fa_mandatory_for_admins',
    'true',
    'boolean',
    'Double Authentification Obligatoire pour Administrateurs',
    'Si activé, tous les administrateurs doivent configurer l''authentification à deux facteurs (2FA) dans un délai de 7 jours',
    'security'
  ),
  (
    '2fa_setup_deadline_days',
    '7',
    'number',
    'Délai de Configuration 2FA (jours)',
    'Nombre de jours accordés aux administrateurs pour configurer leur authentification à deux facteurs',
    'security'
  ),
  (
    'backup_codes_enabled',
    'true',
    'boolean',
    'Codes de Récupération d''Urgence',
    'Activer la génération automatique de 10 codes de secours lors de la configuration de la double authentification',
    'security'
  ),
  (
    'login_audit_enabled',
    'true',
    'boolean',
    'Journal d''Audit des Connexions',
    'Enregistrer automatiquement toutes les tentatives de connexion (réussies et échouées) avec adresse IP et navigateur',
    'security'
  ),
  (
    'max_login_attempts',
    '5',
    'number',
    'Nombre Maximum de Tentatives',
    'Nombre maximum de tentatives de connexion autorisées avant un blocage temporaire du compte',
    'security'
  ),
  (
    'login_lockout_minutes',
    '30',
    'number',
    'Durée de Blocage (minutes)',
    'Durée pendant laquelle un compte reste bloqué après avoir dépassé le nombre de tentatives autorisées',
    'security'
  ),
  (
    'session_timeout_minutes',
    '1440',
    'number',
    'Expiration de Session (minutes)',
    'Durée maximale d''inactivité avant déconnexion automatique (1440 minutes = 24 heures)',
    'security'
  ),
  (
    'require_email_verification',
    'true',
    'boolean',
    'Vérification d''Email Obligatoire',
    'Les nouveaux utilisateurs doivent confirmer leur adresse email avant d''accéder à leur espace personnel',
    'security'
  )
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

COMMENT ON COLUMN public.settings.category IS 'Catégorie pour regrouper les paramètres (général, sécurité, notifications, etc.)';
COMMENT ON COLUMN public.settings.label IS 'Libellé lisible du paramètre affiché dans l''interface';
