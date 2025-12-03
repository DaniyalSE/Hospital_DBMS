import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings as SettingsIcon, Database, Activity } from 'lucide-react';

export default function Settings() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-gradient-primary">Settings</h1>
        <p className="text-muted-foreground mt-1">Database connection and app configuration</p>
      </div>

      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            MongoDB Connection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Status</span>
            <Badge variant="default" className="bg-success">
              <Activity className="h-3 w-3 mr-1 animate-pulse" />Connected
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Database</span>
            <span className="font-mono text-sm">hospital_db</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Collections</span>
            <span className="font-mono text-sm">20</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
