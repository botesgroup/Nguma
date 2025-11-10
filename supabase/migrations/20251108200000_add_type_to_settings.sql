-- This migration adds 'type' and 'options' columns to the settings table.
-- 'type' will determine which form control to render in the UI (e.g., 'text', 'boolean', 'number', 'select').
-- 'options' will store an array of choices for 'select' type settings.

ALTER TABLE public.settings
ADD COLUMN type TEXT NOT NULL DEFAULT 'text',
ADD COLUMN options TEXT[];

-- After applying this migration, you should manually update the 'type' and 'options'
-- for your existing settings in the Supabase table editor to enable the new controls.
-- For example:
--
-- For a profit rate setting:
-- UPDATE public.settings SET type = 'number' WHERE key = 'profit_rate';
--
-- For a maintenance mode setting:
-- UPDATE public.settings SET type = 'boolean' WHERE key = 'maintenance_mode';
--
-- For a currency selection setting:
-- UPDATE public.settings SET type = 'select', options = '{"USD"}' WHERE key = 'default_currency';
