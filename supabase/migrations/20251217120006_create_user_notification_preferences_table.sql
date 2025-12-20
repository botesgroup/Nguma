-- Create the extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Enable uuid-ossp extension within the extensions schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- Create the user_notification_preferences table
CREATE TABLE public.user_notification_preferences (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    notification_type notification_type NOT NULL,
    email_enabled BOOLEAN DEFAULT TRUE NOT NULL,
    push_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    internal_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    UNIQUE (user_id, notification_type)
);

-- Enable Row Level Security
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Create policies for RLS
CREATE POLICY "Users can view their own notification preferences." ON public.user_notification_preferences
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification preferences." ON public.user_notification_preferences
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification preferences." ON public.user_notification_preferences
FOR UPDATE USING (auth.uid() = user_id);

-- Optional: Create an index for faster lookups by user_id
CREATE INDEX idx_user_notification_preferences_user_id ON public.user_notification_preferences(user_id);