-- Migration to add admin-specific notification types to the notification_type enum.
-- Date: 2025-12-20

DO $$
BEGIN
    -- Add the new enum values if they don't already exist
    IF (SELECT COUNT(*) FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type') AND enumlabel = 'admin_deposit') = 0 THEN
        ALTER TYPE notification_type ADD VALUE 'admin_deposit';
    END IF;
    
    IF (SELECT COUNT(*) FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type') AND enumlabel = 'admin_withdrawal') = 0 THEN
        ALTER TYPE notification_type ADD VALUE 'admin_withdrawal';
    END IF;
    
    IF (SELECT COUNT(*) FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type') AND enumlabel = 'admin_user') = 0 THEN
        ALTER TYPE notification_type ADD VALUE 'admin_user';
    END IF;
    
    IF (SELECT COUNT(*) FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type') AND enumlabel = 'admin_contract') = 0 THEN
        ALTER TYPE notification_type ADD VALUE 'admin_contract';
    END IF;
    
    IF (SELECT COUNT(*) FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type') AND enumlabel = 'admin_support') = 0 THEN
        ALTER TYPE notification_type ADD VALUE 'admin_support';
    END IF;
    
    IF (SELECT COUNT(*) FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type') AND enumlabel = 'admin_refund') = 0 THEN
        ALTER TYPE notification_type ADD VALUE 'admin_refund';
    END IF;
END
$$;
