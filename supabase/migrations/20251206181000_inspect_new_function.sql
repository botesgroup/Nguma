SELECT proname, proargtypes::regtype[], proargnames, prosrc
FROM pg_proc
WHERE proname = 'admin_list_contracts';
