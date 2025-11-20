-- Fix: Remove the faulty trigger that calls send-resend-email without template_id
-- The trigger on_new_transaction_send_email was calling send-resend-email without a template_id
-- This is causing the "Template with id 'undefined' not found" error

-- The correct flow is:
-- 1. Functions (approve_deposit, etc.) call send-resend-email directly with specific templates
-- 2. Functions also create notifications in the notifications table
-- 3. Notifications trigger send-email-notification (not send-resend-email)

-- Drop the problematic trigger and function
DROP TRIGGER IF EXISTS on_new_transaction_send_email ON public.transactions;
DROP FUNCTION IF EXISTS public.send_email_notification_on_new_transaction();

-- Note: We don't need a trigger on transactions table because:
-- 1. Each transaction-related function (approve_deposit, reject_deposit, etc.) already sends
--    targeted emails using send-resend-email with specific templates
-- 2. These functions also create notifications which trigger send-email-notification
-- 3. Having both would create duplicate emails
