-- Migration: Cleanup duplicate accounting entries (Régularisation)
-- Date: 2025-12-13
-- Description: The previous reconciliation script created 'Régularisation' entries for deposits
-- that already had 'Dépôt historique' entries (but were not linked to a transaction ID).
-- This migration removes the duplicates to restore the correct treasury balance.

DELETE FROM public.accounting_entries
WHERE description LIKE 'Régularisation : Dépôt de %'
AND created_at > (now() - interval '1 day'); -- Safety check to only delete recent ones
