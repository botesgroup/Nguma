-- Update the valid_transaction_type check constraint to include 'transfer'

-- Drop the existing constraint
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS valid_transaction_type;

-- Add the new constraint with 'transfer' included
ALTER TABLE public.transactions ADD CONSTRAINT valid_transaction_type 
CHECK (type IN ('deposit', 'withdrawal', 'profit', 'refund', 'investment', 'transfer', 'admin_credit', 'assurance'));

