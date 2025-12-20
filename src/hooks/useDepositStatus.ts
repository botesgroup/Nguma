import { useState, useEffect } from 'react';
import { isDepositEnabled } from '@/services/depositPeriodService'; // Updated import

export const useDepositStatus = () => {
  const [depositEnabled, setDepositEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const enabled = await isDepositEnabled();
        setDepositEnabled(enabled);
      } catch (err) {
        console.error('Error fetching deposit enabled status:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStatus();
  }, []); // Run once on mount

  return { depositEnabled, isLoading };
};