-- Update the valid_transaction_type check constraint to include ALL types including 'transfer', 'assurance' and 'admin_credit'

-- Drop the existing constraint
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS valid_transaction_type;

-- Add the newly corrected constraint
ALTER TABLE public.transactions ADD CONSTRAINT valid_transaction_type 
CHECK (type IN ('deposit', 'withdrawal', 'profit', 'refund', 'investment', 'assurance', 'admin_credit', 'transfer'));
