import { useQuery } from "@tanstack/react-query";
import { getCashFlowSummary } from "@/services/adminService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { formatCurrency, formatCompactNumber } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export const CashFlowChart = () => {
  const { data: cashFlow, isLoading } = useQuery({
    queryKey: ["cashFlowSummary"],
    queryFn: getCashFlowSummary,
  });

  if (isLoading) {
    return <Skeleton className="h-[400px]" />;
  }

  if (!cashFlow || cashFlow.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Flux de Transactions (12 derniers mois)</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <p className="text-muted-foreground">Aucune donnée de flux de transactions (12 derniers mois) disponible.</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = cashFlow.map(item => ({
    month: item.month_year,
    Deposits: Number(item.total_deposits),
    Withdrawals: Number(item.total_withdrawals),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Flux de Transactions (12 derniers mois)</CardTitle>
      </CardHeader>
      <CardContent className="pl-2">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#242629" />
            <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#a1a1aa" fontSize={13} tickLine={false} axisLine={false} tickFormatter={(value) => formatCompactNumber(value)} />
            <Tooltip
              contentStyle={{ backgroundColor: "#1A1A1D", border: "none", borderRadius: "8px" }}
              labelStyle={{ color: "#EAEAEA" }}
              formatter={(value: number, name: string) => [formatCurrency(value), name === 'Deposits' ? 'Dépôts' : 'Retraits']}
            />
            <Legend 
              wrapperStyle={{ fontSize: "14px" }} 
              formatter={(value) => {
                if (value === 'Deposits') return 'Dépôts';
                if (value === 'Withdrawals') return 'Retraits';
                return value;
              }}
            />
            <Bar dataKey="Deposits" fill="#00FF41" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="Withdrawals" fill="#FF4136" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
