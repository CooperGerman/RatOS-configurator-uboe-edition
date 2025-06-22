'use client';

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { Card } from '@/components/common/card';
import { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/common/button';
import { Spinner } from '@/components/common/spinner';
import { ErrorMessage } from '@/components/common/error-message';
import { Badge } from '@/components/common/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle, Clock, Download, RefreshCw, Trash2, FileText, Eye, EyeOff } from 'lucide-react';
import { formatBytes } from '@/helpers/util';

interface LogEntry {
	level: number;
	time: string;
	msg: string;
	source?: string;
	context?: string;
	errorCode?: string;
	pid?: number;
	hostname?: string;
}

interface LogSummary {
	totalEntries: number;
	errorCount: number;
	warnCount: number;
	infoCount: number;
	debugCount: number;
	traceCount: number;
	fatalCount: number;
	lastUpdate: string | null;
	duration: string | null;
	success: boolean;
	logFileSize: number;
	logFileExists: boolean;
}

const LOG_LEVELS: Record<number, { name: string; color: string; bgColor: string }> = {
	10: { name: 'TRACE', color: 'text-zinc-600 dark:text-zinc-400', bgColor: 'bg-zinc-50 dark:bg-zinc-400/10' },
	20: { name: 'DEBUG', color: 'text-cyan-700 dark:text-cyan-400', bgColor: 'bg-cyan-50 dark:bg-cyan-400/10' },
	30: { name: 'INFO', color: 'text-green-700 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-400/10' },
	40: { name: 'WARN', color: 'text-yellow-800 dark:text-yellow-500', bgColor: 'bg-yellow-50 dark:bg-yellow-400/10' },
	50: { name: 'ERROR', color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-400/10' },
	60: { name: 'FATAL', color: 'text-purple-700 dark:text-purple-400', bgColor: 'bg-purple-50 dark:bg-purple-400/10' },
};

const LogSummaryCard: React.FC<{ summary: LogSummary; onRefresh: () => void; onClear: () => void }> = ({
	summary,
	onRefresh,
	onClear,
}) => {
	const clearMutation = trpc['update-logs'].clear.useMutation({
		onSuccess: () => {
			onClear();
		},
	});

	const generateMockDataMutation = trpc['update-logs'].generateMockData.useMutation({
		onSuccess: () => {
			onRefresh();
		},
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<FileText className="h-5 w-5" />
						Update Log Summary
					</div>
					<div className="flex gap-2">
						<Button variant="outline" size="default" onClick={onRefresh}>
							<RefreshCw className="mr-1 h-4 w-4" />
							Refresh
						</Button>
						{process.env.NODE_ENV === 'development' && (
							<Button
								variant="outline"
								size="default"
								onClick={() => generateMockDataMutation.mutate()}
								disabled={generateMockDataMutation.isLoading}
							>
								<FileText className="mr-1 h-4 w-4" />
								Generate Test Data
							</Button>
						)}
						<Button
							variant="outline"
							size="default"
							onClick={() => clearMutation.mutate()}
							disabled={clearMutation.isLoading || !summary.logFileExists}
						>
							<Trash2 className="mr-1 h-4 w-4" />
							Clear
						</Button>
					</div>
				</CardTitle>
			</CardHeader>
			<CardContent>
				{!summary.logFileExists ? (
					<div className="py-8 text-center text-muted-foreground">
						<FileText className="mx-auto mb-2 h-12 w-12 opacity-50" />
						<p>No update log file found</p>
						<p className="text-sm">Run an update to generate logs</p>
					</div>
				) : (
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
						<div className="space-y-2">
							<div className="flex items-center gap-2">
								{summary.success ? (
									<CheckCircle className="h-5 w-5 text-green-500" />
								) : (
									<AlertCircle className="h-5 w-5 text-red-500" />
								)}
								<span className="font-medium">{summary.success ? 'Success' : 'Failed'}</span>
							</div>
							<div className="text-sm text-muted-foreground">
								<div>Total Entries: {summary.totalEntries}</div>
								<div>File Size: {formatBytes(summary.logFileSize)}</div>
								{summary.duration && <div>Duration: {summary.duration}</div>}
							</div>
						</div>

						<div className="space-y-2">
							<div className="font-medium text-foreground">Log Levels</div>
							<div className="flex flex-wrap gap-2">
								{summary.errorCount > 0 && <Badge color="red">Errors: {summary.errorCount}</Badge>}
								{summary.fatalCount > 0 && <Badge color="purple">Fatal: {summary.fatalCount}</Badge>}
								{summary.warnCount > 0 && <Badge color="yellow">Warnings: {summary.warnCount}</Badge>}
								<Badge color="sky">Info: {summary.infoCount}</Badge>
							</div>
						</div>

						<div className="space-y-2">
							<div className="font-medium text-foreground">Timing</div>
							<div className="text-sm text-muted-foreground">
								{summary.lastUpdate ? (
									<div className="flex items-center gap-1">
										<Clock className="h-4 w-4" />
										<span>{new Date(summary.lastUpdate).toLocaleString()}</span>
									</div>
								) : (
									<span>No recent updates</span>
								)}
							</div>
						</div>

						<div className="space-y-2">
							<div className="font-medium text-foreground">Actions</div>
							<div className="space-y-1">
								<Button
									variant="outline"
									size="default"
									className="w-full"
									onClick={() => {
										// Trigger download
										window.open('/configure/api/update-logs/download', '_blank');
									}}
								>
									<Download className="mr-1 h-4 w-4" />
									Download
								</Button>
							</div>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
};

const LogEntryComponent: React.FC<{ entry: LogEntry; showDetails: boolean }> = ({ entry, showDetails }) => {
	const level = LOG_LEVELS[entry.level] || {
		name: 'UNKNOWN',
		color: 'text-zinc-600 dark:text-zinc-400',
		bgColor: 'bg-zinc-50 dark:bg-zinc-400/10',
	};
	const timestamp = new Date(entry.time).toLocaleString();

	return (
		<div className={`rounded-lg border p-3 ${level.bgColor} border-border`}>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0 flex-1">
					<div className="mb-1 flex items-center gap-2">
						<Badge className={`${level.color} border-current bg-transparent text-xs`}>{level.name}</Badge>
						<span className="text-xs text-muted-foreground">{timestamp}</span>
						{entry.context && showDetails && (
							<Badge color="gray" className="text-xs">
								{entry.context}
							</Badge>
						)}
					</div>
					<p className={`text-sm ${level.color} break-words`}>{entry.msg}</p>
					{showDetails && (
						<div className="mt-2 space-y-1 text-xs text-muted-foreground">
							{entry.errorCode && (
								<div>
									Error Code: <code className="rounded bg-muted px-1 text-muted-foreground">{entry.errorCode}</code>
								</div>
							)}
							{entry.pid && <div>PID: {entry.pid}</div>}
							{entry.hostname && <div>Host: {entry.hostname}</div>}
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export const UpdateLogsViewer: React.FC = () => {
	const [logLevel, setLogLevel] = useState<string>('info');
	const [maxLines, setMaxLines] = useState<number>(50);
	const [selectedContext, setSelectedContext] = useState<string>('');
	const [showDetails, setShowDetails] = useState<boolean>(false);
	const [showOnlyErrors, setShowOnlyErrors] = useState<boolean>(false);

	const summaryQuery = trpc['update-logs'].summary.useQuery(undefined, {
		retry: 3,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
		staleTime: 30000, // 30 seconds
	});

	const contextsQuery = trpc['update-logs'].contexts.useQuery(undefined, {
		retry: 2,
		staleTime: 60000, // 1 minute
	});

	const entriesQuery = trpc['update-logs'].entries.useQuery(
		{
			lines: maxLines,
			level: logLevel as any,
			context: selectedContext || undefined,
			showDetails,
		},
		{
			enabled: !showOnlyErrors,
			retry: 3,
			retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
			staleTime: 10000, // 10 seconds
		},
	);

	const errorsQuery = trpc['update-logs'].errors.useQuery(
		{
			showDetails,
		},
		{
			enabled: showOnlyErrors,
			retry: 3,
			retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
			staleTime: 10000, // 10 seconds
		},
	);

	const handleRefresh = () => {
		summaryQuery.refetch();
		entriesQuery.refetch();
		errorsQuery.refetch();
		contextsQuery.refetch();
	};

	const handleClear = () => {
		handleRefresh();
	};

	if (summaryQuery.isLoading) {
		return (
			<div className="flex items-center justify-center p-8">
				<Spinner />
			</div>
		);
	}

	if (summaryQuery.error) {
		return <ErrorMessage title="Failed to load update logs">{summaryQuery.error.message}</ErrorMessage>;
	}

	const summary = summaryQuery.data;
	const contexts = contextsQuery.data || [];
	const currentQuery = showOnlyErrors ? errorsQuery : entriesQuery;
	const entries = currentQuery.data?.entries || [];

	return (
		<div className="space-y-6">
			<LogSummaryCard summary={summary} onRefresh={handleRefresh} onClear={handleClear} />

			{summary.logFileExists && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center justify-between">
							<span>Log Entries</span>
							<div className="flex items-center gap-2">
								<Button
									variant={showOnlyErrors ? 'primary' : 'outline'}
									size="default"
									onClick={() => setShowOnlyErrors(!showOnlyErrors)}
								>
									{showOnlyErrors ? (
										<>
											<Eye className="mr-1 h-4 w-4" />
											Show All
										</>
									) : (
										<>
											<AlertCircle className="mr-1 h-4 w-4" />
											Errors Only
										</>
									)}
								</Button>
							</div>
						</CardTitle>
					</CardHeader>
					<CardContent>
						{!showOnlyErrors && (
							<div className="mb-4 grid grid-cols-1 gap-4 rounded-lg border border-border bg-muted/20 p-4 md:grid-cols-4">
								<div className="space-y-2">
									<Label htmlFor="log-level">Log Level</Label>
									<Select value={logLevel} onValueChange={setLogLevel}>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="trace">Trace</SelectItem>
											<SelectItem value="debug">Debug</SelectItem>
											<SelectItem value="info">Info</SelectItem>
											<SelectItem value="warn">Warning</SelectItem>
											<SelectItem value="error">Error</SelectItem>
											<SelectItem value="fatal">Fatal</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-2">
									<Label htmlFor="max-lines">Max Lines</Label>
									<Input
										id="max-lines"
										type="number"
										min="10"
										max="1000"
										value={maxLines}
										onChange={(e) => setMaxLines(parseInt(e.target.value) || 50)}
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="context">Context Filter</Label>
									<Select
										value={selectedContext || 'all'}
										onValueChange={(value) => setSelectedContext(value === 'all' ? '' : value)}
									>
										<SelectTrigger>
											<SelectValue placeholder="All contexts" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">All contexts</SelectItem>
											{contexts.map((context) => (
												<SelectItem key={context} value={context}>
													{context}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-2">
									<Label htmlFor="show-details">Show Details</Label>
									<div className="flex items-center space-x-2">
										<Switch id="show-details" checked={showDetails} onCheckedChange={setShowDetails} />
										<Label htmlFor="show-details" className="text-sm">
											{showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
										</Label>
									</div>
								</div>
							</div>
						)}

						<div className="space-y-3">
							{currentQuery.isLoading ? (
								<div className="flex items-center justify-center p-8">
									<Spinner />
								</div>
							) : currentQuery.error ? (
								<ErrorMessage title="Failed to load log entries">{currentQuery.error.message}</ErrorMessage>
							) : entries.length === 0 ? (
								<div className="py-8 text-center text-muted-foreground">
									<FileText className="mx-auto mb-2 h-12 w-12 opacity-50" />
									<p>No log entries found</p>
									{showOnlyErrors && <p className="text-sm">No errors or warnings in the logs</p>}
								</div>
							) : (
								<>
									<div className="mb-2 text-sm text-muted-foreground">
										Showing {entries.length} entries
										{showOnlyErrors && ' (errors and warnings only)'}
									</div>
									{entries.map((entry, index) => (
										<LogEntryComponent key={`${entry.time}-${index}`} entry={entry} showDetails={showDetails} />
									))}
								</>
							)}
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
};
