// src/components/admin/DepositAvailabilityCounter.tsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Calendar, Timer } from 'lucide-react';
import { getDepositStatusWithDetails } from '@/services/depositPeriodService';

interface AvailabilityCounterProps {
  userId?: string; // Optionnel pour permettre une réutilisation
}

export const DepositAvailabilityCounter = ({ userId }: AvailabilityCounterProps) => {
  const [availability, setAvailability] = useState({
    enabled: false,
    isCurrentlyActive: false,
    timeUntilOpen: 0,
    timeUntilClose: 0,
    message: 'Chargement...',
    periodStart: null as Date | null,
    periodEnd: null as Date | null
  });

  const [timeRemaining, setTimeRemaining] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const fetchAndTrackAvailability = async () => {
      try {
        const status = await getDepositStatusWithDetails();
        setAvailability({
          enabled: status.enabled,
          isCurrentlyActive: status.isCurrentlyActive,
          timeUntilOpen: status.timeUntilOpen || 0,
          timeUntilClose: status.timeUntilClose || 0,
          message: status.message,
          periodStart: status.periodStart,
          periodEnd: status.periodEnd
        });
      } catch (error) {
        console.error('Error fetching deposit availability:', error);
        setAvailability({
          enabled: false,
          isCurrentlyActive: false,
          timeUntilOpen: 0,
          timeUntilClose: 0,
          message: 'Erreur de chargement des données',
          periodStart: null,
          periodEnd: null
        });
      }
    };

    // Charger immédiatement
    fetchAndTrackAvailability();

    // Mettre à jour toutes les secondes
    intervalId = setInterval(() => {
      fetchAndTrackAvailability();
    }, 1000);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  // Mettre à jour le compte à rebours en temps réel
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (availability.isCurrentlyActive && availability.timeUntilClose > 0) {
      // Compte à rebours avant fermeture
      interval = setInterval(() => {
        const now = new Date().getTime();
        const timeLeft = availability.timeUntilClose - (now - Date.now());

        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }

        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

        setTimeRemaining({ days, hours, minutes, seconds });
      }, 1000);
    } else if (!availability.isCurrentlyActive && availability.timeUntilOpen > 0) {
      // Compte à rebours avant ouverture
      interval = setInterval(() => {
        const now = new Date().getTime();
        const timeLeft = availability.timeUntilOpen - (now - Date.now());

        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }

        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

        setTimeRemaining({ days, hours, minutes, seconds });
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [availability]);

  const formatTimeUnit = (value: number, label: string) => {
    return (
      <div className="flex flex-col items-center">
        <div className="bg-primary text-primary-foreground rounded-lg px-3 py-2 font-mono text-xl">
          {value.toString().padStart(2, '0')}
        </div>
        <span className="text-xs text-muted-foreground mt-1">{label}</span>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timer className="h-5 w-5" />
          <span>Disponibilité des Dépôts</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`p-4 rounded-lg border flex items-center gap-3 ${
          availability.isCurrentlyActive
            ? 'bg-green-50 border-green-200 text-green-800'
            : availability.enabled && availability.timeUntilOpen > 0
              ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
              : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex-1">
            <p className="font-medium">{availability.message}</p>
            {availability.periodStart && availability.periodEnd && (
              <div className="flex flex-wrap gap-4 mt-2 text-sm">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>Début: {availability.periodStart.toLocaleString('fr-FR')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>Fin: {availability.periodEnd.toLocaleString('fr-FR')}</span>
                </div>
              </div>
            )}
          </div>
          <Badge variant={availability.isCurrentlyActive ? 'default' : 'secondary'}>
            {availability.isCurrentlyActive ? 'ACTIF' : 'INACTIF'}
          </Badge>
        </div>

        {/* Compteur de temps si pertinent */}
        {availability.enabled && (
          <div className="mt-4">
            {availability.isCurrentlyActive && availability.timeUntilClose > 0 ? (
              <div className="text-center">
                <h4 className="font-medium mb-3 flex items-center gap-1 justify-center">
                  <Clock className="h-4 w-4" />
                  Temps restant avant fermeture
                </h4>
                <div className="flex justify-center gap-2">
                  {formatTimeUnit(timeRemaining.days, 'jours')}
                  {formatTimeUnit(timeRemaining.hours, 'heures')}
                  {formatTimeUnit(timeRemaining.minutes, 'min')}
                  {formatTimeUnit(timeRemaining.seconds, 'sec')}
                </div>
              </div>
            ) : (!availability.isCurrentlyActive && availability.timeUntilOpen > 0) ? (
              <div className="text-center">
                <h4 className="font-medium mb-3 flex items-center gap-1 justify-center">
                  <Clock className="h-4 w-4" />
                  Temps avant ouverture
                </h4>
                <div className="flex justify-center gap-2">
                  {formatTimeUnit(timeRemaining.days, 'jours')}
                  {formatTimeUnit(timeRemaining.hours, 'heures')}
                  {formatTimeUnit(timeRemaining.minutes, 'min')}
                  {formatTimeUnit(timeRemaining.seconds, 'sec')}
                </div>
              </div>
            ) : (
              <div className="text-center text-sm text-muted-foreground italic">
                Aucun compte à rebours actif pour le moment
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};