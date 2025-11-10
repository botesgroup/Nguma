-- Enable the pg_tle extension which provides access to Supabase Vault secrets
-- via the secrets.get() function within PostgreSQL. This is required for the
-- email notification trigger to retrieve the necessary secrets.
CREATE EXTENSION IF NOT EXISTS pg_tle;
