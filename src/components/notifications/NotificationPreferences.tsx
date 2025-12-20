import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
  toggleNotificationPreference,
  type NotificationPreferences,
  type NotificationType
} from '@/services/notificationPreferencesService';

interface NotificationPreferencesProps {
  userId: string;
}

export const NotificationPreferences = ({ userId }: NotificationPreferencesProps) => {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const notificationTypes: { id: NotificationType; label: string; description: string }[] = [
    {
      id: 'deposit',
      label: 'Dépôts',
      description: 'Notifications sur les dépôts (approuvés, rejetés, en attente)'
    },
    {
      id: 'withdrawal',
      label: 'Retraits',
      description: 'Notifications sur les retraits (approuvés, rejetés, en attente)'
    },
    {
      id: 'contract',
      label: 'Contrats',
      description: 'Notifications sur les contrats (activation, fin, profits)'
    },
    {
      id: 'profit',
      label: 'Profits',
      description: 'Notifications sur les profits crédités'
    },
    {
      id: 'security',
      label: 'Sécurité',
      description: 'Alertes de sécurité importantes'
    },
    {
      id: 'system',
      label: 'Système',
      description: 'Notifications système importantes'
    }
  ];

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const userPrefs = await getUserNotificationPreferences(userId);
        setPreferences(userPrefs);
      } catch (error) {
        console.error('Error loading notification preferences:', error);
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: 'Impossible de charger vos préférences de notification.'
        });
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      loadPreferences();
    }
  }, [userId]);

  const handlePreferenceChange = async (
    type: NotificationType,
    channel: 'email' | 'push' | 'internal'
  ) => {
    if (!preferences) return;

    try {
      setLoading(true);
      
      const result = await toggleNotificationPreference(userId, type, channel);
      if (result.success) {
        // Mettre à jour localement l'état
        setPreferences(prev => {
          if (!prev) return null;
          
          const updated = { ...prev };
          updated[type] = {
            ...updated[type],
            [channel]: !updated[type][channel]
          };
          
          return updated;
        });
        
        toast({
          title: 'Préférences mises à jour',
          description: 'Vos préférences de notification ont été enregistrées.'
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error updating preference:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: `Impossible de mettre à jour la préférence: ${(error as Error).message}`
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Impossible de charger vos préférences de notification.
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Préférences de Notification</CardTitle>
        <CardDescription>
          Gérez les canaux par lesquels vous souhaitez recevoir les notifications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {notificationTypes.map((type) => (
          <div key={type.id} className="space-y-4 p-4 border rounded-lg">
            <div>
              <h3 className="font-medium">{type.label}</h3>
              <p className="text-sm text-muted-foreground">{type.description}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email</Label>
                  <p className="text-xs text-muted-foreground">Notifications par email</p>
                </div>
                <Switch
                  checked={preferences[type.id].email}
                  onCheckedChange={() => handlePreferenceChange(type.id, 'email')}
                  disabled={loading}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Push</Label>
                  <p className="text-xs text-muted-foreground">Notifications push</p>
                </div>
                <Switch
                  checked={preferences[type.id].push}
                  onCheckedChange={() => handlePreferenceChange(type.id, 'push')}
                  disabled={loading}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Interne</Label>
                  <p className="text-xs text-muted-foreground">Notifications dans l'app</p>
                </div>
                <Switch
                  checked={preferences[type.id].internal}
                  onCheckedChange={() => handlePreferenceChange(type.id, 'internal')}
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};