
import { createContext, useContext, ReactNode, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getNotifications, type Notification } from '@/services/notificationService';

// Custom hook to get the previous value of a prop or state.
const usePrevious = <T,>(value: T) => {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
};

interface NotificationStats {
  byType: Record<string, number>;
  byPriority: Record<string, number>;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  stats: NotificationStats;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const unreadCount = notifications?.filter(n => !n.is_read).length || 0;
  const prevUnreadCount = usePrevious(unreadCount);

  // Calculate statistics
  const stats = useMemo<NotificationStats>(() => {
    if (!notifications) {
      return { byType: {}, byPriority: {} };
    }

    const byType: Record<string, number> = {};
    const byPriority: Record<string, number> = {};

    notifications.forEach(notification => {
      // Count by type
      const type = notification.type || 'system';
      byType[type] = (byType[type] || 0) + 1;

      // Count by priority
      const priority = notification.priority || 'medium';
      byPriority[priority] = (byPriority[priority] || 0) + 1;
    });

    return { byType, byPriority };
  }, [notifications]);

  useEffect(() => {
    // Play sound only when the unread count increases
    if (prevUnreadCount !== undefined && unreadCount > prevUnreadCount) {
      const audio = new Audio('/notification.mp3');
      audio.play().catch(error => {
        // Autoplay was prevented by the browser.
        console.warn("Notification sound was blocked by the browser. User interaction is required to enable sound.", error);
      });
    }
  }, [unreadCount, prevUnreadCount]);

  const value = {
    notifications: notifications || [],
    unreadCount,
    isLoading,
    stats,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
