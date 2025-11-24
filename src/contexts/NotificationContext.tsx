
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
      playNotificationSound();
    }
  }, [unreadCount, prevUnreadCount]);

  // Fonction pour jouer le son de notification
  const playNotificationSound = () => {
    // Essayer de charger le fichier audio
    const audio = new Audio('/notification.mp3');

    audio.play().catch((error) => {
      // Si le fichier n'existe pas ou autoplay bloqué, utiliser Web Audio API
      console.warn("Notification sound file not available, using Web Audio API fallback", error);

      try {
        // Créer un son simple avec Web Audio API
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        // Connexion
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Configuration du son (deux bips courts)
        oscillator.frequency.value = 800; // Fréquence en Hz
        oscillator.type = 'sine';

        // Envelope pour éviter les clics
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.15);

        // Premier bip
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.15);

        // Deuxième bip
        const oscillator2 = audioContext.createOscillator();
        const gainNode2 = audioContext.createGain();
        oscillator2.connect(gainNode2);
        gainNode2.connect(audioContext.destination);

        oscillator2.frequency.value = 1000;
        oscillator2.type = 'sine';

        gainNode2.gain.setValueAtTime(0, audioContext.currentTime + 0.2);
        gainNode2.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.21);
        gainNode2.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.35);

        oscillator2.start(audioContext.currentTime + 0.2);
        oscillator2.stop(audioContext.currentTime + 0.35);
      } catch (audioError) {
        console.warn("Web Audio API also failed, notification will be silent", audioError);
      }
    });
  };

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
