import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useMongoDb, type CollectionIndex } from '@/hooks/useMongoDb';
import {
  GitBranch,
  Play,
  Plus,
  Save,
  Trash2,
  Copy,
  BookOpen,
  ChevronRight,
  Loader2,
  Clock,
  Database,
  Layers,
  RefreshCw,
  BarChart3,
} from 'lucide-react';

const DEFAULT_COLLECTIONS = [
  'Patients', 'Doctors', 'Departments', 'Appointments', 'Treatments',
  'Medications', 'Bills', 'Nurses', 'Rooms', 'Admissions',
  'LabTests', 'Allergies', 'Insurance', 'Surgeries', 'Equipment',
  'Shifts', 'Staff', 'Feedback', 'Pharmacy', 'EmergencyContacts',
];

const EXAMPLE_PIPELINES = [
  {
    name: 'Count by Gender',
    collection: 'Patients',
    description: 'Group patients by gender and count',
    pipeline: [
      { $group: { _id: '$Gender', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ],
  },
  {
    name: 'Top 5 Doctors by Appointments',
    collection: 'Appointments',
    description: 'Find doctors with most appointments using $lookup',
    pipeline: [
      { $group: { _id: '$DoctorID', appointmentCount: { $sum: 1 } } },
      { $sort: { appointmentCount: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'Doctors',
          localField: '_id',
          foreignField: 'DoctorID',
          as: 'doctorInfo',
        },
      },
      { $unwind: '$doctorInfo' },
      {
        $project: {
          _id: 0,
          doctorName: '$doctorInfo.Name',
          specialty: '$doctorInfo.Specialty',
          appointmentCount: 1,
        },
      },
    ],
  },
  {
    name: 'Revenue by Payment Method',
    collection: 'Bills',
    description: 'Total billing amount grouped by payment method',
    pipeline: [
      {
        $group: {
          _id: '$PaymentMethod',
          totalRevenue: { $sum: '$Amount' },
          averageBill: { $avg: '$Amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ],
  },
  {
    name: 'Department Load Analysis',
    collection: 'Nurses',
    description: 'Count nurses per department with department lookup',
    pipeline: [
      { $group: { _id: '$DeptID', nurseCount: { $sum: 1 } } },
      {
        $lookup: {
          from: 'Departments',
          localField: '_id',
          foreignField: 'DeptID',
          as: 'department',
        },
      },
      { $unwind: '$department' },
      {
        $project: {
          _id: 0,
          departmentName: '$department.DeptName',
          location: '$department.Location',
          nurseCount: 1,
        },
      },
      { $sort: { nurseCount: -1 } },
    ],
  },
  {
    name: 'Lab Test Results Distribution',
    collection: 'LabTests',
    description: 'Distribution of normal vs abnormal results by test type',
    pipeline: [
      {
        $group: {
          _id: { testType: '$TestType', result: '$Result' },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.testType',
          results: {
            $push: { result: '$_id.result', count: '$count' },
          },
          total: { $sum: '$count' },
        },
      },
      { $sort: { total: -1 } },
    ],
  },
  {
    name: 'Average Treatment Cost',
    collection: 'Treatments',
    description: 'Average cost per treatment type',
    pipeline: [
      {
        $group: {
          _id: '$TreatmentType',
          avgCost: { $avg: '$Cost' },
          minCost: { $min: '$Cost' },
          maxCost: { $max: '$Cost' },
          count: { $sum: 1 },
        },
      },
      { $sort: { avgCost: -1 } },
    ],
  },
];

const STAGE_TEMPLATES = {
  $match: '{ "field": "value" }',
  $group: '{ "_id": "$fieldName", "count": { "$sum": 1 } }',
  $project: '{ "field1": 1, "field2": 1, "_id": 0 }',
  $sort: '{ "field": -1 }',
  $limit: '10',
  $skip: '0',
  $unwind: '"$arrayField"',
  $lookup: '{ "from": "otherCollection", "localField": "fieldA", "foreignField": "fieldB", "as": "joinedData" }',
  $addFields: '{ "newField": "$existingField" }',
  $count: '"totalCount"',
};

const DEFAULT_RAW_PIPELINE = '[\n  {\n    "$match": {}\n  }\n]';

const AGGREGATION_TIMEOUT_MS = 20000;

interface PipelineStage {
  id: string;
  type: string;
  content: string;
}

export default function Aggregations() {
  const [selectedCollection, setSelectedCollection] = useState('Patients');
  const [stages, setStages] = useState<PipelineStage[]>([
    { id: '1', type: '$match', content: '{}' },
  ]);
  const [mode, setMode] = useState<'builder' | 'raw'>('builder');
  const [rawPipeline, setRawPipeline] = useState(DEFAULT_RAW_PIPELINE);
  const [results, setResults] = useState<unknown[] | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [executionStats, setExecutionStats] = useState<Record<string, unknown> | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [pipelineName, setPipelineName] = useState('');
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const { runAggregation, runAggregationWithStats, getCollections, getIndexes, createIndex, dropIndex } = useMongoDb();
  const [collectionOptions, setCollectionOptions] = useState<string[]>(DEFAULT_COLLECTIONS);
  const [isLoadingCollections, setIsLoadingCollections] = useState(true);
  const [indexes, setIndexes] = useState<CollectionIndex[]>([]);
  const [isLoadingIndexes, setIsLoadingIndexes] = useState(false);
  const [isCreatingIndex, setIsCreatingIndex] = useState(false);
  const [droppingIndex, setDroppingIndex] = useState<string | null>(null);
  const [indexKeysInput, setIndexKeysInput] = useState(`{
  "field": 1
}`);
  const [indexOptionsInput, setIndexOptionsInput] = useState('');

  const runWithTimeout = useCallback(async <T,>(task: (signal: AbortSignal) => Promise<T>) => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), AGGREGATION_TIMEOUT_MS);
    try {
      return await task(controller.signal);
    } finally {
      clearTimeout(timer);
    }
  }, []);

  const isAbortError = (error: unknown) => {
    if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
      return error.name === 'AbortError';
    }
    return error instanceof Error && error.name === 'AbortError';
  };

  useEffect(() => {
    let mounted = true;
    const loadCollections = async () => {
      try {
        const data = await getCollections();
        if (mounted && data?.length) {
          setCollectionOptions(data.map((col) => col.name));
          if (!data.some((col) => col.name === selectedCollection)) {
            setSelectedCollection(data[0].name);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load collections';
        toast({ title: 'Collection fetch failed', description: message, variant: 'destructive' });
      } finally {
        if (mounted) {
          setIsLoadingCollections(false);
        }
      }
    };

    loadCollections();
    return () => {
      mounted = false;
    };
  }, [getCollections, selectedCollection, toast]);

  const refreshIndexes = useCallback(async () => {
    setIsLoadingIndexes(true);
    try {
      const data = await getIndexes(selectedCollection);
      setIndexes(Array.isArray(data) ? data : []);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[Aggregation] failed to load indexes', error);
      }
      setIndexes([]);
    } finally {
      setIsLoadingIndexes(false);
    }
  }, [getIndexes, selectedCollection]);

  useEffect(() => {
    refreshIndexes();
  }, [refreshIndexes]);

  const addStage = (type: string) => {
    const newStage: PipelineStage = {
      id: String(Date.now()),
      type,
      content: STAGE_TEMPLATES[type as keyof typeof STAGE_TEMPLATES] || '{}',
    };
    setStages([...stages, newStage]);
  };

  const removeStage = (id: string) => {
    setStages(stages.filter((s) => s.id !== id));
  };

  const updateStage = (id: string, content: string) => {
    setStages(stages.map((s) => (s.id === id ? { ...s, content } : s)));
  };

  const buildPipeline = () => {
    try {
      if (mode === 'raw') {
        const parsed = JSON.parse(rawPipeline);
        if (!Array.isArray(parsed)) {
          throw new Error('Pipeline must be an array');
        }
        if (import.meta.env.DEV) {
          console.debug('[Aggregation] pipeline (raw):', parsed);
        }
        return parsed as Record<string, unknown>[];
      }

      const pipeline = stages.map((stage) => {
        const parsed = JSON.parse(stage.content);
        const firstKey = Object.keys(parsed ?? {})[0];
        if (typeof firstKey === 'string' && firstKey.trim().startsWith('$')) {
          return parsed as Record<string, unknown>;
        }
        return {
          [stage.type]: parsed,
        } as Record<string, unknown>;
      });

      if (import.meta.env.DEV) {
        console.debug('[Aggregation] pipeline (builder):', pipeline);
      }

      return pipeline;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[Aggregation] invalid pipeline', error);
      }
      return null;
    }
  };

  const runPipeline = async () => {
    const pipeline = buildPipeline();
    if (!pipeline) {
      setExecutionStats(null);
      toast({
        title: 'Invalid Pipeline',
        description: 'Please check your JSON syntax in all stages',
        variant: 'destructive',
      });
      return;
    }

    setExecutionStats(null);
    setIsRunning(true);
    const startTime = performance.now();

    try {
      const response = await runWithTimeout((signal) =>
        runAggregation(selectedCollection, pipeline, undefined, { signal })
      );
      const rows = response.results || [];
      setResults(rows);
      setExecutionTime(performance.now() - startTime);
      toast({
        title: 'Pipeline executed',
        description: `Returned ${rows.length} results`,
      });
      if (rows.length > 500) {
        toast({
          title: 'Large result set',
          description: 'Showing only the first results from your pipeline.',
          variant: 'destructive',
        });
      }

      try {
        const statsResponse = await runWithTimeout((signal) =>
          runAggregationWithStats(selectedCollection, pipeline, undefined, { signal })
        );
        setExecutionStats(statsResponse?.stats ?? null);
      } catch (statsError) {
        setExecutionStats(null);
        if (isAbortError(statsError)) {
          toast({
            title: 'Explain timed out',
            description: 'Execution stats cancelled to keep the UI responsive.',
          });
        } else if (import.meta.env.DEV) {
          console.warn('[Aggregation] execution stats failed', statsError);
        }
      }
    } catch (error) {
      if (isAbortError(error)) {
        toast({
          title: 'Aggregation timed out',
          description: `Query exceeded ${AGGREGATION_TIMEOUT_MS / 1000}s. Narrow your $match or add indexes.`,
          variant: 'destructive',
        });
      } else {
        const message = error instanceof Error ? error.message : 'Aggregation failed';
        toast({ title: 'Aggregation error', description: message, variant: 'destructive' });
      }
      setExecutionStats(null);
      setResults(null);
      setExecutionTime(null);
    } finally {
      setIsRunning(false);
    }
  };

  const loadExample = (example: typeof EXAMPLE_PIPELINES[0]) => {
    setSelectedCollection(example.collection);
    setStages(
      example.pipeline.map((stage, index) => ({
        id: String(index),
        type: Object.keys(stage)[0],
        content: JSON.stringify(Object.values(stage)[0], null, 2),
      }))
    );
    setRawPipeline(JSON.stringify(example.pipeline, null, 2));
    setPipelineName(example.name);
    setResults(null);
    setExecutionStats(null);
  };

  const savePipeline = () => {
    if (!pipelineName) {
      toast({
        title: 'Name required',
        description: 'Please enter a name for the pipeline',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Pipeline saved',
      description: `"${pipelineName}" has been saved`,
    });
  };

  const copyPipeline = () => {
    if (mode === 'raw') {
      navigator.clipboard.writeText(rawPipeline);
      toast({ title: 'Copied', description: 'Pipeline copied to clipboard' });
      return;
    }

    const pipeline = buildPipeline();
    if (pipeline) {
      navigator.clipboard.writeText(JSON.stringify(pipeline, null, 2));
      toast({ title: 'Copied', description: 'Pipeline copied to clipboard' });
    }
  };

  const handleCreateIndex = async () => {
    let parsedKeys: Record<string, number> | null = null;
    let parsedOptions: Record<string, unknown> | undefined;

    try {
      parsedKeys = JSON.parse(indexKeysInput) as Record<string, number>;
    } catch (error) {
      toast({ title: 'Invalid index keys', description: 'Provide valid JSON for index keys.', variant: 'destructive' });
      return;
    }

    if (!parsedKeys || typeof parsedKeys !== 'object' || Array.isArray(parsedKeys)) {
      toast({ title: 'Invalid index keys', description: 'Keys must be a JSON object.', variant: 'destructive' });
      return;
    }

    if (indexOptionsInput.trim()) {
      try {
        parsedOptions = JSON.parse(indexOptionsInput);
      } catch (error) {
        toast({ title: 'Invalid options', description: 'Options must be valid JSON.', variant: 'destructive' });
        return;
      }
    }

    setIsCreatingIndex(true);
    try {
      const response = await createIndex(selectedCollection, parsedKeys, parsedOptions);
      toast({ title: 'Index created', description: `Created ${response.indexName}` });
      await refreshIndexes();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[Aggregation] index creation failed', error);
      }
    } finally {
      setIsCreatingIndex(false);
    }
  };

  const handleDropIndex = async (indexName: string) => {
    const allowDrop = window.confirm(`Drop index "${indexName}"?`);
    if (!allowDrop) return;

    setDroppingIndex(indexName);
    try {
      await dropIndex(selectedCollection, indexName);
      toast({ title: 'Index dropped', description: `${indexName} removed` });
      await refreshIndexes();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[Aggregation] index drop failed', error);
      }
    } finally {
      setDroppingIndex(null);
    }
  };

  const executionStatsSummary = useMemo(() => {
    if (!executionStats) return null;
    const stats = executionStats as Record<string, any>;
    const stages = Array.isArray(stats.stages) ? stats.stages : [];
    const cursorStage = stages.find((stage: Record<string, any>) => Boolean(stage?.$cursor)) as
      | { $cursor?: Record<string, any> }
      | undefined;
    const cursor = cursorStage?.$cursor;
    const cursorExec = cursor?.executionStats || stats.executionStats;
    const planner = cursor?.queryPlanner || stats.queryPlanner;

    return {
      executionTimeMillis: cursorExec?.executionTimeMillis ?? stats.executionTimeMillis,
      totalDocsExamined: cursorExec?.totalDocsExamined ?? stats.totalDocsExamined,
      totalKeysExamined: cursorExec?.totalKeysExamined ?? stats.totalKeysExamined,
      inputStage: cursorExec?.executionStages ?? stats.executionStages ?? cursorStage,
      winningPlan: planner?.winningPlan ?? stats.winningPlan,
    };
  }, [executionStats]);

  const formatStatNumber = (value: number | null | undefined) => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return '—';
    }
    return value.toLocaleString();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient-primary">Aggregation Builder</h1>
          <p className="text-muted-foreground mt-1">
            Build and run MongoDB aggregation pipelines
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline Builder */}
        <div className="lg:col-span-2 space-y-4">
          {/* Collection & Controls */}
          <Card className="glass border-border/50">
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-sm font-medium mb-2 block">Collection</label>
                  <Select value={selectedCollection} onValueChange={setSelectedCollection} disabled={isLoadingCollections}>
                    <SelectTrigger className="bg-muted/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {collectionOptions.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="text-sm font-medium mb-2 block">Pipeline Name</label>
                  <Input
                    placeholder="My Aggregation"
                    value={pipelineName}
                    onChange={(e) => setPipelineName(e.target.value)}
                    className="bg-muted/50"
                  />
                </div>
                <div className="flex gap-2 pt-6">
                  <Button variant="glow" onClick={runPipeline} disabled={isRunning}>
                    {isRunning ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Run
                  </Button>
                  {isAdmin && (
                    <Button variant="outline" onClick={savePipeline}>
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                  )}
                  <Button variant="outline" onClick={copyPipeline}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs value={mode} onValueChange={(value) => setMode(value as 'builder' | 'raw')} className="space-y-4">
            <TabsList className="w-full">
              <TabsTrigger value="builder" className="flex-1">
                Stage Builder
              </TabsTrigger>
              <TabsTrigger value="raw" className="flex-1">
                Raw JSON
              </TabsTrigger>
            </TabsList>
            <TabsContent value="builder" className="mt-0">
              <Card className="glass border-border/50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                    Pipeline Stages
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {stages.map((stage, index) => (
                    <div key={stage.id} className="flex gap-2">
                      <div className="flex flex-col items-center">
                        <Badge variant="outline" className="mb-2">
                          {index + 1}
                        </Badge>
                        {index < stages.length - 1 && <div className="flex-1 w-px bg-border" />}
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-accent text-accent-foreground">{stage.type}</Badge>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeStage(stage.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <Textarea
                          value={stage.content}
                          onChange={(e) => updateStage(stage.id, e.target.value)}
                          className="font-mono text-sm bg-muted/50 min-h-[80px]"
                          placeholder={STAGE_TEMPLATES[stage.type as keyof typeof STAGE_TEMPLATES]}
                        />
                      </div>
                    </div>
                  ))}

                  <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
                    <span className="text-sm text-muted-foreground mr-2">Add stage:</span>
                    {Object.keys(STAGE_TEMPLATES).map((stageType) => (
                      <Button
                        key={stageType}
                        variant="outline"
                        size="sm"
                        onClick={() => addStage(stageType)}
                        className="text-xs"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {stageType}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="raw" className="mt-0">
              <Card className="glass border-border/50">
                <CardHeader>
                  <CardTitle className="text-base">Raw Pipeline JSON</CardTitle>
                  <CardDescription>Paste a valid MongoDB aggregation array</CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={rawPipeline}
                    onChange={(e) => setRawPipeline(e.target.value)}
                    className="font-mono text-sm bg-muted/50 min-h-[320px]"
                    placeholder={DEFAULT_RAW_PIPELINE}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Results */}
          {results !== null && (
            <Card className="glass border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Results ({results.length})
                  </CardTitle>
                  {executionTime && (
                    <Badge variant="secondary">
                      <Clock className="h-3 w-3 mr-1" />
                      {executionTime.toFixed(0)}ms
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <pre className="p-4 rounded-lg bg-muted/50 overflow-x-auto font-mono text-sm max-h-[400px]">
                  {JSON.stringify(results, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {executionStats && (
            <Card className="glass border-border/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Execution Stats
                </CardTitle>
                <CardDescription>Explain output (executionStats)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {executionStatsSummary && (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-xs uppercase text-muted-foreground">Exec Time (ms)</p>
                      <p className="text-lg font-semibold">
                        {formatStatNumber(executionStatsSummary.executionTimeMillis)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-xs uppercase text-muted-foreground">Docs Examined</p>
                      <p className="text-lg font-semibold">
                        {formatStatNumber(executionStatsSummary.totalDocsExamined)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-xs uppercase text-muted-foreground">Keys Examined</p>
                      <p className="text-lg font-semibold">
                        {formatStatNumber(executionStatsSummary.totalKeysExamined)}
                      </p>
                    </div>
                  </div>
                )}

                {executionStatsSummary?.winningPlan && (
                  <div>
                    <p className="text-sm font-medium mb-1">Winning Plan</p>
                    <pre className="p-3 rounded-lg bg-muted/50 overflow-x-auto font-mono text-xs">
                      {JSON.stringify(executionStatsSummary.winningPlan, null, 2)}
                    </pre>
                  </div>
                )}

                {executionStatsSummary?.inputStage && (
                  <div>
                    <p className="text-sm font-medium mb-1">Input Stage</p>
                    <pre className="p-3 rounded-lg bg-muted/50 overflow-x-auto font-mono text-xs">
                      {JSON.stringify(executionStatsSummary.inputStage, null, 2)}
                    </pre>
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium mb-1">Raw Execution Stats</p>
                  <pre className="p-4 rounded-lg bg-muted/50 overflow-x-auto font-mono text-xs max-h-[320px]">
                    {JSON.stringify(executionStats, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Examples Sidebar */}
        <div className="space-y-4">
          <Card className="glass border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Index Manager
                  </CardTitle>
                  <CardDescription>Indexes for {selectedCollection}</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={refreshIndexes}
                  disabled={isLoadingIndexes}
                  title="Refresh indexes"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoadingIndexes ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {isLoadingIndexes && (
                  <p className="text-sm text-muted-foreground">Loading indexes...</p>
                )}
                {!isLoadingIndexes && indexes.length === 0 && (
                  <p className="text-sm text-muted-foreground">No indexes found for this collection.</p>
                )}
                {!isLoadingIndexes && indexes.map((index) => {
                  const isDefaultIndex = index.name === '_id_';
                  const isBusy = droppingIndex === index.name;
                  return (
                    <div
                      key={index.name || JSON.stringify(index.key)}
                      className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-semibold">{index.name}</p>
                          <pre className="text-xs bg-background/40 rounded-md p-2 mt-1 overflow-x-auto">
                            {JSON.stringify(index.key ?? {}, null, 2)}
                          </pre>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDropIndex(index.name)}
                          disabled={isDefaultIndex || isBusy}
                          title={isDefaultIndex ? 'Cannot drop the default _id index' : 'Drop index'}
                        >
                          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-wide">
                        {index.unique && <Badge variant="secondary">Unique</Badge>}
                        {index.sparse && <Badge variant="outline">Sparse</Badge>}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-3 pt-4 border-t border-border/60">
                <p className="text-sm font-medium">Create Index</p>
                <Textarea
                  value={indexKeysInput}
                  onChange={(e) => setIndexKeysInput(e.target.value)}
                  className="font-mono text-xs bg-muted/50 min-h-[80px]"
                  placeholder='{ "field": 1 }'
                />
                <Textarea
                  value={indexOptionsInput}
                  onChange={(e) => setIndexOptionsInput(e.target.value)}
                  className="font-mono text-xs bg-muted/50 min-h-[60px]"
                  placeholder='{ "unique": true, "name": "custom_idx" }'
                />
                <Button onClick={handleCreateIndex} disabled={isCreatingIndex} variant="glow" className="w-full">
                  {isCreatingIndex ? (
                    <span className="flex items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Creating...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center">
                      <Plus className="h-4 w-4 mr-2" /> Create Index
                    </span>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Example Pipelines
              </CardTitle>
              <CardDescription>
                Lab manual examples ready to run
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {EXAMPLE_PIPELINES.map((example) => (
                <button
                  key={example.name}
                  onClick={() => loadExample(example)}
                  className="w-full text-left p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{example.name}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {example.description}
                  </p>
                  <Badge variant="outline" className="mt-2 text-xs">
                    {example.collection}
                  </Badge>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
