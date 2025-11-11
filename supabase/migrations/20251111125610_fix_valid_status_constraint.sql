-- Step 1: Drop the old 'valid_status' constraint from the contracts table.
ALTER TABLE public.contracts
DROP CONSTRAINT IF EXISTS valid_status;

-- Step 2: Add the new 'valid_status' constraint including the 'pending_refund' status.
ALTER TABLE public.contracts
ADD CONSTRAINT valid_status CHECK (status IN ('active', 'completed', 'refunded', 'cancelled', 'pending_refund'));
