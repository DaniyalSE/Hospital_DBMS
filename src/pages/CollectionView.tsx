import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useMongoDb, type MongoDocument } from '@/hooks/useMongoDb';
import { useRealtime } from '@/hooks/useRealtime';
import {
  ArrowLeft,
  Search,
  Plus,
  Edit,
  Trash2,
  Download,
  ChevronLeft,
  ChevronRight,
  Code,
  Table as TableIcon,
  Filter,
  RefreshCw,
  Loader2,
  Eye,
  Copy,
} from 'lucide-react';

const DEFAULT_FILTER = '{}';

export default function CollectionView() {
  const { collectionName } = useParams<{ collectionName: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const { getDocuments, createDocument, updateDocument, deleteDocument } = useMongoDb();
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [documents, setDocuments] = useState<MongoDocument[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterInput, setFilterInput] = useState(DEFAULT_FILTER);
  const [activeFilter, setActiveFilter] = useState(DEFAULT_FILTER);
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<MongoDocument | null>(null);
  const [isDocDialogOpen, setIsDocDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedJson, setEditedJson] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const filterObject = useMemo(() => {
    try {
      return activeFilter ? JSON.parse(activeFilter) : {};
    } catch {
      return {};
    }
  }, [activeFilter]);

  const filteredDocuments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return documents;
    return documents.filter((doc) => JSON.stringify(doc).toLowerCase().includes(query));
  }, [documents, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const fetchDocuments = useCallback(async () => {
    if (!collectionName) return;
    setIsLoading(true);
    try {
      const response = await getDocuments(collectionName, {
        page: currentPage,
        limit: pageSize,
        filter: filterObject,
      });
      setDocuments(response.documents);
      setTotalCount(response.totalCount);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load documents';
      toast({
        title: 'Failed to load documents',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [collectionName, currentPage, pageSize, filterObject, getDocuments, toast]);

  useEffect(() => {
    if (!collectionName) return;
    fetchDocuments();
    return () => {
      if (realtimeTimerRef.current) {
        clearTimeout(realtimeTimerRef.current);
      }
    };
  }, [collectionName, fetchDocuments]);

  useEffect(() => {
    setCurrentPage(1);
    setSearchQuery('');
    setFilterInput(DEFAULT_FILTER);
    setActiveFilter(DEFAULT_FILTER);
  }, [collectionName]);

  const scheduleRealtimeRefresh = useCallback(() => {
    if (realtimeTimerRef.current) return;
    realtimeTimerRef.current = setTimeout(() => {
      realtimeTimerRef.current = null;
      fetchDocuments();
    }, 500);
  }, [fetchDocuments]);

  useRealtime({
    collections: collectionName ? [collectionName] : undefined,
    enabled: Boolean(collectionName),
    onEvent: scheduleRealtimeRefresh,
  });

  const handleApplyFilter = () => {
    try {
      const parsed = filterInput.trim() ? JSON.parse(filterInput) : {};
      setActiveFilter(JSON.stringify(parsed));
      setCurrentPage(1);
      toast({ title: 'Filter applied', description: 'Server-side filter updated' });
    } catch {
      toast({
        title: 'Invalid JSON',
        description: 'Please enter a valid JSON filter query',
        variant: 'destructive',
      });
    }
  };

  const handleClearFilter = () => {
    setFilterInput(DEFAULT_FILTER);
    setActiveFilter(DEFAULT_FILTER);
    setCurrentPage(1);
    fetchDocuments();
  };

  const handleRefresh = () => {
    fetchDocuments();
  };

  const handleViewDocument = (doc: MongoDocument) => {
    setSelectedDoc(doc);
    setEditedJson(JSON.stringify(doc, null, 2));
    setIsEditMode(false);
    setIsDocDialogOpen(true);
  };

  const handleEditDocument = (doc: MongoDocument) => {
    setSelectedDoc(doc);
    setEditedJson(JSON.stringify(doc, null, 2));
    setIsEditMode(true);
    setIsDocDialogOpen(true);
  };

  const handleNewDocument = () => {
    setSelectedDoc(null);
    setEditedJson('{}');
    setIsEditMode(true);
    setIsDocDialogOpen(true);
  };

  const handleSaveDocument = async () => {
    if (!collectionName) return;
    try {
      const payload = JSON.parse(editedJson || '{}');
      setIsSaving(true);
      if (isEditMode && selectedDoc) {
        const { _id, ...rest } = payload;
        await updateDocument(collectionName, String(selectedDoc._id), rest);
        toast({ title: 'Document updated', description: 'Changes saved to MongoDB' });
      } else {
        await createDocument(collectionName, payload);
        toast({ title: 'Document created', description: 'New document inserted successfully' });
      }
      setIsDocDialogOpen(false);
      fetchDocuments();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save document';
      toast({ title: 'Save failed', description: message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDocument = async (doc: MongoDocument) => {
    if (!collectionName) return;
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await deleteDocument(collectionName, String(doc._id));
      toast({ title: 'Document deleted', description: `Document ${doc._id} removed` });
      fetchDocuments();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete document';
      toast({ title: 'Delete failed', description: message, variant: 'destructive' });
    }
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(editedJson);
    toast({ title: 'Copied', description: 'JSON copied to clipboard' });
  };

  const columns = documents.length > 0 ? Object.keys(documents[0]) : [];

  const renderJsonValue = (value: unknown): React.ReactNode => {
    if (value === null) return <span className="syntax-null">null</span>;
    if (typeof value === 'boolean') return <span className="syntax-boolean">{String(value)}</span>;
    if (typeof value === 'number') return <span className="syntax-number">{value}</span>;
    if (typeof value === 'string') return <span className="syntax-string">"{value}"</span>;
    if (Array.isArray(value)) {
      return (
        <span>
          [
          {value.map((item, i) => (
            <span key={i}>
              {i > 0 && ', '}
              {renderJsonValue(item)}
            </span>
          ))}
          ]
        </span>
      );
    }
    if (typeof value === 'object' && value !== null) {
      return (
        <span>
          {'{'}
          {Object.entries(value as Record<string, unknown>).map(([k, v], i) => (
            <span key={k}>
              {i > 0 && ', '}
              <span className="syntax-key">"{k}"</span>: {renderJsonValue(v)}
            </span>
          ))}
          {'}'}
        </span>
      );
    }
    return String(value);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/collections')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gradient-primary">{collectionName}</h1>
          <p className="text-muted-foreground mt-1">{totalCount.toLocaleString()} documents</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="glow" size="sm" onClick={handleNewDocument}>
              <Plus className="h-4 w-4 mr-2" />
              New Document
            </Button>
          )}
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Card className="glass border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Query Filter
          </CardTitle>
          <CardDescription>Use MongoDB filter syntax (JSON object)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-col md:flex-row">
            <div className="flex-1">
              <Textarea
                placeholder='{"field": "value"}'
                value={filterInput}
                onChange={(e) => setFilterInput(e.target.value)}
                className="font-mono text-sm bg-muted/50 min-h-[60px]"
              />
            </div>
            <div className="flex flex-col gap-2 min-w-[140px]">
              <Button onClick={handleApplyFilter}>
                <Search className="h-4 w-4 mr-2" />
                Apply
              </Button>
              <Button variant="outline" onClick={handleClearFilter}>
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'table' | 'json')}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="table" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <TableIcon className="h-4 w-4 mr-2" />
              Table
            </TabsTrigger>
            <TabsTrigger value="json" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Code className="h-4 w-4 mr-2" />
              JSON
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search current page"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-xs"
          />
          <span className="text-sm text-muted-foreground hidden md:inline">
            Page {currentPage} of {totalPages.toLocaleString()}
          </span>
          <Button variant="outline" size="icon-sm" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon-sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
        </div>
      </div>

      <Card className="glass border-border/50">
        <CardContent className="p-0">
          {viewMode === 'table' ? (
            <div className="relative overflow-x-auto">
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/70 z-10">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    {columns.map((col) => (
                      <TableHead key={col} className="font-semibold whitespace-nowrap">
                        {col}
                      </TableHead>
                    ))}
                    <TableHead className="font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments.map((doc) => (
                    <TableRow key={String(doc._id)} className="hover:bg-muted/30">
                      {columns.map((col) => (
                        <TableCell key={col} className="font-mono text-sm max-w-[200px] truncate">
                          {typeof doc[col] === 'object' ? JSON.stringify(doc[col]) : String(doc[col] ?? '')}
                        </TableCell>
                      ))}
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => handleViewDocument(doc)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {isAdmin && (
                            <>
                              <Button variant="ghost" size="icon-sm" onClick={() => handleEditDocument(doc)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDeleteDocument(doc)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredDocuments.length === 0 && !isLoading && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No documents matched your filters.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 space-y-2 max-h-[600px] overflow-y-auto">
              {filteredDocuments.map((doc) => (
                <div
                  key={String(doc._id)}
                  className="p-4 rounded-lg bg-muted/30 font-mono text-sm hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => handleViewDocument(doc)}
                >
                  <pre className="overflow-x-auto">{JSON.stringify(doc, null, 2)}</pre>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDocDialogOpen} onOpenChange={setIsDocDialogOpen}>
        <DialogContent className="max-w-2xl glass">
          <DialogHeader>
            <DialogTitle>{isEditMode ? (selectedDoc ? 'Edit Document' : 'New Document') : 'View Document'}</DialogTitle>
            <DialogDescription>
              {selectedDoc?._id ? `ID: ${String(selectedDoc._id)}` : 'JSON Editor'}
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Textarea
              value={editedJson}
              onChange={(e) => setEditedJson(e.target.value)}
              className="font-mono text-sm min-h-[400px] bg-muted/50"
              readOnly={!isEditMode}
            />
            <Button variant="ghost" size="icon-sm" className="absolute top-2 right-2" onClick={handleCopyJson}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            {isEditMode && isAdmin ? (
              <>
                <Button variant="outline" onClick={() => setIsDocDialogOpen(false)} disabled={isSaving}>
                  Cancel
                </Button>
                <Button variant="glow" onClick={handleSaveDocument} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Save Changes
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setIsDocDialogOpen(false)}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
