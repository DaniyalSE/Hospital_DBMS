import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layers, Lock, Database, Zap } from 'lucide-react';

export default function Transactions() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-gradient-primary">Transactions & Concurrency</h1>
        <p className="text-muted-foreground mt-1">MongoDB multi-document transactions and indexing demos</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Multi-Document Transactions
            </CardTitle>
            <CardDescription>ACID transactions on replica sets</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">Requires MongoDB Atlas Replica Set</Badge>
            <p className="text-sm text-muted-foreground mt-4">
              Demonstrates atomic operations across multiple collections ensuring data consistency.
            </p>
          </CardContent>
        </Card>

        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-accent" />
              Concurrency Control
            </CardTitle>
            <CardDescription>Optimistic locking patterns</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Version-based concurrency control to prevent lost updates in concurrent modifications.
            </p>
          </CardContent>
        </Card>

        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-success" />
              Index Management
            </CardTitle>
            <CardDescription>Create, analyze, and optimize indexes</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Create indexes, run explain plans, and visualize query performance improvements.
            </p>
          </CardContent>
        </Card>

        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-warning" />
              Performance Analysis
            </CardTitle>
            <CardDescription>Query execution metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Compare query execution times with and without indexes across different collections.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
