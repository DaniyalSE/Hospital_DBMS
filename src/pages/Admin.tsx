import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Users, FileText, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMongoDb } from '@/hooks/useMongoDb';
import { useToast } from '@/hooks/use-toast';

interface AdminStats {
  activeUsers: number;
  admins: number;
  auditLogs: number;
  uptime: number;
  roleSamples: Array<{ email: string; role: string }>;
}

const EMPTY_STATS: AdminStats = {
  activeUsers: 0,
  admins: 0,
  auditLogs: 0,
  uptime: 0,
  roleSamples: [],
};

export default function Admin() {
  const [stats, setStats] = useState<AdminStats>(EMPTY_STATS);
  const [isLoading, setIsLoading] = useState(false);
  const { getAdminStats } = useMongoDb();
  const { toast } = useToast();

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getAdminStats();
      if (!data) return;
      setStats({
        activeUsers: data.activeUsers || 0,
        admins: data.admins || 0,
        auditLogs: data.auditLogs || 0,
        uptime: data.uptime || 0,
        roleSamples: data.roleSamples || [],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load admin stats';
      toast({ title: 'Admin data error', description: message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [getAdminStats, toast]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-gradient-primary">Admin Panel</h1>
        <p className="text-muted-foreground mt-1">System administration and user management</p>
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={fetchStats} disabled={isLoading}>
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass border-border/50">
          <CardContent className="pt-6 text-center">
            <Users className="h-8 w-8 mx-auto text-primary mb-2" />
            <p className="text-2xl font-bold">{stats.activeUsers.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Active Users</p>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="pt-6 text-center">
            <Shield className="h-8 w-8 mx-auto text-success mb-2" />
            <p className="text-2xl font-bold">{stats.admins.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Admins</p>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="pt-6 text-center">
            <FileText className="h-8 w-8 mx-auto text-accent mb-2" />
            <p className="text-2xl font-bold">{stats.auditLogs.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Audit Logs</p>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="pt-6 text-center">
            <Activity className="h-8 w-8 mx-auto text-warning mb-2" />
            <p className="text-2xl font-bold">{stats.uptime.toFixed(1)}%</p>
            <p className="text-sm text-muted-foreground">Uptime</p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle>Role Management</CardTitle>
          <CardDescription>Manage user access levels</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.roleSamples.length === 0 && (
              <p className="text-muted-foreground text-sm">No role samples available.</p>
            )}
            {stats.roleSamples.map((sample) => (
              <div key={sample.email} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <span>{sample.email}</span>
                <Badge className="bg-gradient-primary">{sample.role}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
