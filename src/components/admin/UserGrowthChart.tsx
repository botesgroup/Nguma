import { useQuery } from "@tanstack/react-query";
import { getUserGrowthSummary } from "@/services/adminService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  LineChart,
  Line,
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
      <Card>
        <CardHeader>
          <CardTitle>User Growth (Last 12 Months)</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <p className="text-muted-foreground">No user growth data available.</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = userGrowth.map(item => ({
    month: item.month_year,
    "New Users": Number(item.new_users_count),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Croissance des Utilisateurs (12 derniers mois)</CardTitle>
      </CardHeader>
      <CardContent className="pl-2">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#242629" />
            <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ backgroundColor: "#1A1A1D", border: "none", borderRadius: "8px" }}
              labelStyle={{ color: "#EAEAEA" }}
            />
            <Line
              type="monotone"
              dataKey="New Users"
              stroke="#8884d8"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 8 }}
              animationDuration={1000}
              animationEasing="ease-in-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
