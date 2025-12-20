// src/services/notificationService.ts
import { supabase } from '@/integrations/supabase/client';

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  sent_at?: string; // For email notifications
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  link_to?: string;
  recipient?: string; // For email notifications
  error_message?: string; // For failed email notifications
}

/**
 * Fetches all notifications for the current user.
 */
export const getNotifications = async (): Promise<Notification[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }

  return data as Notification[];
};

/**
 * Marks a single notification as read.
 */
export const markNotificationAsRead = async (notificationId: string) => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) {
    console.error('Error marking notification as read:', error);
    throw new Error('Could not mark notification as read.');
  }
  return { success: true };
};

/**
 * Marks all unread notifications for the current user as read.
 */
export const markAllNotificationsAsRead = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated.");

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (error) {
    console.error('Error marking all notifications as read:', error);
    throw new Error('Could not mark all notifications as read.');
  }
  return { success: true };
};

/**
 * Deletes all read notifications for the current user.
 */
export const deleteReadNotifications = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated.");

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', user.id)
    .eq('is_read', true);

  if (error) {
    console.error('Error deleting read notifications:', error);
    throw new Error('Could not delete read notifications.');
  }
  return { success: true };
};

/**
 * Helper to get an icon based on notification type.
 */
export const getNotificationIcon = (type?: string) => {
  switch (type) {
    case 'transaction': return '💰';
    case 'profit': return '📈';
    case 'contract': return '📄';
    case 'admin': return '⚙️';
    case 'system': return '🔔';
    case 'security': return '🛡️';
    case 'deposit': return '💸'; // Specific icon for deposit
    case 'withdrawal': return '💳'; // Specific icon for withdrawal
    default: return '🔔';
  }
};

/**
 * Helper to get a badge color based on priority.
 */
export const getPriorityBadgeColor = (priority?: string) => {
  switch (priority) {
    case 'urgent': return 'bg-red-500';
    case 'high': return 'bg-orange-500';
    case 'medium': return 'bg-yellow-500';
    case 'low': return 'bg-blue-500';
    default: return 'bg-gray-500';
  }
};
