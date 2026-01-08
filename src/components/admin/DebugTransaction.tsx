import { useEffect, useState } from 'react';
import { getSingleTransaction } from '@/services/adminService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DebugTransactionProps {
  transactionId: string;
}

export const DebugTransaction = ({ transactionId }: DebugTransactionProps) => {
  const [transaction, setTransaction] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTransaction = async () => {
      if (!transactionId) return;
      try {
        setIsLoading(true);
        const data = await getSingleTransaction(transactionId);
        setTransaction(data);
        setError(null);
      } catch (err: any) {
        setError(err.message);
        setTransaction(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransaction();
  }, [transactionId]);

  return (
    <Card className="my-4">
      <CardHeader>
        <CardTitle>Debug Transaction: {transactionId}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <p>Loading transaction details...</p>}
        {error && <p className="text-red-500">{error}</p>}
        {transaction && (
          <pre className="p-4 bg-gray-100 rounded-md overflow-x-auto">
            {JSON.stringify(transaction, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
};
