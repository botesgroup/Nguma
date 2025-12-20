import { useState, useEffect } from 'react';

interface CountdownTimerProps {
  targetDate: Date;
  onComplete?: () => void;
}

export const CountdownTimer = ({ targetDate, onComplete }: CountdownTimerProps) => {
  const [timeLeft, setTimeLeft] = useState({
    months: 0,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const diffMs = targetDate.getTime() - now.getTime();
      
      if (diffMs <= 0) {
        if (onComplete) onComplete();
        return { months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
      }

      // Calculer les différentes unités de temps
      const seconds = Math.floor(diffMs / 1000) % 60;
      const minutes = Math.floor(diffMs / (1000 * 60)) % 60;
      const hours = Math.floor(diffMs / (1000 * 60 * 60)) % 24;
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) % 30; // Approximation de 30 jours par mois
      const months = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30)); // Mois approximatifs

      return { months, days, hours, minutes, seconds };
    };

    // Calculer immédiatement
    setTimeLeft(calculateTimeLeft());

    // Mettre à jour toutes les secondes
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    // Nettoyer l'intervalle
    return () => clearInterval(timer);
  }, [targetDate, onComplete]);

  const { months, days, hours, minutes, seconds } = timeLeft;

  // Ne pas afficher si tous les temps sont zéro
  if (months === 0 && days === 0 && hours === 0 && minutes === 0 && seconds === 0) {
    return <span>Terminé</span>;
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {months > 0 && (
        <div className="flex items-center gap-1 bg-secondary px-2 py-1 rounded">
          <span className="font-bold text-primary">{months}</span>
          <span className="text-sm text-muted-foreground">mois</span>
        </div>
      )}
      {days > 0 && (
        <div className="flex items-center gap-1 bg-secondary px-2 py-1 rounded">
          <span className="font-bold text-primary">{days}</span>
          <span className="text-sm text-muted-foreground">jours</span>
        </div>
      )}
      {hours > 0 && (
        <div className="flex items-center gap-1 bg-secondary px-2 py-1 rounded">
          <span className="font-bold text-primary">{hours}</span>
          <span className="text-sm text-muted-foreground">h</span>
        </div>
      )}
      {minutes > 0 && (
        <div className="flex items-center gap-1 bg-secondary px-2 py-1 rounded">
          <span className="font-bold text-primary">{minutes}</span>
          <span className="text-sm text-muted-foreground">min</span>
        </div>
      )}
      {seconds >= 0 && (
        <div className="flex items-center gap-1 bg-secondary px-2 py-1 rounded">
          <span className="font-bold text-primary">{seconds}</span>
          <span className="text-sm text-muted-foreground">s</span>
        </div>
      )}
    </div>
  );
};