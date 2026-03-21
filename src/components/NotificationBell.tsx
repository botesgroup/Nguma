
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getNotifications, markAllNotificationsAsRead, markNotificationAsRead, getNotificationIcon, getPriorityBadgeColor, deleteReadNotifications } from "@/services/notificationService";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "@/contexts/NotificationContext";
import { supabase } from "@/integrations/supabase/client";
import { useUserNotificationsRealtime } from "@/hooks/useRealtimeSync";
import { useToast } from "@/components/ui/use-toast";

export const NotificationBell = () => {
  const [activeTab, setActiveTab] = useState("all");
  const { toast } = useToast();

  // Get current user ID for Realtime filtering
  const { data: userResponse } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => supabase.auth.getUser(),
  });
  const user = userResponse?.data?.user;

  // Enable Realtime synchronization for notifications
  useUserNotificationsRealtime(user?.id);

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { notifications, unreadCount, stats } = useNotifications(); // Use context

  // Filter notifications by active tab
  const filteredNotifications = activeTab === "all"
    ? notifications
    : notifications.filter(n => n.type === activeTab);

  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast({ title: "✓ Toutes les notifications marquées comme lues" });
    },
  });

  const deleteReadMutation = useMutation({
    mutationFn: deleteReadNotifications,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast({ title: "✓ Notifications lues supprimées" });
    },
  });

  const markOneReadMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const handleNotificationClick = (notification: any) => {
    // If the notification is not read, mark it as read.
    if (!notification.is_read) {
      markOneReadMutation.mutate(notification.id);
    }
    // Then navigate
    if (notification.link_to) {
      let targetPath = notification.link_to;
      // Check if it's an absolute URL and convert to relative path if necessary
      try {
        const url = new URL(notification.link_to);
        // If the host matches the current host, it's an internal absolute URL
        if (url.origin === window.location.origin) {
          targetPath = url.pathname;
        }
      } catch (e) {
        // Not a valid URL, assume it's already a relative path
      }
      navigate(targetPath);
    }
  };

  const getPriorityIndicator = (priority?: string) => {
    if (priority === 'urgent' || priority === 'high') {
      const badgeClass = getPriorityBadgeColor(priority);
      return (
        <span className={`inline-flex h-2 w-2 rounded-full ${badgeClass}`} />
      );
    }
    return null;
  };

  // Get icon with color based on type
  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'transaction': return <span className="text-green-600">💰</span>;
      case 'profit': return <span className="text-blue-600">📈</span>;
      case 'contract': return <span className="text-purple-600">📄</span>;
      case 'admin': return <span className="text-orange-600">⚙️</span>;
      case 'system': return <span className="text-gray-600">🔔</span>;
      default: return <span className="text-gray-600">🔔</span>;
    }
  };

  // Tab counts
  const getTabCount = (type: string) => {
    if (type === 'all') return unreadCount;
    return stats.byType[type] || 0;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96">
        <div className="grid gap-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h4 className="font-medium leading-none">Notifications</h4>
              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markAllReadMutation.mutate()}
                    disabled={markAllReadMutation.isPending}
                  >
                    <CheckCheck className="mr-2 h-4 w-4" /> Marquer tout lu
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteReadMutation.mutate()}
                  disabled={deleteReadMutation.isPending}
                  title="Supprimer les notifications lues"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {unreadCount === 0 ? "Aucune notification non lue" : `${unreadCount} notification(s) non lue(s)`}
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 h-auto">
              <TabsTrigger value="all" className="text-xs">
                Tout {getTabCount('all') > 0 && `(${getTabCount('all')})`}
              </TabsTrigger>
              <TabsTrigger value="transaction" className="text-xs">
                💰 {getTabCount('transaction') > 0 && getTabCount('transaction')}
              </TabsTrigger>
              <TabsTrigger value="profit" className="text-xs">
                📈 {getTabCount('profit') > 0 && getTabCount('profit')}
              </TabsTrigger>
              <TabsTrigger value="contract" className="text-xs">
                📄 {getTabCount('contract') > 0 && getTabCount('contract')}
              </TabsTrigger>
              <TabsTrigger value="admin" className="text-xs">
                ⚙️ {getTabCount('admin') > 0 && getTabCount('admin')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              <div className="grid gap-2 max-h-96 overflow-y-auto">
                {filteredNotifications && filteredNotifications.length > 0 ? (
                  filteredNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`grid grid-cols-[35px_1fr_auto] items-start pb-3 pt-2 px-2 last:mb-0 last:pb-0 cursor-pointer hover:bg-muted/50 rounded-md transition-colors ${!notification.is_read ? "bg-muted/30 border-l-2 border-primary" : ""
                        }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-center justify-center">
                        {getTypeIcon(notification.type)}
                      </div>
                      <div className="grid gap-1">
                        <div className="flex items-center gap-2">
                          {!notification.is_read && (
                            <span className="flex h-2 w-2 rounded-full bg-primary" />
                          )}
                          {getPriorityIndicator(notification.priority)}
                          {(notification.priority === 'urgent' || notification.priority === 'high') && (
                            <Badge variant="outline" className={`text-xs ${getPriorityBadgeColor(notification.priority)} text-white border-0`}>
                              {notification.priority === 'urgent' ? 'URGENT' : 'IMPORTANT'}
                            </Badge>
                          )}
                        </div>
                        <p className={`text-sm ${!notification.is_read ? "font-semibold" : ""}`}>
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: fr })}
                        </p>
                      </div>
                      <div className="flex items-center">
                        {/* Empty space for alignment */}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center p-4">
                    {activeTab === 'all' ? "Aucune notification" : `Aucune notification de type "${activeTab}"`}
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </PopoverContent>
    </Popover>
  );
};
