import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { useMongoDb, type MongoCollection } from '@/hooks/useMongoDb';
import { useRealtime } from '@/hooks/useRealtime';
import { useToast } from '@/hooks/use-toast';
import {
  FolderOpen,
  Search,
  Eye,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  Database,
  Key,
  Activity,
  Loader2,
} from 'lucide-react';

export default function Collections() {
  const [searchQuery, setSearchQuery] = useState('');
  const [collections, setCollections] = useState<MongoCollection[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { getCollections } = useMongoDb();
  const { toast } = useToast();
  const realtimeRefreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCollections = useCallback(async () => {
    setIsFetching(true);
    try {
      const data = await getCollections();
      setCollections(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load collections';
      toast({
        title: 'Failed to load collections',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsFetching(false);
    }
  }, [getCollections, toast]);

  useEffect(() => {
    fetchCollections();
    return () => {
      if (realtimeRefreshRef.current) {
        clearTimeout(realtimeRefreshRef.current);
      }
    };
  }, [fetchCollections]);

  const scheduleRealtimeRefresh = useCallback(() => {
    if (realtimeRefreshRef.current) return;
    realtimeRefreshRef.current = setTimeout(() => {
      realtimeRefreshRef.current = null;
      fetchCollections();
    }, 750);
  }, [fetchCollections]);

  const { status: realtimeStatus } = useRealtime({ onEvent: scheduleRealtimeRefresh });

  const filteredCollections = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return collections;
    return collections.filter((col) => col.name.toLowerCase().includes(query));
  }, [collections, searchQuery]);

  const totalRecords = useMemo(() => collections.reduce((sum, col) => sum + (col.count || 0), 0), [collections]);
  const totalIndexes = useMemo(
    () => collections.reduce((sum, col) => sum + (col.indexes?.length || 0), 0),
    [collections],
  );

  const realtimeLabel = realtimeStatus === 'open' ? 'Live' : realtimeStatus === 'connecting' ? 'Connecting' : 'Reconnecting';
  const realtimeVariant = realtimeStatus === 'open' ? 'outline' : 'secondary';

  const formatDate = (value: string | Date | undefined) => {
    if (!value) return 'Unknown';
    const date = typeof value === 'string' ? new Date(value) : value;
    return date.toLocaleString();
  };

  const handleViewCollection = (collectionName: string) => {
    navigate(`/collections/${collectionName}`);
  };

  const handleExportCSV = async (collectionName: string) => {
    console.log('Exporting', collectionName);
  };

  const handleRefresh = () => {
    fetchCollections();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient-primary">Collections</h1>
          <p className="text-muted-foreground mt-1">Full visibility into your hospital MongoDB Atlas collections</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-lg px-4 py-2">
            <Database className="h-4 w-4 mr-2" />
            {totalRecords.toLocaleString()} total records
          </Badge>
          <Badge variant={realtimeVariant} className="px-4 py-2">
            <Activity className="h-3 w-3 mr-1" />
            {realtimeLabel}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <FolderOpen className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{collections.length}</p>
                <p className="text-sm text-muted-foreground">Collections</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-success/10">
                <Database className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalRecords.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Records</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-accent/10">
                <Key className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalIndexes}</p>
                <p className="text-sm text-muted-foreground">Total Indexes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-warning/10">
                <Activity className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{realtimeLabel}</p>
                <p className="text-sm text-muted-foreground">Sync Status</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass border-border/50">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search collections..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-muted/50"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
                {isFetching ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {isFetching ? 'Refreshing' : 'Refresh'}
              </Button>
              {isAdmin && (
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Import CSV
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold">Collection</TableHead>
                  <TableHead className="font-semibold text-right">Documents</TableHead>
                  <TableHead className="font-semibold">Indexed Fields</TableHead>
                  <TableHead className="font-semibold">Last Updated</TableHead>
                  <TableHead className="font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCollections.map((collection) => (
                  <TableRow
                    key={collection.name}
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={() => handleViewCollection(collection.name)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <FolderOpen className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium">{collection.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {(collection.count || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(collection.indexes || []).slice(0, 3).map((index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {index}
                          </Badge>
                        ))}
                        {collection.indexes && collection.indexes.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{collection.indexes.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(collection.lastUpdated)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleViewCollection(collection.name)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleExportCSV(collection.name)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredCollections.length === 0 && (
            <div className="text-center py-12">
              <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No collections found matching "{searchQuery}"</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
