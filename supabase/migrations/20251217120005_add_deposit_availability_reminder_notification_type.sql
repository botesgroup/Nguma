-- Migration to add 'deposit_availability_reminder' to the notification_type enum.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
        -- Create the enum type if it does not exist
        CREATE TYPE notification_type AS ENUM (
            'deposit',
            'withdrawal',
            'contract',
            'profit',
            'security',
            'system'
        );
    END IF;

    -- Add the new enum value if it doesn't already exist
    IF (SELECT COUNT(*) FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type') AND enumlabel = 'deposit_availability_reminder') = 0 THEN
        ALTER TYPE notification_type ADD VALUE 'deposit_availability_reminder';
    END IF;
END
$$;
