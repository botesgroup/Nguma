-- Migration pour ajouter les paramètres de contrôle des dépôts

-- Ajouter les paramètres de contrôle des dépôts
INSERT INTO settings (key, value, type, label, description, category) VALUES
('deposit_enabled', 'true', 'boolean', 'Dépôts activés', 'Autoriser les utilisateurs à effectuer des dépôts', 'deposits'),
('deposit_period_start', '2024-01-01T00:00:00.000Z', 'text', 'Début de période', 'Date de début de la période de dépôt autorisée', 'deposits'),
('deposit_period_end', '2024-12-31T23:59:59.999Z', 'text', 'Fin de période', 'Date de fin de la période de dépôt autorisée', 'deposits'),
('max_deposits_per_period', '5', 'number', 'Dépôts max par période', 'Nombre maximum de dépôts autorisés par période', 'deposits');