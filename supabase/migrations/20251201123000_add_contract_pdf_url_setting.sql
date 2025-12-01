INSERT INTO public.settings (key, value, type, label, description, category)
VALUES (
  'contract_explanation_pdf_url',
  '',
  'text',
  'URL du PDF Explicatif du Contrat',
  'Lien vers le document PDF qui explique le fonctionnement du contrat. Géré via un upload de fichier.',
  'general'
)
ON CONFLICT (key) DO NOTHING;
