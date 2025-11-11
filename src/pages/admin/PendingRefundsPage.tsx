import { PendingRefunds } from "@/components/admin/PendingRefunds";

const PendingRefundsPage = () => {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Remboursements en Attente</h1>
        <p className="text-muted-foreground">
          Gérez les demandes de remboursement des utilisateurs.
        </p>
      </div>
      <PendingRefunds />
    </div>
  );
};

export default PendingRefundsPage;
