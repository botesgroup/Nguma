
import { useQuery } from "@tanstack/react-query";
import { getUserDetails } from "@/services/adminService";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface UserDetailDialogProps {
  userId: string;
}

export const UserDetailDialog = ({ userId }: UserDetailDialogProps) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["userDetails", userId],
    queryFn: () => getUserDetails(userId),
    enabled: !!userId,
  });

  const renderContent = () => {
    if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-3/4" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>;
    if (isError || !data) return <p>Impossible de charger les détails de l'utilisateur.</p>;

    const { profile, wallet } = data;

    return (
      <div className="space-y-6">
        <section>
          <h3 className="font-semibold mb-2">Portefeuille</h3>
          <div className="grid grid-cols-3 gap-4 text-center p-4 rounded-lg bg-muted/50">
            <div><p className="text-sm text-muted-foreground">Solde Total</p><p className="font-bold text-lg">{formatCurrency(Number(wallet?.total_balance || 0), wallet?.currency)}</p></div>
            <div><p className="text-sm text-muted-foreground">Investi</p><p className="font-bold text-lg">{formatCurrency(Number(wallet?.invested_balance || 0), wallet?.currency)}</p></div>
            <div><p className="text-sm text-muted-foreground">Profits</p><p className="font-bold text-lg">{formatCurrency(Number(wallet?.profit_balance || 0), wallet?.currency)}</p></div>
          </div>
        </section>
        {/* You can add more sections here to display contracts, transactions etc. */}
      </div>
    );
  };

  return (
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{data?.profile?.first_name || data?.profile?.email || "Détails de l'utilisateur"}</DialogTitle>
        <DialogDescription>Vue d'ensemble du compte de l'utilisateur.</DialogDescription>
      </DialogHeader>
      {renderContent()}
      <DialogFooter className="mt-4 border-t pt-4">
        <DialogClose asChild>
          <Button variant="secondary">Fermer</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  );
};
