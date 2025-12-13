-- Migration: Enrich get_upcoming_profits with user details
-- Date: 2025-12-13
-- Description: Updates get_upcoming_profits to return user name and email.

DROP FUNCTION IF EXISTS public.get_upcoming_profits(TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.get_upcoming_profits(
    p_start_date TIMESTAMPTZ DEFAULT now(),
    p_end_date TIMESTAMPTZ DEFAULT (now() + interval '7 days')
)
RETURNS TABLE (
    user_id UUID,
    contract_id UUID,
    amount NUMERIC,
    expected_date TIMESTAMPTZ,
    contract_name TEXT,
    user_name TEXT,
    user_email TEXT,
    days_remaining INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.user_id,
        c.id as contract_id,
        (c.amount * c.monthly_rate) as amount,
        (c.start_date + (interval '1 month' * (c.months_paid + 1))) as expected_date,
        'Contrat #' || substr(c.id::text, 1, 8) as contract_name,
        COALESCE(p.first_name || ' ' || p.last_name, 'Utilisateur Inconnu') as user_name,
        p.email as user_email,
        DATE_PART('day', (c.start_date + (interval '1 month' * (c.months_paid + 1))) - now())::INTEGER as days_remaining
    FROM public.contracts c
    JOIN public.profiles p ON c.user_id = p.id
    WHERE c.status = 'active'
    AND (c.start_date + (interval '1 month' * (c.months_paid + 1))) BETWEEN p_start_date AND p_end_date
    ORDER BY expected_date ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_upcoming_profits(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
