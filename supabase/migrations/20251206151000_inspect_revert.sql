-- Check for existing functions with the name admin_get_all_contracts
SELECT proname, proargtypes::regtype[], prosrc
FROM pg_proc
WHERE proname = 'admin_get_all_contracts';
