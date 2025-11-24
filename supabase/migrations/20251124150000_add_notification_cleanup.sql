-- Migration pour ajouter le nettoyage automatique des notifications
-- Cette migration ajoute une fonction pour supprimer les anciennes notifications
-- afin d'éviter l'accumulation infinie et maintenir des performances optimales

-- Supprimer la fonction si elle existe déjà (pour permettre le changement de type de retour)
DROP FUNCTION IF EXISTS public.cleanup_old_notifications();

-- Fonction de nettoyage automatique
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS TABLE(deleted_read_count BIGINT, deleted_unread_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  read_count BIGINT;
  unread_count BIGINT;
BEGIN
  -- Supprimer les notifications lues de plus de 30 jours
  DELETE FROM public.notifications
  WHERE is_read = true
  AND created_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS read_count = ROW_COUNT;

  -- Supprimer les notifications non lues de plus de 90 jours (sécurité)
  DELETE FROM public.notifications
  WHERE is_read = false
  AND created_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS unread_count = ROW_COUNT;

  -- Logger l'opération
  RAISE NOTICE 'Cleanup completed: % read notifications deleted, % unread notifications deleted', 
    read_count, unread_count;

  -- Retourner les statistiques
  RETURN QUERY SELECT read_count, unread_count;
END;
$$;

-- Commenter la fonction
COMMENT ON FUNCTION public.cleanup_old_notifications() IS 
'Supprime les notifications anciennes : lues > 30 jours, non lues > 90 jours. Retourne le nombre de lignes supprimées.';

-- Créer une fonction wrapper pour appel via cron (si pg_cron est installé)
CREATE OR REPLACE FUNCTION public.scheduled_notification_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result RECORD;
BEGIN
  -- Appeler la fonction de nettoyage
  SELECT * INTO result FROM public.cleanup_old_notifications();
  
  -- Logger dans une table d'audit si nécessaire
  -- INSERT INTO public.cleanup_logs (cleanup_type, read_count, unread_count, created_at)
  -- VALUES ('notifications', result.deleted_read_count, result.deleted_unread_count, NOW());
END;
$$;

-- NOTE: Pour activer le nettoyage automatique avec pg_cron (extension Supabase)
-- Décommenter et exécuter la ligne suivante après avoir activé pg_cron :
-- SELECT cron.schedule('cleanup-notifications', '0 2 * * 0', 'SELECT public.scheduled_notification_cleanup()');
-- Ceci exécutera le nettoyage chaque dimanche à 2h du matin

-- Instructions manuelles pour activation du cron job :
-- 1. Aller sur Supabase Dashboard > Database > Extensions
-- 2. Activer l'extension "pg_cron"
-- 3. Exécuter dans SQL Editor :
--    SELECT cron.schedule('cleanup-notifications', '0 2 * * 0', 'SELECT public.scheduled_notification_cleanup()');
-- 4. Vérifier avec : SELECT * FROM cron.job;

-- Pour tester manuellement la fonction de nettoyage :
-- SELECT * FROM public.cleanup_old_notifications();
