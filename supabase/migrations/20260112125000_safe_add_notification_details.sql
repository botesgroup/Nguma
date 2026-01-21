-- Safe migration to add 'title' column and update 'type' constraints

DO $$
BEGIN
    -- 1. Add 'title' column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'title') THEN
        ALTER TABLE public.notifications ADD COLUMN title TEXT;
        COMMENT ON COLUMN public.notifications.title IS 'Short title/header for the notification';
    END IF;

    -- 2. Update the check constraint for 'type' to include 'wallet_update' used by the transfer function
    -- First drop the existing constraint (if any)
    ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
    
    -- Add the updated constraint including 'wallet_update'
    ALTER TABLE public.notifications 
    ADD CONSTRAINT notifications_type_check 
    CHECK (type IN ('transaction', 'system', 'contract', 'profit', 'admin', 'wallet_update', 'info', 'warning', 'success', 'error'));

END $$;
