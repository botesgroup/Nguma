-- DIAGNOSTIC: Check if investor email functions have send-resend-email calls
-- Run this in Supabase SQL Editor to see which functions are missing emails

-- 1. Check approve_deposit
SELECT 
  proname as function_name,
  CASE 
    WHEN prosrc LIKE '%send-resend-email%' THEN '✅ HAS EMAIL'
    ELSE '❌ NO EMAIL'
  END as email_status,
  CASE 
    WHEN prosrc LIKE '%deposit_approved%' THEN '✅ Has template'
    ELSE '❌ No template'
  END as template_status
FROM pg_proc 
WHERE proname = 'approve_deposit';

-- 2. Check reject_deposit
SELECT 
  proname as function_name,
  CASE 
    WHEN prosrc LIKE '%send-resend-email%' THEN '✅ HAS EMAIL'
    ELSE '❌ NO EMAIL'
  END as email_status,
  CASE 
    WHEN prosrc LIKE '%deposit_rejected%' THEN '✅ Has template'
    ELSE '❌ No template'
  END as template_status
FROM pg_proc 
WHERE proname = 'reject_deposit';

-- 3. Check create_new_contract
SELECT 
  proname as function_name,
  CASE 
    WHEN prosrc LIKE '%send-resend-email%' THEN '✅ HAS EMAIL'
    ELSE '❌ NO EMAIL'
  END as email_status,
  CASE 
    WHEN prosrc LIKE '%new_investment%' THEN '✅ Has template'
    ELSE '❌ No template'
  END as template_status
FROM pg_proc 
WHERE proname = 'create_new_contract';

-- 4. Check calculate_monthly_profits
SELECT 
  proname as function_name,
  CASE 
    WHEN prosrc LIKE '%send-resend-email%' THEN '✅ HAS EMAIL'
    ELSE '❌ NO EMAIL'
  END as email_status,
  CASE 
    WHEN prosrc LIKE '%monthly_profit%' THEN '✅ Has template'
    ELSE '❌ No template'
  END as template_status
FROM pg_proc 
WHERE proname = 'calculate_monthly_profits';

-- 5. Check approve_withdrawal (this one works)
SELECT 
  proname as function_name,
  CASE 
    WHEN prosrc LIKE '%send-resend-email%' THEN '✅ HAS EMAIL'
    ELSE '❌ NO EMAIL'
  END as email_status,
  CASE 
    WHEN prosrc LIKE '%withdrawal_approved%' THEN '✅ Has template'
    ELSE '❌ No template'
  END as template_status
FROM pg_proc 
WHERE proname = 'approve_withdrawal';

-- 6. Check reject_withdrawal
SELECT 
  proname as function_name,
  CASE 
    WHEN prosrc LIKE '%send-resend-email%' THEN '✅ HAS EMAIL'
    ELSE '❌ NO EMAIL'
  END as email_status,
  CASE 
    WHEN prosrc LIKE '%withdrawal_rejected%' THEN '✅ Has template'
    ELSE '❌ No template'
  END as template_status
FROM pg_proc 
WHERE proname = 'reject_withdrawal';

-- SUMMARY: Show all functions at once
SELECT 
  proname as function_name,
  CASE 
    WHEN prosrc LIKE '%send-resend-email%' THEN '✅'
    ELSE '❌'
  END as has_email_call
FROM pg_proc 
WHERE proname IN ('approve_deposit', 'reject_deposit', 'approve_withdrawal', 'reject_withdrawal', 'create_new_contract', 'calculate_monthly_profits')
ORDER BY proname;
