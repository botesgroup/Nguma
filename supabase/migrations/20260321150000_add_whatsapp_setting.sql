
-- Migration: Add WhatsApp Number Setting
-- Description: Adds a configurable WhatsApp number for support contact.

INSERT INTO public.settings (key, value, type, label, description, category)
VALUES (
    'whatsapp_number', 
    '+243000000000', 
    'text', 
    'Numéro WhatsApp Support', 
    'Le numéro WhatsApp officiel pour le support client (format international).', 
    'general'
)
ON CONFLICT (key) DO NOTHING;
