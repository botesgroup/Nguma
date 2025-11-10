
import { InvestorListTable } from "@/components/admin/InvestorListTable";

const UsersPage = () => {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Gestion des Investisseurs</h1>
        <p className="text-muted-foreground">
          Affichez et gérez les comptes des investisseurs de la plateforme.
        </p>
      </div>
      <InvestorListTable />
    </div>
  );
};

export default UsersPage;
