-- Add metadata column to transactions table
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Comment on column
COMMENT ON COLUMN public.transactions.metadata IS 'Additional flexible data for the transaction (e.g. transfer details)';
