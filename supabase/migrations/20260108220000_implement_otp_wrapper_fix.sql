-- This migration implements the wrapper pattern to solve the parameter name mismatch.

-- 1. Rename the existing implementation function to "_impl".
-- This makes the original name available for our new wrapper function.
ALTER FUNCTION public.request_withdrawal_otp(p_amount numeric, p_method text, p_payment_details jsonb)
RENAME TO request_withdrawal_otp_impl;


-- 2. Create the new wrapper function with the user-facing name and parameter names.
-- This function accepts the names the frontend sends ('amount', 'method', etc.).
CREATE OR REPLACE FUNCTION public.request_withdrawal_otp(
    amount numeric,
    method text,
    payment_details jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- It then calls the "_impl" function, mapping the parameters correctly.
    RETURN public.request_withdrawal_otp_impl(p_amount := amount, p_method := method, p_payment_details := payment_details);
END;
$$;


-- 3. Grant permissions to the new wrapper function so the frontend can call it.
GRANT EXECUTE ON FUNCTION public.request_withdrawal_otp(numeric, text, jsonb) TO authenticated;

COMMENT ON FUNCTION public.request_withdrawal_otp(numeric, text, jsonb) IS 'Wrapper function for backward compatibility. Accepts frontend parameter names and calls the _impl function.';
COMMENT ON FUNCTION public.request_withdrawal_otp_impl(numeric, text, jsonb) IS 'Core implementation of OTP request, called by the wrapper function.';
