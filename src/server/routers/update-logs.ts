import { z } from 'zod';
import { readFile, stat, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { publicProcedure, router } from '@/server/trpc';
import { getLogger } from '@/server/helpers/logger';
import { serverSchema } from '@/env/schema.mjs';

// Schema for parsing log entries
const LogEntrySchema = z.object({
	level: z.number(),
	time: z.string(),
	msg: z.string(),
	source: z.string().optional(),
	context: z.string().optional(),
	errorCode: z.string().optional(),
	pid: z.number().optional(),
	hostname: z.string().optional(),
});

const LogSummarySchema = z.object({
	totalEntries: z.number(),
	errorCount: z.number(),
	warnCount: z.number(),
	infoCount: z.number(),
	debugCount: z.number(),
	traceCount: z.number(),
	fatalCount: z.number(),
	lastUpdate: z.string().nullable(),
	duration: z.string().nullable(),
	success: z.boolean(),
	logFileSize: z.number(),
	logFileExists: z.boolean(),
});

const LogQuerySchema = z.object({
	lines: z.number().min(1).max(1000).default(50),
	level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
	context: z.string().optional(),
	showDetails: z.boolean().default(false),
});

type LogEntry = z.infer<typeof LogEntrySchema>;
type LogSummary = z.infer<typeof LogSummarySchema>;

// Log level mappings
const LOG_LEVEL_MAP: Record<string, number> = {
	trace: 10,
	debug: 20,
	info: 30,
	warn: 40,
	error: 50,
	fatal: 60,
};

// Parse log file and extract entries
export async function parseLogFile(logPath: string): Promise<LogEntry[]> {
	try {
		const content = await readFile(logPath, 'utf-8');
		const lines = content
			.trim()
			.split('\n')
			.filter((line) => line.trim());

		const entries: LogEntry[] = [];

		for (const line of lines) {
			try {
				const parsed = JSON.parse(line);
				const entry = LogEntrySchema.parse(parsed);
				entries.push(entry);
			} catch (e) {
				// Skip invalid JSON lines
				getLogger().debug(`Skipping invalid log line: ${line.substring(0, 100)}...`);
			}
		}

		return entries.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
	} catch (error) {
		if (error instanceof Error) {
			error.message = `Failed to read log file: ${error.message}`;
			throw error;
		}
		throw new Error(`Failed to read log file: ${error != null ? String(error) : 'Unknown error'}`);
	}
}

// Generate summary from log entries
export function generateSummary(entries: LogEntry[], logFileSize: number, logFileExists: boolean): LogSummary {
	const summary: LogSummary = {
		totalEntries: entries.length,
		errorCount: 0,
		warnCount: 0,
		infoCount: 0,
		debugCount: 0,
		traceCount: 0,
		fatalCount: 0,
		lastUpdate: null,
		duration: null,
		success: true,
		logFileSize,
		logFileExists,
	};

	let startTime: Date | null = null;
	let endTime: Date | null = null;

	for (const entry of entries) {
		// Count by level
		switch (entry.level) {
			case 10:
				summary.traceCount++;
				break;
			case 20:
				summary.debugCount++;
				break;
			case 30:
				summary.infoCount++;
				break;
			case 40:
				summary.warnCount++;
				break;
			case 50:
				summary.errorCount++;
				summary.success = false;
				break;
			case 60:
				summary.fatalCount++;
				summary.success = false;
				break;
		}

		// Track timing
		const entryTime = new Date(entry.time);
		if (!startTime || entryTime < startTime) {
			startTime = entryTime;
		}
		if (!endTime || entryTime > endTime) {
			endTime = entryTime;
		}

		// Find last update time
		if (entry.errorCode === 'SCRIPT_SUCCESS' || entry.errorCode === 'SCRIPT_ERROR') {
			summary.lastUpdate = entry.time;
		}
	}

	if (startTime && endTime) {
		const durationMs = endTime.getTime() - startTime.getTime();
		const seconds = Math.floor(durationMs / 1000);
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;

		if (minutes > 0) {
			summary.duration = `${minutes}m ${remainingSeconds}s`;
		} else {
			summary.duration = `${remainingSeconds}s`;
		}
	}

	return summary;
}

// Filter entries by severity level
export function filterBySeverity(entries: LogEntry[], minLevel: number): LogEntry[] {
	return entries.filter((entry) => entry.level >= minLevel);
}

// Filter entries by context
export function filterByContext(entries: LogEntry[], context: string): LogEntry[] {
	return entries.filter((entry) => entry.context === context);
}

// Get log file path
function getLogFilePath(): string {
	const environment = serverSchema.parse(process.env);
	return `${environment.RATOS_DATA_DIR}/logs/ratos-update.log`;
}

export const updateLogsRouter = router({
	summary: publicProcedure.query(async () => {
		const logPath = getLogFilePath();

		let logFileSize = 0;
		let logFileExists = false;
		let entries: LogEntry[] = [];

		try {
			if (existsSync(logPath)) {
				logFileExists = true;
				const stats = await stat(logPath);
				logFileSize = stats.size;
				entries = await parseLogFile(logPath);
			}
		} catch (error) {
			getLogger().error(`Failed to read update log file: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}

		return generateSummary(entries, logFileSize, logFileExists);
	}),

	entries: publicProcedure.input(LogQuerySchema).query(async ({ input }) => {
		const logPath = getLogFilePath();

		if (!existsSync(logPath)) {
			throw new Error(`Log file not found: ${logPath}`);
		}

		let entries = await parseLogFile(logPath);

		// Apply filters
		const minLevel = LOG_LEVEL_MAP[input.level];
		entries = filterBySeverity(entries, minLevel);

		if (input.context) {
			entries = filterByContext(entries, input.context);
		}

		// Limit number of entries (get most recent)
		if (entries.length > input.lines) {
			entries = entries.slice(-input.lines);
		}

		return {
			entries,
			totalCount: entries.length,
			filtered: true,
		};
	}),

	errors: publicProcedure.input(z.object({ showDetails: z.boolean().default(false) })).query(async ({ input }) => {
		const logPath = getLogFilePath();

		if (!existsSync(logPath)) {
			throw new Error(`Log file not found: ${logPath}`);
		}

		let entries = await parseLogFile(logPath);

		// Filter to only errors and warnings (level 40 and above)
		entries = filterBySeverity(entries, 40);

		return {
			entries,
			totalCount: entries.length,
			hasErrors: entries.length > 0,
		};
	}),

	contexts: publicProcedure.query(async () => {
		const logPath = getLogFilePath();

		if (!existsSync(logPath)) {
			return [];
		}

		const entries = await parseLogFile(logPath);
		const contexts = new Set<string>();

		entries.forEach((entry) => {
			if (entry.context) {
				contexts.add(entry.context);
			}
		});

		return Array.from(contexts).sort();
	}),

	clear: publicProcedure.mutation(async () => {
		const logPath = getLogFilePath();

		if (!existsSync(logPath)) {
			return { success: true, message: 'Log file does not exist' };
		}

		try {
			// Truncate the log file instead of deleting it
			await writeFile(logPath, '');
			getLogger().info('Update log file cleared');
			return { success: true, message: 'Log file cleared successfully' };
		} catch (error) {
			const errorMessage = `Failed to clear log file: ${error instanceof Error ? error.message : 'Unknown error'}`;
			getLogger().error(errorMessage);
			throw new Error(errorMessage);
		}
	}),

	download: publicProcedure.query(async () => {
		const logPath = getLogFilePath();

		if (!existsSync(logPath)) {
			throw new Error(`Log file not found: ${logPath}`);
		}

		try {
			const content = await readFile(logPath, 'utf-8');
			const stats = await stat(logPath);

			return {
				content,
				size: stats.size,
				lastModified: stats.mtime.toISOString(),
			};
		} catch (error) {
			throw new Error(`Failed to read log file: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}),
});
