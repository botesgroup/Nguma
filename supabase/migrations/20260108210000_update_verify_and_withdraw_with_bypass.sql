-- Update verify_and_withdraw function to accept pre-verified withdrawals

DROP FUNCTION IF EXISTS public.verify_and_withdraw(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.verify_and_withdraw(
    p_verification_id UUID,
    p_otp_code TEXT
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    verification_record record;
    withdrawal_result json;
    v_otp_bypassed_by_admin BOOLEAN := FALSE;
BEGIN
    -- Check if user is authenticated
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User not authenticated.');
    END IF;

    -- Get verification record (allow already verified records for bypass)
    SELECT * INTO verification_record
    FROM public.withdrawal_verifications
    WHERE id = p_verification_id
    AND user_id = v_user_id
    AND expires_at > now(); -- Still check expiry

    -- Check if verification exists and is valid
    IF verification_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Code de vérification invalide ou expiré.');
    END IF;

    -- Determine if OTP was bypassed by admin
    IF verification_record.verified = TRUE AND verification_record.verification_code = 'BYPASSED_ADMIN' THEN
        v_otp_bypassed_by_admin := TRUE;
    END IF;

    -- If not bypassed, proceed with OTP verification
    IF NOT v_otp_bypassed_by_admin THEN
        -- Check if it's already verified (shouldn't happen if not bypassed)
        IF verification_record.verified = TRUE THEN
            RETURN json_build_object('success', false, 'error', 'Ce code de vérification a déjà été utilisé.');
        END IF;

        -- Verify OTP code
        IF verification_record.verification_code != p_otp_code THEN
            RETURN json_build_object('success', false, 'error', 'Code de vérification incorrect.');
        END IF;

        -- Mark verification as used
        UPDATE public.withdrawal_verifications
        SET verified = TRUE
        WHERE id = p_verification_id;
    END IF;

    -- Process the withdrawal using the updated user_withdraw function
    SELECT public.user_withdraw(
        verification_record.amount,
        verification_record.method,
        verification_record.payment_details -- C'est maintenant un JSONB
    ) INTO withdrawal_result;

    -- Clean up old verification codes (only if not bypassed, as bypassed might be a single-use verification)
    -- Or, ensure cleanup is robust enough to handle already verified items
    PERFORM public.cleanup_expired_withdrawal_verifications();

    RETURN withdrawal_result;

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Database error: ' || SQLERRM);
END;
$$;