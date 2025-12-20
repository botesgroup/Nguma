-- Migration: Remove generic transaction email trigger
-- Date: 2025-11-17 (Modified)
-- Description: The generic email notification trigger on new transactions is being removed.
--              This is because the new email system uses explicit template_ids directly
--              from RPC functions via the `notifications_queue` table.
--              Sending generic emails via a trigger is less precise and less maintainable
--              than explicit email queuing from business logic functions.

DROP TRIGGER IF EXISTS on_new_transaction_send_email ON public.transactions;

DROP FUNCTION IF EXISTS public.send_email_notification_on_new_transaction() CASCADE;

-- No other actions needed. Email notifications are now handled explicitly by
-- business logic functions inserting into `public.notifications_queue`.
