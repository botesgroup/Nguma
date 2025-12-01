-- Update insurance settings to add category, label and description
UPDATE public.settings
SET 
    category = 'insurance',
    label = 'Activer l''assurance',
    description = 'Active ou désactive le système d''assurance optionnel des contrats'
WHERE key = 'insurance_enabled';

UPDATE public.settings
SET 
    category = 'insurance',
    label = 'Frais d''assurance (%)',
    description = 'Pourcentage de frais d''assurance sur le montant investi (ex: 5 = 5%)'
WHERE key = 'insurance_fee_percent';

UPDATE public.settings
SET 
    category = 'insurance',
    label = 'Frais d''assurance fixes (USD)',
    description = 'Montant fixe des frais d''assurance en USD'
WHERE key = 'insurance_fee_fixed';

UPDATE public.settings
SET 
    category = 'insurance',
    label = 'Appliquer les deux types de frais',
    description = 'Si activé, applique à la fois le pourcentage ET les frais fixes. Sinon, applique seulement le pourcentage (si > 0), ou les frais fixes'
WHERE key = 'insurance_apply_both';

-- Ensure all insurance settings exist (in case of missing data)
INSERT INTO public.settings (key, value, type, description, category, label)
VALUES 
  ('insurance_enabled', 'true', 'boolean', 'Active ou désactive le système d''assurance optionnel des contrats', 'insurance', 'Activer l''assurance'),
  ('insurance_fee_percent', '5', 'number', 'Pourcentage de frais d''assurance sur le montant investi (ex: 5 = 5%)', 'insurance', 'Frais d''assurance (%)'),
  ('insurance_fee_fixed', '0', 'number', 'Montant fixe des frais d''assurance en USD', 'insurance', 'Frais d''assurance fixes (USD)'),
  ('insurance_apply_both', 'false', 'boolean', 'Si activé, applique à la fois le pourcentage ET les frais fixes. Sinon, applique seulement le pourcentage (si > 0), ou les frais fixes', 'insurance', 'Appliquer les deux types de frais')
ON CONFLICT (key) DO UPDATE SET
  category = EXCLUDED.category,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  updated_at = now();
