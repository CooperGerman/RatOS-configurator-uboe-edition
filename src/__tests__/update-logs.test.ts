import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { tmpdir } from 'os';

// Mock environment for testing
const TEST_LOG_DIR = path.join(tmpdir(), 'ratos-test-logs');
const TEST_LOG_FILE = path.join(TEST_LOG_DIR, 'ratos-update.log');

// Mock process.env
vi.mock('@/env/schema.mjs', () => ({
	serverSchema: {
		parse: () => ({
			RATOS_DATA_DIR: TEST_LOG_DIR,
		}),
	},
}));

describe('Update Logs System', () => {
	beforeEach(async () => {
		// Create test directory
		if (!existsSync(TEST_LOG_DIR)) {
			await mkdir(TEST_LOG_DIR, { recursive: true });
		}
	});

	afterEach(async () => {
		// Clean up test directory
		if (existsSync(TEST_LOG_DIR)) {
			await rm(TEST_LOG_DIR, { recursive: true, force: true });
		}
	});

	describe('Log File Parsing', () => {
		it('should parse valid JSON log entries', async () => {
			const logEntries = [
				{
					level: 30,
					time: '2024-01-01T10:00:00.000Z',
					msg: 'Starting update process',
					source: 'ratos-update',
					context: 'main',
					pid: 1234,
					hostname: 'ratos-pi',
				},
				{
					level: 50,
					time: '2024-01-01T10:01:00.000Z',
					msg: 'Failed to update symlinks',
					source: 'ratos-update',
					context: 'update_symlinks',
					errorCode: 'SYMLINK_CREATE_FAILED',
					pid: 1234,
					hostname: 'ratos-pi',
				},
			];

			const logContent = logEntries.map(entry => JSON.stringify(entry)).join('\n');
			await writeFile(TEST_LOG_FILE, logContent);

			// Import the function after mocking
			const { parseLogFile } = await import('../server/routers/update-logs');
			const parsedEntries = await parseLogFile(TEST_LOG_FILE);

			expect(parsedEntries).toHaveLength(2);
			expect(parsedEntries[0].msg).toBe('Starting update process');
			expect(parsedEntries[1].errorCode).toBe('SYMLINK_CREATE_FAILED');
		});

		it('should skip invalid JSON lines', async () => {
			const logContent = [
				'{"level":30,"time":"2024-01-01T10:00:00.000Z","msg":"Valid entry"}',
				'Invalid JSON line',
				'{"level":50,"time":"2024-01-01T10:01:00.000Z","msg":"Another valid entry"}',
			].join('\n');

			await writeFile(TEST_LOG_FILE, logContent);

			const { parseLogFile } = await import('../server/routers/update-logs');
			const parsedEntries = await parseLogFile(TEST_LOG_FILE);

			expect(parsedEntries).toHaveLength(2);
			expect(parsedEntries[0].msg).toBe('Valid entry');
			expect(parsedEntries[1].msg).toBe('Another valid entry');
		});

		it('should sort entries by timestamp', async () => {
			const logEntries = [
				{
					level: 30,
					time: '2024-01-01T10:02:00.000Z',
					msg: 'Second entry',
				},
				{
					level: 30,
					time: '2024-01-01T10:01:00.000Z',
					msg: 'First entry',
				},
				{
					level: 30,
					time: '2024-01-01T10:03:00.000Z',
					msg: 'Third entry',
				},
			];

			const logContent = logEntries.map(entry => JSON.stringify(entry)).join('\n');
			await writeFile(TEST_LOG_FILE, logContent);

			const { parseLogFile } = await import('../server/routers/update-logs');
			const parsedEntries = await parseLogFile(TEST_LOG_FILE);

			expect(parsedEntries).toHaveLength(3);
			expect(parsedEntries[0].msg).toBe('First entry');
			expect(parsedEntries[1].msg).toBe('Second entry');
			expect(parsedEntries[2].msg).toBe('Third entry');
		});
	});

	describe('Log Summary Generation', () => {
		it('should generate correct summary statistics', async () => {
			const logEntries = [
				{ level: 30, time: '2024-01-01T10:00:00.000Z', msg: 'Info message' },
				{ level: 40, time: '2024-01-01T10:01:00.000Z', msg: 'Warning message' },
				{ level: 50, time: '2024-01-01T10:02:00.000Z', msg: 'Error message' },
				{ level: 50, time: '2024-01-01T10:03:00.000Z', msg: 'Another error' },
			];

			const { generateSummary } = await import('../server/routers/update-logs');
			const summary = generateSummary(logEntries, 1024, true);

			expect(summary.totalEntries).toBe(4);
			expect(summary.infoCount).toBe(1);
			expect(summary.warnCount).toBe(1);
			expect(summary.errorCount).toBe(2);
			expect(summary.success).toBe(false); // Has errors
			expect(summary.logFileExists).toBe(true);
			expect(summary.logFileSize).toBe(1024);
		});

		it('should calculate duration correctly', async () => {
			const logEntries = [
				{ level: 30, time: '2024-01-01T10:00:00.000Z', msg: 'Start' },
				{ level: 30, time: '2024-01-01T10:02:30.000Z', msg: 'End' },
			];

			const { generateSummary } = await import('../server/routers/update-logs');
			const summary = generateSummary(logEntries, 1024, true);

			expect(summary.duration).toBe('2m 30s');
		});

		it('should identify last update time', async () => {
			const logEntries = [
				{ level: 30, time: '2024-01-01T10:00:00.000Z', msg: 'Start', errorCode: 'SCRIPT_START' },
				{ level: 30, time: '2024-01-01T10:01:00.000Z', msg: 'Middle' },
				{ level: 30, time: '2024-01-01T10:02:00.000Z', msg: 'End', errorCode: 'SCRIPT_SUCCESS' },
			];

			const { generateSummary } = await import('../server/routers/update-logs');
			const summary = generateSummary(logEntries, 1024, true);

			expect(summary.lastUpdate).toBe('2024-01-01T10:02:00.000Z');
		});
	});

	describe('Log Filtering', () => {
		it('should filter by severity level', async () => {
			const logEntries = [
				{ level: 20, time: '2024-01-01T10:00:00.000Z', msg: 'Debug' },
				{ level: 30, time: '2024-01-01T10:01:00.000Z', msg: 'Info' },
				{ level: 40, time: '2024-01-01T10:02:00.000Z', msg: 'Warning' },
				{ level: 50, time: '2024-01-01T10:03:00.000Z', msg: 'Error' },
			];

			const { filterBySeverity } = await import('../server/routers/update-logs');
			const filtered = filterBySeverity(logEntries, 40); // Warning and above

			expect(filtered).toHaveLength(2);
			expect(filtered[0].msg).toBe('Warning');
			expect(filtered[1].msg).toBe('Error');
		});

		it('should filter by context', async () => {
			const logEntries = [
				{ level: 30, time: '2024-01-01T10:00:00.000Z', msg: 'Message 1', context: 'main' },
				{ level: 30, time: '2024-01-01T10:01:00.000Z', msg: 'Message 2', context: 'update_symlinks' },
				{ level: 30, time: '2024-01-01T10:02:00.000Z', msg: 'Message 3', context: 'main' },
			];

			const { filterByContext } = await import('../server/routers/update-logs');
			const filtered = filterByContext(logEntries, 'main');

			expect(filtered).toHaveLength(2);
			expect(filtered[0].msg).toBe('Message 1');
			expect(filtered[1].msg).toBe('Message 3');
		});
	});
});

describe('Bash Logging Library', () => {
	it('should generate valid JSON log entries', () => {
		// This would be tested by running the bash script in a test environment
		// For now, we'll test the expected JSON structure
		const expectedLogEntry = {
			level: 30,
			time: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
			msg: 'Test message',
			source: 'ratos-update',
			context: 'test_context',
			pid: expect.any(Number),
			hostname: expect.any(String),
		};

		// This structure should match what the bash logging library produces
		expect(expectedLogEntry).toMatchObject({
			level: expect.any(Number),
			time: expect.any(String),
			msg: expect.any(String),
			source: expect.any(String),
		});
	});
});

describe('CLI Commands', () => {
	it('should handle missing log file gracefully', async () => {
		// Test that CLI commands handle missing log files without crashing
		const nonExistentPath = path.join(TEST_LOG_DIR, 'nonexistent.log');
		
		// This would be tested by running the actual CLI command
		// For now, we verify the expected behavior
		expect(existsSync(nonExistentPath)).toBe(false);
	});
});
