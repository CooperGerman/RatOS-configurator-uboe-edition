'use client';

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { Card } from '@/components/common/card';
import { Button } from '@/components/common/button';
import { Spinner } from '@/components/common/spinner';
import { ErrorMessage } from '@/components/common/error-message';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
	AlertCircle, 
	CheckCircle, 
	Clock, 
	Download, 
	RefreshCw, 
	Trash2,
	FileText,
	Filter,
	Eye,
	EyeOff
} from 'lucide-react';
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
	10: { name: 'TRACE', color: 'text-gray-500', bgColor: 'bg-gray-100' },
	20: { name: 'DEBUG', color: 'text-cyan-600', bgColor: 'bg-cyan-50' },
	30: { name: 'INFO', color: 'text-green-600', bgColor: 'bg-green-50' },
	40: { name: 'WARN', color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
	50: { name: 'ERROR', color: 'text-red-600', bgColor: 'bg-red-50' },
	60: { name: 'FATAL', color: 'text-purple-600', bgColor: 'bg-purple-50' },
};

const LogSummaryCard: React.FC<{ summary: LogSummary; onRefresh: () => void; onClear: () => void }> = ({ 
	summary, 
	onRefresh, 
	onClear 
}) => {
	const clearMutation = trpc['update-logs'].clear.useMutation({
		onSuccess: () => {
			onClear();
		},
	});

	return (
		<Card className="p-6">
			<div className="flex items-center justify-between mb-4">
				<h2 className="text-xl font-semibold flex items-center gap-2">
					<FileText className="h-5 w-5" />
					Update Log Summary
				</h2>
				<div className="flex gap-2">
					<Button variant="outline" size="sm" onClick={onRefresh}>
						<RefreshCw className="h-4 w-4 mr-1" />
						Refresh
					</Button>
					<Button 
						variant="outline" 
						size="sm" 
						onClick={() => clearMutation.mutate()}
						disabled={clearMutation.isLoading || !summary.logFileExists}
					>
						<Trash2 className="h-4 w-4 mr-1" />
						Clear
					</Button>
				</div>
			</div>

			{!summary.logFileExists ? (
				<div className="text-center py-8 text-gray-500">
					<FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
					<p>No update log file found</p>
					<p className="text-sm">Run an update to generate logs</p>
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							{summary.success ? (
								<CheckCircle className="h-5 w-5 text-green-500" />
							) : (
								<AlertCircle className="h-5 w-5 text-red-500" />
							)}
							<span className="font-medium">
								{summary.success ? 'Success' : 'Failed'}
							</span>
						</div>
						<div className="text-sm text-gray-600">
							<div>Total Entries: {summary.totalEntries}</div>
							<div>File Size: {formatBytes(summary.logFileSize)}</div>
							{summary.duration && <div>Duration: {summary.duration}</div>}
						</div>
					</div>

					<div className="space-y-2">
						<div className="font-medium text-gray-700">Log Levels</div>
						<div className="space-y-1 text-sm">
							{summary.errorCount > 0 && (
								<div className="flex justify-between">
									<span className="text-red-600">Errors:</span>
									<Badge variant="destructive">{summary.errorCount}</Badge>
								</div>
							)}
							{summary.fatalCount > 0 && (
								<div className="flex justify-between">
									<span className="text-purple-600">Fatal:</span>
									<Badge className="bg-purple-100 text-purple-800">{summary.fatalCount}</Badge>
								</div>
							)}
							{summary.warnCount > 0 && (
								<div className="flex justify-between">
									<span className="text-yellow-600">Warnings:</span>
									<Badge className="bg-yellow-100 text-yellow-800">{summary.warnCount}</Badge>
								</div>
							)}
							<div className="flex justify-between">
								<span className="text-green-600">Info:</span>
								<Badge className="bg-green-100 text-green-800">{summary.infoCount}</Badge>
							</div>
						</div>
					</div>

					<div className="space-y-2">
						<div className="font-medium text-gray-700">Timing</div>
						<div className="text-sm text-gray-600">
							{summary.lastUpdate ? (
								<div className="flex items-center gap-1">
									<Clock className="h-4 w-4" />
									<span>
										{new Date(summary.lastUpdate).toLocaleString()}
									</span>
								</div>
							) : (
								<span>No recent updates</span>
							)}
						</div>
					</div>

					<div className="space-y-2">
						<div className="font-medium text-gray-700">Actions</div>
						<div className="space-y-1">
							<Button 
								variant="outline" 
								size="sm" 
								className="w-full"
								onClick={() => {
									// Trigger download
									window.open('/configure/api/update-logs/download', '_blank');
								}}
							>
								<Download className="h-4 w-4 mr-1" />
								Download
							</Button>
						</div>
					</div>
				</div>
			)}
		</Card>
	);
};

const LogEntryComponent: React.FC<{ entry: LogEntry; showDetails: boolean }> = ({ entry, showDetails }) => {
	const level = LOG_LEVELS[entry.level] || { name: 'UNKNOWN', color: 'text-gray-600', bgColor: 'bg-gray-50' };
	const timestamp = new Date(entry.time).toLocaleString();

	return (
		<div className={`p-3 rounded-lg border ${level.bgColor} border-gray-200`}>
			<div className="flex items-start justify-between gap-2">
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1">
						<Badge className={`${level.color} bg-transparent border-current text-xs`}>
							{level.name}
						</Badge>
						<span className="text-xs text-gray-500">{timestamp}</span>
						{entry.context && showDetails && (
							<Badge variant="outline" className="text-xs">
								{entry.context}
							</Badge>
						)}
					</div>
					<p className={`text-sm ${level.color} break-words`}>
						{entry.msg}
					</p>
					{showDetails && (
						<div className="mt-2 text-xs text-gray-500 space-y-1">
							{entry.errorCode && (
								<div>Error Code: <code className="bg-gray-100 px-1 rounded">{entry.errorCode}</code></div>
							)}
							{entry.pid && (
								<div>PID: {entry.pid}</div>
							)}
							{entry.hostname && (
								<div>Host: {entry.hostname}</div>
							)}
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

	const entriesQuery = trpc['update-logs'].entries.useQuery({
		lines: maxLines,
		level: logLevel as any,
		context: selectedContext || undefined,
		showDetails,
	}, {
		enabled: !showOnlyErrors,
		retry: 3,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
		staleTime: 10000, // 10 seconds
	});

	const errorsQuery = trpc['update-logs'].errors.useQuery({
		showDetails,
	}, {
		enabled: showOnlyErrors,
		retry: 3,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
		staleTime: 10000, // 10 seconds
	});

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
		return (
			<ErrorMessage title="Failed to load update logs">
				{summaryQuery.error.message}
			</ErrorMessage>
		);
	}

	const summary = summaryQuery.data;
	const contexts = contextsQuery.data || [];
	const currentQuery = showOnlyErrors ? errorsQuery : entriesQuery;
	const entries = currentQuery.data?.entries || [];

	return (
		<div className="space-y-6">
			<LogSummaryCard 
				summary={summary} 
				onRefresh={handleRefresh} 
				onClear={handleClear} 
			/>

			{summary.logFileExists && (
				<Card className="p-6">
					<div className="flex items-center justify-between mb-4">
						<h3 className="text-lg font-semibold">Log Entries</h3>
						<div className="flex items-center gap-2">
							<Button
								variant={showOnlyErrors ? "default" : "outline"}
								size="sm"
								onClick={() => setShowOnlyErrors(!showOnlyErrors)}
							>
								{showOnlyErrors ? (
									<>
										<Eye className="h-4 w-4 mr-1" />
										Show All
									</>
								) : (
									<>
										<AlertCircle className="h-4 w-4 mr-1" />
										Errors Only
									</>
								)}
							</Button>
						</div>
					</div>

					{!showOnlyErrors && (
						<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
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
								<Select value={selectedContext} onValueChange={setSelectedContext}>
									<SelectTrigger>
										<SelectValue placeholder="All contexts" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="">All contexts</SelectItem>
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
									<Switch
										id="show-details"
										checked={showDetails}
										onCheckedChange={setShowDetails}
									/>
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
							<ErrorMessage title="Failed to load log entries">
								{currentQuery.error.message}
							</ErrorMessage>
						) : entries.length === 0 ? (
							<div className="text-center py-8 text-gray-500">
								<FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
								<p>No log entries found</p>
								{showOnlyErrors && <p className="text-sm">No errors or warnings in the logs</p>}
							</div>
						) : (
							<>
								<div className="text-sm text-gray-600 mb-2">
									Showing {entries.length} entries
									{showOnlyErrors && " (errors and warnings only)"}
								</div>
								{entries.map((entry, index) => (
									<LogEntryComponent
										key={`${entry.time}-${index}`}
										entry={entry}
										showDetails={showDetails}
									/>
								))}
							</>
						)}
					</div>
				</Card>
			)}
		</div>
	);
};
