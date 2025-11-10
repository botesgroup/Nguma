-- This function provides data for the user growth chart by counting new users per month.
CREATE OR REPLACE FUNCTION get_user_growth_summary()
RETURNS TABLE (
    month_year TEXT,
    new_users_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Ensure the user is an admin before proceeding
    IF NOT is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Unauthorized access: Only admins can view user growth summaries.';
    END IF;

    RETURN QUERY
    WITH monthly_users AS (
        SELECT
            to_char(date_trunc('month', u.created_at), 'YYYY-MM') AS month_period
        FROM
            auth.users u
        WHERE
            u.created_at >= now() - interval '12 months'
    )
    SELECT
        m.month_year,
        COALESCE(COUNT(mu.month_period), 0) AS new_users_count
    FROM
        (
            SELECT to_char(date_trunc('month', generate_series(now() - interval '11 months', now(), '1 month')), 'YYYY-MM') as month_year
        ) m
    LEFT JOIN
        monthly_users mu ON m.month_year = mu.month_period
    GROUP BY
        m.month_year
    ORDER BY
        m.month_year ASC;
END;
$$;
