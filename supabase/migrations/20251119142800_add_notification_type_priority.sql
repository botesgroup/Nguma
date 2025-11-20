-- Add type and priority columns to notifications table
-- This migration enhances the notifications system with categorization and prioritization

-- Add type column with predefined categories
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'system'
CHECK (type IN ('transaction', 'system', 'contract', 'profit', 'admin'));

-- Add priority column with predefined levels
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium'
CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON public.notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- Update the notify_all_admins function to support type and priority
CREATE OR REPLACE FUNCTION public.notify_all_admins(
  message_text TEXT, 
  link TEXT DEFAULT NULL,
  notification_type TEXT DEFAULT 'admin',
  notification_priority TEXT DEFAULT 'medium'
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  admin_record RECORD;
BEGIN
  FOR admin_record IN 
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, message, link_to, type, priority)
    VALUES (admin_record.user_id, message_text, link, notification_type, notification_priority);
  END LOOP;
END;
$$;

-- Comment on new columns
COMMENT ON COLUMN public.notifications.type IS 'Category of notification: transaction, system, contract, profit, admin';
COMMENT ON COLUMN public.notifications.priority IS 'Priority level: low, medium, high, urgent';
