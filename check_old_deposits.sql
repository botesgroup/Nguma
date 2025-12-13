SELECT 
    SUM(amount) as old_deposits_sum,
    COUNT(*) as old_deposits_count
FROM public.transactions 
WHERE type = 'deposit' 
AND status = 'completed'
AND created_at < '2025-12-01';
