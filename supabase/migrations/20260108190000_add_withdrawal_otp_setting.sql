-- Add setting for enabling/disabling OTP verification for withdrawals

INSERT INTO public.settings (key, value, description)
VALUES ('withdrawal_otp_enabled', 'true', 'Enable OTP verification for all withdrawals (admin controlled)');
