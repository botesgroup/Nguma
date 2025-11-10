
import { useQuery } from "@tanstack/react-query";
import { DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getUserContracts } from "@/services/adminService";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";

interface ManageContractsDialogProps {
  userId: string;
}

export const ManageContractsDialog = ({ userId }: ManageContractsDialogProps) => {
  const { data: contracts, isLoading } = useQuery({
    queryKey: ["userContracts", userId],
    queryFn: () => getUserContracts(userId),
    enabled: !!userId,
  });

  return (
    <DialogContent className="sm:max-w-[800px]">
      <DialogHeader>
        <DialogTitle>Contrats de l'Utilisateur</DialogTitle>
        <DialogDescription>
          Liste de tous les contrats, actifs et passés, pour l'utilisateur sélectionné.
        </DialogDescription>
      </DialogHeader>
      <div className="py-4">
        {isLoading ? (
          <p>Chargement des contrats...</p>
        ) : contracts && contracts.length > 0 ? (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date de début</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Durée</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell>{format(new Date(contract.start_date), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{formatCurrency(contract.amount, contract.currency)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        contract.status === 'active' ? 'bg-green-100 text-green-800' :
                        contract.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {contract.status}
                      </span>
                    </TableCell>
                    <TableCell>{contract.duration_months} mois</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p>Aucun contrat trouvé pour cet utilisateur.</p>
        )}
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary">Fermer</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  );
};
