-- This migration removes the now-redundant 'contract_pdf_url' column
-- from the 'contracts' table, as the application now uses a single
-- generic contract PDF managed in the settings.

ALTER TABLE public.contracts
DROP COLUMN IF EXISTS contract_pdf_url;
