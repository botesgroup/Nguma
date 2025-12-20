import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
  NotificationType,
  DEFAULT_PREFERENCES
} from '@/services/notificationPreferencesService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const notificationTypeLabels: Record<NotificationType, string> = {
  deposit: "Dépôts",
  withdrawal: "Retraits",
  contract: "Contrats",
  profit: "Profits",
  security: "Sécurité",
  system: "Système",
  deposit_availability_reminder: "Disponibilité des Dépôts",
};

const channelLabels: Record<'email' | 'push' | 'internal', string> = {
  email: "E-mail",
  push: "Notifications Push",
  internal: "Notifications Internes",
};

export function NotificationSettings() { // Changed to export function
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        console.log('DEBUG: NotificationSettings - userId set:', user.id);
      } else {
        console.log('DEBUG: NotificationSettings - user not found from auth.getUser()');
      }
    });
  }, []);

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['userNotificationPreferences', userId],
    queryFn: () => getUserNotificationPreferences(userId!),
    enabled: !!userId,
    onSuccess: (data) => {
      console.log('DEBUG: NotificationSettings - preferences loaded:', data);
    },
    onError: (error) => {
      console.error('DEBUG: NotificationSettings - error loading preferences:', error);
    }
  });

  const mutation = useMutation({
    mutationFn: async ({ type, channel, value }: { type: NotificationType; channel: 'email' | 'push' | 'internal'; value: boolean }) => {
      if (!userId) {
        console.error("DEBUG: NotificationSettings - Mutation attempted without userId.");
        throw new Error("User not authenticated.");
      }

      const newPreferences = {
        ...preferences,
        [type]: {
          ...preferences?.[type],
          [channel]: value,
        },
      };
      console.log('DEBUG: NotificationSettings - Attempting to update preferences:', { userId, type, channel, value, newPreferences });
      await updateUserNotificationPreferences(userId, newPreferences);
    },
    onSuccess: () => {
      console.log('DEBUG: NotificationSettings - Mutation successful.');
      queryClient.invalidateQueries({ queryKey: ['userNotificationPreferences', userId] });
      toast({
        title: 'Préférences mises à jour',
        description: 'Vos préférences de notification ont été enregistrées.',
      });
    },
    onError: (error) => {
      console.error('DEBUG: NotificationSettings - Mutation failed:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: `Impossible de mettre à jour les préférences: ${error.message}`,
      });
    },
  });

  if (isLoading || !userId) {
    console.log('DEBUG: NotificationSettings - Loading state. isLoading:', isLoading, 'userId:', userId);
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  console.log('DEBUG: NotificationSettings - Rendering with preferences:', preferences);

  const notificationTypes = Object.keys(DEFAULT_PREFERENCES) as NotificationType[];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Préférences de Notification</CardTitle>
        <CardDescription>
          Gérez les types de notifications que vous souhaitez recevoir et via quels canaux.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {notificationTypes.map((type) => (
          <div key={type}>
            <h4 className="text-md font-semibold mb-2">{notificationTypeLabels[type]}</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.keys(channelLabels).map((channel) => (
                <div key={channel} className="flex items-center space-x-2">
                  <Switch
                    id={`${type}-${channel}`}
                    checked={preferences?.[type]?.[channel] ?? DEFAULT_PREFERENCES[type]?.[channel] ?? false}
                    onCheckedChange={(value) => mutation.mutate({ type, channel: channel as 'email' | 'push' | 'internal', value })}
                    disabled={mutation.isPending}
                  />
                  <Label htmlFor={`${type}-${channel}`}>{channelLabels[channel as 'email' | 'push' | 'internal']}</Label>
                </div>
              ))}
            </div>
            <Separator className="my-4" />
          </div>
        ))}
        {mutation.isPending && (
          <div className="flex items-center justify-center pt-4">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span>Sauvegarde en cours...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
} // Added missing closing brace