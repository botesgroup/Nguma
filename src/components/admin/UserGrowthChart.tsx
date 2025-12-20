import { useQuery } from "@tanstack/react-query";
import { getUserGrowthSummary } from "@/services/adminService";
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
import { Skeleton } from "@/components/ui/skeleton";

export const UserGrowthChart = () => {
  const { data: userGrowth, isLoading } = useQuery({
    queryKey: ["userGrowthSummary"],
    queryFn: getUserGrowthSummary,
  });

  if (isLoading) {
    return <Skeleton className="h-[400px]" />;
  }

  if (!userGrowth || userGrowth.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-background-card/50 to-background/50 border-white/5 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg font-bold">Croissance Totale</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <p className="text-muted-foreground">Aucune donnée de croissance disponible.</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate cumulative growth to ensure a strictly increasing curve (Total Users over time)
  let runningTotal = 0;
  const chartData = userGrowth.map(item => {
    runningTotal += Number(item.new_users_count);
    return {
      month: item.month_year,
      "Total Utilisateurs": runningTotal,
      "Mois": item.month_year
    };
  });

  return (
    <Card className="bg-gradient-to-br from-background-card/50 to-background/50 border-white/5 backdrop-blur-sm overflow-hidden group">
      <CardHeader>
        <CardTitle className="text-lg font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          Croissance Totale Utilisateurs
        </CardTitle>
        <p className="text-xs text-muted-foreground italic">Progression cumulative sur 12 mois</p>
      </CardHeader>
      <CardContent className="pl-2 pt-4">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818CF8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#818CF8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
              <XAxis
                dataKey="month"
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                dy={10}
              />
              <YAxis
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15, 23, 42, 0.9)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "12px",
                  backdropFilter: "blur(8px)",
                  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)"
                }}
                labelStyle={{ color: "#94a3b8", marginBottom: "4px", fontSize: "12px" }}
                itemStyle={{ color: "#818CF8", fontWeight: "bold", fontSize: "14px" }}
                cursor={{ stroke: '#818CF8', strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="Total Utilisateurs"
                stroke="#818CF8"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorUsers)"
                animationDuration={2000}
                animationEasing="cubic-bezier(0.4, 0, 0.2, 1)"
                activeDot={{ r: 6, fill: "#818CF8", stroke: "#fff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
