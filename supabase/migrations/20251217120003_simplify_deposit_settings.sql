-- Migration to simplify deposit limitations by removing period and max_deposits settings.

-- Remove deposit period start setting
DELETE FROM settings WHERE key = 'deposit_period_start';

-- Remove deposit period end setting
DELETE FROM settings WHERE key = 'deposit_period_end';

-- Remove max deposits per period setting
DELETE FROM settings WHERE key = 'max_deposits_per_period';

-- Optionally, clean up references in other tables if they exist (none identified here)
