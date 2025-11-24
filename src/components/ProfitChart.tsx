
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

type ProfitData = Database['public']['Tables']['profits']['Row'];

interface ProfitChartProps {
  profits: ProfitData[] | undefined;
}

/**
 * ProfitChart Component
 * 
 * Displays a monthly area chart of profits from active contracts.
 */
export const ProfitChart = ({ profits }: ProfitChartProps) => {
  if (!profits || profits.length === 0) {
    return (
      <Card className="shadow-elegant border-border/50 bg-gradient-card">
        <CardHeader>
          <CardTitle>Profits Mensuels des Contrats Actifs</CardTitle>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center text-muted-foreground">
          Aucune donnée de profit disponible.
        </CardContent>
      </Card>
    );
  }

  // Process data for monthly profits for active contracts
  const monthlyProfitsMap = new Map<number, number>();
  profits.forEach(profit => {
    const monthNumber = profit.month_number; // Assuming month_number is 1-based
    if (monthNumber >= 1 && monthNumber <= 10) { // Filter for 10 months
      monthlyProfitsMap.set(monthNumber, (monthlyProfitsMap.get(monthNumber) || 0) + Number(profit.amount));
    }
  });

  const chartData = Array.from({ length: 10 }, (_, i) => {
    const month = i + 1;
    return {
      month: `Mois ${month}`,
      profit: monthlyProfitsMap.get(month) || 0,
    };
  });

  return (
    <Card className="shadow-elegant border-border/50 bg-gradient-card">
      <CardHeader>
        <CardTitle>Profits Mensuels des Contrats Actifs</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart
            data={chartData}
            margin={{
              top: 5,
              right: 10,
              left: 10,
              bottom: 5,
            }}
          >
            <defs>
              <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4ade80" stopOpacity={0.7} />
                <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" strokeOpacity={0.3} />
            <XAxis dataKey="month" stroke="#cbd5e0" />
            <YAxis stroke="#cbd5e0" tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
            <Tooltip
              formatter={(value: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD" }).format(value)}
              labelFormatter={(label: string) => `${label}`}
              contentStyle={{
                backgroundColor: 'rgba(31, 41, 55, 0.8)',
                backdropFilter: 'blur(4px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '0.5rem',
                color: '#f9fafb'
              }}
            />
            <Area
              type="monotone"
              dataKey="profit"
              stroke="#4ade80"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorProfit)"
              name="Profit Mensuel"
              animationDuration={1200}
              animationEasing="ease-in-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
