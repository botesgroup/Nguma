-- This migration drops the trigger and trigger function for sending email notifications.
-- This approach is being replaced by a Database Webhook because the local environment
-- does not support the `secrets.get()` functionality required by the trigger function.

-- Drop the trigger from the notifications table
DROP TRIGGER IF EXISTS on_new_notification_send_email ON public.notifications;

-- Drop the trigger function itself
DROP FUNCTION IF EXISTS public.trigger_send_email_notification();
