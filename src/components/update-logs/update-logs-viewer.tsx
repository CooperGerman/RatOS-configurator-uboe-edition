'use client';

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { twMerge } from 'tailwind-merge';
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

const LOG_LEVELS: Record<number, { name: string; color: string; bgColor: string; badgeColor: string }> = {
	10: {
		name: 'TRACE',
		color: 'text-zinc-600 dark:text-zinc-400',
		bgColor: 'bg-zinc-50 dark:bg-zinc-400/10',
		badgeColor: 'gray',
	},
	20: {
		name: 'DEBUG',
		color: 'text-cyan-700 dark:text-cyan-400',
		bgColor: 'bg-cyan-50 dark:bg-cyan-400/10',
		badgeColor: 'cyan',
	},
	30: {
		name: 'INFO',
		color: 'text-green-700 dark:text-green-400',
		bgColor: 'bg-green-50 dark:bg-green-400/10',
		badgeColor: 'green',
	},
	40: {
		name: 'WARN',
		color: 'text-yellow-800 dark:text-yellow-500',
		bgColor: 'bg-yellow-50 dark:bg-yellow-400/10',
		badgeColor: 'yellow',
	},
	50: {
		name: 'ERROR',
		color: 'text-red-700 dark:text-red-400',
		bgColor: 'bg-red-50 dark:bg-red-400/10',
		badgeColor: 'red',
	},
	60: {
		name: 'FATAL',
		color: 'text-purple-700 dark:text-purple-400',
		bgColor: 'bg-purple-50 dark:bg-purple-400/10',
		badgeColor: 'purple',
	},
};

const LogSummaryHeader: React.FC<{ summary: LogSummary; onRefresh: () => void; onClear: () => void }> = ({
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
		<header>
			{/* Heading */}
			<div className="bg-zinc-700/15 backdrop-blur-sm">
				<div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-x-8 gap-y-4 px-4 py-4 @screen-sm:flex-row @screen-sm:items-center @screen-sm:px-6 @screen-lg:px-8">
					<div>
						<div className="flex items-center gap-x-3">
							<div
								className={twMerge(
									'flex-none rounded-full bg-green-400/10 p-1 text-zinc-400',
									!summary.logFileExists && 'bg-zinc-400/10 text-zinc-400',
									summary.logFileExists && summary.lastUpdate && !summary.success && 'bg-red-400/10 text-red-400',
									summary.logFileExists && summary.lastUpdate && summary.success && 'bg-green-400/10 text-green-400',
									summary.logFileExists && !summary.lastUpdate && 'bg-blue-400/10 text-blue-400',
								)}
							>
								<FileText className="h-4 w-4" />
							</div>
							<h1 className="flex gap-x-3 text-base leading-7">
								<span className="font-semibold text-white">Update Logs</span>
								<span className="text-zinc-600">/</span>
								<span className="font-semibold text-white">
									{!summary.logFileExists
										? 'No File'
										: !summary.lastUpdate
											? 'Ready'
											: summary.success
												? 'Success'
												: 'Failed'}
								</span>
							</h1>
						</div>
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
				</div>
			</div>

			{/* Stats */}
			{summary.logFileExists && (
				<div className="border-t border-white/5 bg-zinc-700/10 backdrop-blur-sm">
					<div className="mx-auto grid max-w-7xl grid-cols-1 @screen-sm:grid-cols-2 @screen-lg:grid-cols-4">
						{/* Status */}
						<div className="border-white/5 px-4 py-6 @screen-sm:px-6 @screen-lg:px-8">
							<p className="text-sm font-medium leading-6 text-white">Status</p>
							<div className="mt-2 flex items-center gap-2">
								{!summary.lastUpdate ? (
									<Clock className="h-5 w-5 text-blue-400" />
								) : summary.success ? (
									<CheckCircle className="h-5 w-5 text-green-400" />
								) : (
									<AlertCircle className="h-5 w-5 text-red-400" />
								)}
								<span className="text-lg font-semibold text-white">
									{!summary.lastUpdate ? 'Ready' : summary.success ? 'Success' : 'Failed'}
								</span>
							</div>
							<div className="mt-1 text-sm text-zinc-400">
								{summary.totalEntries} entries • {formatBytes(summary.logFileSize)}
							</div>
						</div>

						{/* Log Levels */}
						<div className="border-white/5 px-4 py-6 @screen-sm:border-l @screen-sm:px-6 @screen-lg:px-8">
							<p className="text-sm font-medium leading-6 text-white">Log Levels</p>
							<div className="mt-2 flex flex-wrap gap-1">
								{summary.errorCount > 0 && (
									<Badge color="red" size="sm">
										Errors: {summary.errorCount}
									</Badge>
								)}
								{summary.fatalCount > 0 && (
									<Badge color="purple" size="sm">
										Fatal: {summary.fatalCount}
									</Badge>
								)}
								{summary.warnCount > 0 && (
									<Badge color="yellow" size="sm">
										Warnings: {summary.warnCount}
									</Badge>
								)}
								<Badge color="sky" size="sm">
									Info: {summary.infoCount}
								</Badge>
							</div>
						</div>

						{/* Timing */}
						<div className="border-white/5 px-4 py-6 @screen-sm:px-6 @screen-lg:px-8 lg:border-l">
							<p className="text-sm font-medium leading-6 text-white">Last Update</p>
							<div className="mt-2">
								{summary.lastUpdate ? (
									<div className="flex items-center gap-1">
										<Clock className="h-4 w-4 text-zinc-400" />
										<span className="text-sm text-white">{new Date(summary.lastUpdate).toLocaleString()}</span>
									</div>
								) : (
									<span className="text-sm text-zinc-400">No updates performed yet</span>
								)}
								{summary.duration && <div className="mt-1 text-sm text-zinc-400">Duration: {summary.duration}</div>}
							</div>
						</div>

						{/* Actions */}
						<div className="border-white/5 px-4 py-6 @screen-sm:border-l @screen-sm:px-6 @screen-lg:px-8">
							<p className="text-sm font-medium leading-6 text-white">Actions</p>
							<div className="mt-2">
								<Button
									variant="outline"
									size="sm"
									onClick={() => {
										window.open('/configure/api/update-logs/download', '_blank');
									}}
								>
									<Download className="mr-1 h-4 w-4" />
									Download
								</Button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* No file state */}
			{!summary.logFileExists && (
				<div className="border-t border-white/5 bg-zinc-700/10 backdrop-blur-sm">
					<div className="mx-auto max-w-7xl px-4 py-8 text-center @screen-sm:px-6 @screen-lg:px-8">
						<FileText className="mx-auto mb-4 h-12 w-12 text-blue-400 opacity-50" />
						<p className="text-white">System ready for updates</p>
						<p className="text-sm text-zinc-400">No update logs yet - run an update to generate logs</p>
					</div>
				</div>
			)}
		</header>
	);
};

const LogEntryComponent: React.FC<{ entry: LogEntry; showDetails: boolean }> = ({ entry, showDetails }) => {
	const level = LOG_LEVELS[entry.level] || {
		name: 'UNKNOWN',
		color: 'text-zinc-600 dark:text-zinc-400',
		bgColor: 'bg-zinc-50 dark:bg-zinc-400/10',
		badgeColor: 'gray',
	};
	const timestamp = new Date(entry.time).toLocaleString();

	return (
		<div className={`rounded-lg border p-3 ${level.bgColor} border-border`}>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0 flex-1">
					<div className="mb-1 flex items-center gap-2">
						<Badge color={level.badgeColor as any} size="sm">
							{level.name}
						</Badge>
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
		<main className="@container">
			<LogSummaryHeader summary={summary} onRefresh={handleRefresh} onClear={handleClear} />

			{summary.logFileExists && (
				<div className="border-t border-white/10 pt-11">
					<div className="mx-auto max-w-7xl">
						<div className="flex items-center justify-between px-4 @screen-sm:px-6 @screen-lg:px-8">
							<h2 className="text-base font-semibold leading-7 text-white">Log Entries</h2>
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
						</div>

						<div className="mt-6 px-4 @screen-sm:px-6 @screen-lg:px-8">
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
						</div>
					</div>
				</div>
			)}
		</main>
	);
};
