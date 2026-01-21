-- Add missing columns 'title' and 'type' to notifications table
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'info';

-- Comment on columns
COMMENT ON COLUMN public.notifications.title IS 'Short title/header for the notification';
COMMENT ON COLUMN public.notifications.type IS 'Type of notification (e.g. info, warning, success, error)';
