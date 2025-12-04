import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useLocking, type LockSnapshot, type QueueEntry, type LockStatusSummary, type QueueSummary } from '@/hooks/useLocking';
import { Switch } from '@/components/ui/switch';
import { Activity, RefreshCw, ShieldAlert, Clock3, Terminal, Zap, Users, Layers, TimerReset, type LucideIcon } from 'lucide-react';

const DEFAULT_RESOURCE = 'Appointments';
const DEFAULT_HOLD_SECONDS = 15;
const AUTO_REFRESH_MS = 5000;

export default function LockingDashboard() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const { getStatus, getQueue, simulateReadLock, simulateWriteLock, forceUnlock, clearLocks } = useLocking();
  const [locks, setLocks] = useState<LockSnapshot[]>([]);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [lockSummary, setLockSummary] = useState<LockStatusSummary | null>(null);
  const [queueSummary, setQueueSummary] = useState<QueueSummary | null>(null);
  const [resourceId, setResourceId] = useState(DEFAULT_RESOURCE);
  const [holdSeconds, setHoldSeconds] = useState(String(DEFAULT_HOLD_SECONDS));
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const parsedHoldSeconds = Number(holdSeconds);
  const resolvedHoldSeconds = Number.isFinite(parsedHoldSeconds) && parsedHoldSeconds > 0 ? parsedHoldSeconds : DEFAULT_HOLD_SECONDS;
  const holdDurationMs = resolvedHoldSeconds * 1000;
  const lastUpdated = lockSummary?.lastUpdated ?? queueSummary?.lastUpdated ?? null;
  const formatTimestamp = (timestamp?: string | null) =>
    timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
  const statCards: Array<{ label: string; value: number; detail: string; icon: LucideIcon }> = [
    {
      label: 'Active Locks',
      value: lockSummary?.total ?? 0,
      detail: lockSummary ? `${lockSummary.readers} readers · ${lockSummary.writers} writers` : 'Awaiting data',
      icon: Activity,
    },
    {
      label: 'Resources Touched',
      value: lockSummary?.resources ?? 0,
      detail: lockSummary ? 'Unique tables currently locked' : 'Awaiting data',
      icon: Layers,
    },
    {
      label: 'Queue Depth',
      value: queueSummary?.total ?? 0,
      detail: queueSummary ? `${queueSummary.readers} readers · ${queueSummary.writers} writers` : 'No waiting sessions',
      icon: Users,
    },
  ];

  const runAction = async (name: string, action: () => Promise<void>) => {
    setBusyAction(name);
    try {
      await action();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lock operation failed';
      toast({ title: 'Locking action failed', description: message, variant: 'destructive' });
    } finally {
      setBusyAction((prev) => (prev === name ? null : prev));
    }
  };

  const refreshStatus = useCallback(async () => {
    const status = await getStatus();
    setLocks(status.locks ?? []);
    setLogs(status.logs ?? []);
    setLockSummary(status.summary ?? null);
  }, [getStatus]);

  const refreshQueue = useCallback(async () => {
    const data = await getQueue();
    setQueue(data.queue ?? []);
    setQueueSummary(data.summary ?? null);
  }, [getQueue]);

  const refreshAll = useCallback(async () => {
    await Promise.allSettled([refreshStatus(), refreshQueue()]);
  }, [refreshStatus, refreshQueue]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }
    const interval = setInterval(() => {
      refreshAll().catch(() => undefined);
    }, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshAll]);

  const handleSimulatedRead = () =>
    runAction('simulate-read', async () => {
      const target = resourceId || DEFAULT_RESOURCE;
      await simulateReadLock(target, holdDurationMs);
      toast({ title: 'Simulated read lock', description: `Session held ~${resolvedHoldSeconds}s on ${target}` });
      await refreshAll();
    });

  const handleSimulatedWrite = () =>
    runAction('simulate-write', async () => {
      const target = resourceId || DEFAULT_RESOURCE;
      await simulateWriteLock(target, holdDurationMs);
      toast({ title: 'Simulated write lock', description: `Writer holds ~${resolvedHoldSeconds}s on ${target}` });
      await refreshAll();
    });

  const handleDeadlockDemo = () =>
    runAction('simulate-deadlock', async () => {
      const target = resourceId || DEFAULT_RESOURCE;
      await simulateWriteLock(target, holdDurationMs);
      await simulateWriteLock(target, holdDurationMs);
      toast({
        title: 'Deadlock demo triggered',
        description: 'Two writers on the same resource create a queue you can inspect.',
      });
      await refreshAll();
    });

  const handleForceUnlock = () =>
    runAction('force-unlock', async () => {
      if (!resourceId) {
        toast({ title: 'Resource required', description: 'Select a resource to unlock', variant: 'destructive' });
        return;
      }
      await forceUnlock(resourceId);
      toast({ title: 'Force unlock executed', description: `${resourceId} locks cleared` });
      await refreshAll();
    });

  const handleClear = () =>
    runAction('clear', async () => {
      await clearLocks();
      toast({ title: 'Locks cleared', description: 'All locks and queues reset' });
      await refreshAll();
    });

  const handleShowLocks = () => runAction('show-locks', refreshStatus);
  const handleShowQueue = () => runAction('show-queue', refreshQueue);

  const isBusy = (name: string) => busyAction === name;


  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2">
        <Badge variant="outline" className="w-fit gap-2">
          <Activity className="h-3.5 w-3.5 text-success" />
          Real-Time Locking
        </Badge>
        <h1 className="text-3xl font-bold text-gradient-primary">Locking System</h1>
        <p className="text-muted-foreground max-w-2xl">
          Monitor the simulated DBMS lock table, inspect queued sessions, and reproduce classic concurrency scenarios
          for classroom demos.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="glass flex items-center gap-4 rounded-2xl border border-border/60 px-4 py-3">
              <div className="rounded-2xl bg-primary/10 p-2 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className="text-2xl font-semibold tracking-tight">{card.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{card.detail}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TimerReset className="h-4 w-4" />
          <span>Last refresh {formatTimestamp(lastUpdated)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium">
          <Switch id="auto-refresh" checked={autoRefresh} onCheckedChange={(checked) => setAutoRefresh(checked)} />
          <label htmlFor="auto-refresh" className="cursor-pointer select-none">
            Auto refresh (5s)
          </label>
        </div>
      </div>

      <Card className="glass border-border/60">
        <CardHeader>
          <CardTitle>Control Panel</CardTitle>
          <CardDescription>Trigger locks, inspect state, and recover from conflicts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="flex-1 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm text-muted-foreground">Target resource</label>
                <Input
                  value={resourceId}
                  onChange={(event) => setResourceId(event.target.value)}
                  placeholder="Appointments"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Simulated hold (seconds)</label>
                <Input
                  type="number"
                  min={1}
                  value={holdSeconds}
                  onChange={(event) => setHoldSeconds(event.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Keeps demo locks visible after navigation.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleShowLocks} disabled={isBusy('show-locks')}>
                {isBusy('show-locks') && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                Show Active Locks
              </Button>
              <Button variant="outline" onClick={handleShowQueue} disabled={isBusy('show-queue')}>
                {isBusy('show-queue') && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                Show Lock Queue
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <Button variant="secondary" onClick={handleSimulatedRead} disabled={isBusy('simulate-read')}>
              {isBusy('simulate-read') && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Simulate Read Lock
            </Button>
            <Button variant="secondary" onClick={handleSimulatedWrite} disabled={isBusy('simulate-write')}>
              {isBusy('simulate-write') && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Simulate Write Lock
            </Button>
            <Button variant="outline" onClick={handleDeadlockDemo} disabled={isBusy('simulate-deadlock')}>
              {isBusy('simulate-deadlock') && <Zap className="mr-2 h-4 w-4 animate-spin" />}
              Simulate Deadlock Scenario
            </Button>
            {isAdmin && (
              <Button variant="destructive" onClick={handleForceUnlock} disabled={isBusy('force-unlock')}>
                <ShieldAlert className="mr-2 h-4 w-4" />
                Force Unlock
              </Button>
            )}
            <Button variant="ghost" onClick={handleClear} disabled={isBusy('clear')}>
              Clear All Locks
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass border-border/60 overflow-hidden">
          <CardHeader>
            <CardTitle>Active Locks</CardTitle>
            <CardDescription>Every reader and writer is timestamped for easy auditing.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Resource</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Held Since</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                      No active locks. Run a simulation to populate this table.
                    </TableCell>
                  </TableRow>
                )}
                {locks.map((lock) => (
                  <TableRow key={`${lock.resourceId}-${lock.sessionId}-${lock.heldSince}`}>
                    <TableCell className="font-medium">{lock.resourceId}</TableCell>
                    <TableCell>
                      <Badge variant={lock.type === 'write' ? 'destructive' : 'secondary'} className="capitalize">
                        {lock.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{lock.sessionId}</TableCell>
                    <TableCell>{formatTimestamp(lock.heldSince)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="glass border-border/60 overflow-hidden">
          <CardHeader>
            <CardTitle>Lock Queue</CardTitle>
            <CardDescription>Queued sessions illustrate fairness and starvation avoidance.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Resource</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Waiting Since</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                      Queue is empty. Trigger a write/write scenario to see fairness in action.
                    </TableCell>
                  </TableRow>
                )}
                {queue.map((entry) => (
                  <TableRow key={`${entry.resourceId}-${entry.sessionId}-${entry.waitingSince}`}>
                    <TableCell className="font-medium">{entry.resourceId}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {entry.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{entry.sessionId}</TableCell>
                    <TableCell>{formatTimestamp(entry.waitingSince)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="glass border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            Lock Event Log
          </CardTitle>
          <CardDescription>Stream of every acquire/release/timeout event (latest first).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-72 overflow-y-auto rounded-lg bg-muted/40 p-4 font-mono text-xs space-y-1">
            {logs.length === 0 && <p className="text-muted-foreground">No events captured yet. Fetch lock status to view the latest log tail.</p>}
            {logs.map((entry, index) => (
              <div key={`${entry}-${index}`} className="flex items-start gap-2">
                <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{entry}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
