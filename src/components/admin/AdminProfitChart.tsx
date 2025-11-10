import { useQuery } from "@tanstack/react-query";
import { getAggregateProfitsByMonth } from "@/services/adminService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { formatCurrency, formatCompactNumber } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// Custom Tooltip Component for a more integrated look
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-4 bg-background-card/80 backdrop-blur-sm border border-white/10 rounded-lg shadow-lg">
        <p className="label text-sm text-muted-foreground">{`${label}`}</p>
        <p className="intro text-lg font-bold text-primary">{`${formatCurrency(payload[0].value)}`}</p>
      </div>
    );
  }
  return null;
};

export const AdminProfitChart = () => {
  const { data: profits, isLoading } = useQuery({
    queryKey: ["aggregateProfits"],
    queryFn: getAggregateProfitsByMonth,
  });

  if (isLoading) {
    return <Skeleton className="h-[400px]" />;
  }

  if (!profits || profits.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Évolution des Profits</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <p className="text-muted-foreground">Aucune donnée de profit agrégée.</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = profits.map(p => ({
    month_year: p.month_year,
    "Total Profit": Number(p.total_profit),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Évolution des Profits</CardTitle>
        <p className="text-sm text-muted-foreground">Cumul des profits sur les 10 derniers mois</p>
      </CardHeader>
      <CardContent className="pl-2">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <defs>
              <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00FF41" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#00FF41" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="month_year" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#a1a1aa" fontSize={13} tickLine={false} axisLine={false} tickFormatter={(value) => formatCompactNumber(value)} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#00FF41', strokeWidth: 1, strokeDasharray: '3 3' }} />
            <Area 
              type="monotone" 
              dataKey="Total Profit" 
              stroke="#00FF41" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorProfit)" 
              activeDot={{ r: 6, strokeWidth: 2, fill: '#000', stroke: '#00FF41' }} 
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};