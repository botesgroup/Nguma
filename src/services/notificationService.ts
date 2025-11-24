
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Notification = Database['public']['Tables']['notifications']['Row'];

// Priority order for sorting
const PRIORITY_ORDER: Record<string, number> = {
  'urgent': 4,
  'high': 3,
  'medium': 2,
  'low': 1,
};

/**
 * Fetches the current user's notifications sorted by priority and date.
 */
export const getNotifications = async () => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw new Error("Could not fetch notifications.");

  // Sort by priority (urgent first) then by date
  const sorted = (data || []).sort((a, b) => {
    const priorityA = PRIORITY_ORDER[a.priority || 'medium'] || 2;
    const priorityB = PRIORITY_ORDER[b.priority || 'medium'] || 2;

    if (priorityA !== priorityB) {
      return priorityB - priorityA; // Higher priority first
    }

    // Same priority, sort by date (newest first)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return sorted;
};

/**
 * Fetches notifications filtered by type.
 */
export const getNotificationsByType = async (type: string) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('type', type)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw new Error("Could not fetch notifications by type.");
  return data || [];
};

/**
 * Marks a specific notification as read.
 */
export const markNotificationAsRead = async (notificationId: string) => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) throw new Error("Could not mark notification as read.");
};

/**
 * Marks all of the user's notifications as read.
 */
export const markAllNotificationsAsRead = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (error) throw new Error("Could not mark all notifications as read.");
};

/**
 * Get notification icon based on type.
 */
export const getNotificationIcon = (type?: string) => {
  switch (type) {
    case 'transaction': return '💰';
    case 'profit': return '📈';
    case 'contract': return '📄';
    case 'admin': return '⚙️';
    case 'system': return '🔔';
    default: return '🔔';
  }
};

/**
 * Get priority color.
 */
export const getPriorityColor = (priority?: string) => {
  switch (priority) {
    case 'urgent': return 'text-red-500';
    case 'high': return 'text-orange-500';
    case 'medium': return 'text-blue-500';
    case 'low': return 'text-gray-500';
    default: return 'text-blue-500';
  }
};

/**
 * Get priority badge background color.
 */
export const getPriorityBadgeColor = (priority?: string) => {
  switch (priority) {
    case 'urgent': return 'bg-red-500';
    case 'high': return 'bg-orange-500';
    case 'medium': return 'bg-blue-500';
    case 'low': return 'bg-gray-400';
    default: return 'bg-blue-500';
  }
};

/**
 * Delete all read notifications for the current user.
 */
export const deleteReadNotifications = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', user.id)
    .eq('is_read', true);

  if (error) throw new Error("Could not delete read notifications.");
};

/**
 * Get unread count by type for the current user.
 */
export const getUnreadCountByType = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};

  const { data, error } = await supabase
    .from('notifications')
    .select('type')
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (error) throw new Error("Could not fetch unread count by type.");

  // Count by type
  const countByType: Record<string, number> = {};
  (data || []).forEach(notif => {
    const type = notif.type || 'system';
    countByType[type] = (countByType[type] || 0) + 1;
  });

  return countByType;
};
