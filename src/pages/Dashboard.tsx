import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useMongoDb } from '@/hooks/useMongoDb';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import {
  Database,
  Users,
  Activity,
  FileText,
  TrendingUp,
  Calendar,
  DollarSign,
  Stethoscope,
  RefreshCw,
  Loader2,
} from 'lucide-react';

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--chart-6))',
];

interface DashboardStats {
  totalRecords: number;
  collectionsCount: number;
  recentInserts: number;
  recentUpdates: number;
  topDoctors: Array<{ name: string; appointments: number }>;
  genderDistribution: Array<{ gender: string; count: number; fill?: string }>;
  departmentLoads: Array<{ department: string; count: number }>;
  billingTotals: Array<{ method: string; total: number }>;
  monthlyAppointments: Array<{ month: string; count: number }>;
  testResults: Array<{ result: string; count: number; fill?: string }>;
}

const EMPTY_STATS: DashboardStats = {
  totalRecords: 0,
  collectionsCount: 0,
  recentInserts: 0,
  recentUpdates: 0,
  topDoctors: [],
  genderDistribution: [],
  departmentLoads: [],
  billingTotals: [],
  monthlyAppointments: [],
  testResults: [],
};

interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
}

function StatCard({ title, value, description, icon, trend, trendUp }: StatCardProps) {
  return (
    <Card className="glass border-border/50 hover:shadow-glow transition-all duration-300">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="text-primary">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</div>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs text-muted-foreground">{description}</p>
          {trend && (
            <Badge variant={trendUp ? 'default' : 'secondary'} className="text-xs">
              {trend}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { getDashboardStats } = useMongoDb();
  const { toast } = useToast();

  const fetchStats = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const data = (await getDashboardStats()) as Partial<DashboardStats> | null;
      if (!data) {
        return;
      }
      setStats({
        totalRecords: data.totalRecords ?? 0,
        collectionsCount: data.collectionsCount ?? 0,
        recentInserts: data.recentInserts ?? 0,
        recentUpdates: data.recentUpdates ?? 0,
        topDoctors: (data.topDoctors ?? []).map((doctor: { doctorName?: string; name?: string; appointments?: number }) => ({
          name: doctor?.doctorName || doctor?.name || 'Unknown',
          appointments: doctor?.appointments ?? 0,
        })),
        genderDistribution: (data.genderDistribution ?? []).map(
          (item: { gender: string; count: number }, index: number) => ({
            ...item,
            fill: CHART_COLORS[index % CHART_COLORS.length],
          }),
        ),
        departmentLoads: data.departmentLoads ?? [],
        billingTotals: data.billingTotals ?? [],
        monthlyAppointments: data.monthlyAppointments ?? [],
        testResults: (data.testResults ?? []).map((item: { result: string; count: number }, index: number) => ({
          ...item,
          fill: index % 2 === 0 ? 'hsl(var(--success))' : 'hsl(var(--warning))',
        })),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to refresh dashboard';
      toast({
        title: 'Dashboard refresh failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [getDashboardStats, toast]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const topDoctorMax = useMemo(() => stats.topDoctors[0]?.appointments || 1, [stats.topDoctors]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient-primary">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Real-time hospital database statistics</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-primary border-primary">
            <Activity className="h-3 w-3 mr-1 animate-pulse" />
            Live
          </Badge>
          <Button variant="outline" size="sm" onClick={fetchStats} disabled={isRefreshing}>
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Records"
          value={stats.totalRecords}
          description="Across all collections"
          icon={<Database className="h-5 w-5" />}
          trend="+12%"
          trendUp
        />
        <StatCard
          title="Collections"
          value={stats.collectionsCount}
          description="Active MongoDB collections"
          icon={<FileText className="h-5 w-5" />}
        />
        <StatCard
          title="Recent Inserts"
          value={stats.recentInserts}
          description="Last 24 hours"
          icon={<TrendingUp className="h-5 w-5" />}
          trend="+8%"
          trendUp
        />
        <StatCard
          title="Recent Updates"
          value={stats.recentUpdates}
          description="Last 24 hours"
          icon={<Activity className="h-5 w-5" />}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Appointments */}
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Monthly Appointments
            </CardTitle>
            <CardDescription>Appointment trends over the past 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.monthlyAppointments}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Department Loads */}
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-accent" />
              Department Loads
            </CardTitle>
            <CardDescription>Patient distribution by department</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.departmentLoads} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis dataKey="department" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={80} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gender Distribution */}
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-chart-1" />
              Gender Distribution
            </CardTitle>
            <CardDescription>Patient demographics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.genderDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="count"
                    label={({ gender, percent }) => `${gender} ${(percent * 100).toFixed(0)}%`}
                  >
                    {stats.genderDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Billing Totals */}
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-success" />
              Billing by Method
            </CardTitle>
            <CardDescription>Total revenue by payment method</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.billingTotals}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="method" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Total']}
                  />
                  <Bar dataKey="total" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Lab Test Results */}
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-warning" />
              Lab Test Results
            </CardTitle>
            <CardDescription>Normal vs Abnormal results</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.testResults}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="count"
                    label={({ result, percent }) => `${result} ${(percent * 100).toFixed(0)}%`}
                  >
                    {stats.testResults.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Doctors */}
      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            Top 5 Doctors by Appointments
          </CardTitle>
          <CardDescription>Most active physicians this month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.topDoctors.map((doctor, index) => (
              <div key={`${doctor.name}-${index}`} className="flex items-center gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{doctor.name}</span>
                    <span className="text-muted-foreground text-sm">{doctor.appointments} appointments</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-primary rounded-full transition-all duration-500"
                      style={{
                        width: `${(doctor.appointments / topDoctorMax) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
