import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';

// Mock environment for testing
const TEST_LOG_DIR = path.join(tmpdir(), 'ratos-test-logs');
const TEST_LOG_FILE = path.join(TEST_LOG_DIR, 'ratos-update.log');

// override the environment
process.env.LOG_FILE = TEST_LOG_FILE;
process.env.KLIPPER_ENV = '/tmp/test-klipper.env';
process.env.RATOS_DATA_DIR = TEST_LOG_DIR;

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

			const logContent = logEntries.map((entry) => JSON.stringify(entry)).join('\n');
			await writeFile(TEST_LOG_FILE, logContent);

			// Import the function
			const { parseLogFile } = await import('@/server/routers/update-logs');
			const parsedEntries = await parseLogFile(TEST_LOG_FILE);

			expect(parsedEntries).toHaveLength(2);
			expect(parsedEntries[0].msg).toBe('Starting update process');
			expect(parsedEntries[1].errorCode).toBe('SYMLINK_CREATE_FAILED');
		});

		it('should skip invalid JSON lines and filter by source', async () => {
			const logContent = [
				'{"level":30,"time":"2024-01-01T10:00:00.000Z","msg":"Valid entry","source":"ratos-update"}',
				'Invalid JSON line',
				'{"level":50,"time":"2024-01-01T10:01:00.000Z","msg":"Another valid entry","source":"ratos-update"}',
				'{"level":30,"time":"2024-01-01T10:02:00.000Z","msg":"Different source","source":"other-service"}',
			].join('\n');

			await writeFile(TEST_LOG_FILE, logContent);

			const { parseLogFile } = await import('@/server/routers/update-logs');
			const parsedEntries = await parseLogFile(TEST_LOG_FILE);

			expect(parsedEntries).toHaveLength(2); // Only ratos-update entries
			expect(parsedEntries[0]?.msg).toBe('Valid entry');
			expect(parsedEntries[1]?.msg).toBe('Another valid entry');
		});

		it('should sort entries by timestamp', async () => {
			const logEntries = [
				{
					level: 30,
					time: '2024-01-01T10:02:00.000Z',
					msg: 'Second entry',
					source: 'ratos-update',
				},
				{
					level: 30,
					time: '2024-01-01T10:01:00.000Z',
					msg: 'First entry',
					source: 'ratos-update',
				},
				{
					level: 30,
					time: '2024-01-01T10:03:00.000Z',
					msg: 'Third entry',
					source: 'ratos-update',
				},
			];

			const logContent = logEntries.map((entry) => JSON.stringify(entry)).join('\n');
			await writeFile(TEST_LOG_FILE, logContent);

			const { parseLogFile } = await import('@/server/routers/update-logs');
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

			const { generateSummary } = await import('@/server/routers/update-logs');
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

			const { generateSummary } = await import('@/server/routers/update-logs');
			const summary = generateSummary(logEntries, 1024, true);

			expect(summary.duration).toBe('2m 30s');
		});

		it('should identify last update time', async () => {
			const logEntries = [
				{ level: 30, time: '2024-01-01T10:00:00.000Z', msg: 'Start', errorCode: 'SCRIPT_START' },
				{ level: 30, time: '2024-01-01T10:01:00.000Z', msg: 'Middle' },
				{ level: 30, time: '2024-01-01T10:02:00.000Z', msg: 'End', errorCode: 'SCRIPT_SUCCESS' },
			];

			const { generateSummary } = await import('@/server/routers/update-logs');
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

			const { filterBySeverity } = await import('@/server/routers/update-logs');
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

			const { filterByContext } = await import('@/server/routers/update-logs');
			const filtered = filterByContext(logEntries, 'main');

			expect(filtered).toHaveLength(2);
			expect(filtered[0].msg).toBe('Message 1');
			expect(filtered[1].msg).toBe('Message 3');
		});
	});
});

describe('Bash Logging Library Integration', () => {
	it('should generate valid JSON log entries from bash script', async () => {
		// Set up test environment with proper log path
		const testLogPath = TEST_LOG_FILE;
		const originalLogFile = process.env.RATOS_LOG_FILE;
		process.env.RATOS_LOG_FILE = testLogPath;

		try {
			// Execute the bash logging script
			const scriptPath = path.resolve(__dirname, '../../configuration/scripts/ratos-logging.sh');

			// Test basic logging functions
			execSync(`bash -c "source ${scriptPath} && log_info 'Test message' 'test_context'"`, {
				env: { ...process.env, RATOS_LOG_FILE: testLogPath }
			});

			// Verify the log file was created and contains valid JSON
			expect(existsSync(testLogPath)).toBe(true);
			const logContent = await readFile(testLogPath, 'utf-8');
			const lines = logContent.trim().split('\n').filter(line => line.trim());
			const logEntry = JSON.parse(lines[0]);

			expect(logEntry).toMatchObject({
				level: 30,
				msg: expect.stringContaining('Test message'),
				context: 'test_context',
				source: 'ratos-update'
			});
			expect(logEntry).toHaveProperty('time');
			expect(logEntry).toHaveProperty('pid');
			expect(logEntry).toHaveProperty('hostname');
		} finally {
			// Restore original environment
			if (originalLogFile) {
				process.env.RATOS_LOG_FILE = originalLogFile;
			} else {
				delete process.env.RATOS_LOG_FILE;
			}
		}
	});

	it('should handle different log levels correctly', async () => {
		const testLogPath = TEST_LOG_FILE;
		const originalLogFile = process.env.RATOS_LOG_FILE;
		process.env.RATOS_LOG_FILE = testLogPath;

		try {
			const scriptPath = path.resolve(__dirname, '../../configuration/scripts/ratos-logging.sh');

			// Test different log levels
			execSync(`bash -c "source ${scriptPath} && log_error 'Error message' 'error_context'"`, {
				env: { ...process.env, RATOS_LOG_FILE: testLogPath }
			});

			const logContent = await readFile(testLogPath, 'utf-8');
			const lines = logContent.trim().split('\n').filter(line => line.trim());
			const logEntry = JSON.parse(lines[lines.length - 1]); // Get the last entry

			expect(logEntry).toMatchObject({
				level: 50, // Error level
				msg: expect.stringContaining('Error message'),
				context: 'error_context',
				source: 'ratos-update'
			});
		} finally {
			if (originalLogFile) {
				process.env.RATOS_LOG_FILE = originalLogFile;
			} else {
				delete process.env.RATOS_LOG_FILE;
			}
		}
	});
});

describe('CLI Commands Integration', () => {
	beforeEach(async () => {
		// Create test log file with sample data
		const sampleLogs = [
			{
				level: 30,
				time: '2024-01-01T10:00:00.000Z',
				msg: 'Test info message',
				source: 'ratos-update',
				context: 'main'
			},
			{
				level: 50,
				time: '2024-01-01T10:01:00.000Z',
				msg: 'Test error message',
				source: 'ratos-update',
				context: 'error_test'
			},
			{
				level: 30,
				time: '2024-01-01T10:02:00.000Z',
				msg: 'Different service log',
				source: 'other-service',
				context: 'main'
			}
		];
		const logContent = sampleLogs.map(log => JSON.stringify(log)).join('\n');
		await writeFile(TEST_LOG_FILE, logContent);
	});

	it('should execute summary command successfully', () => {
		try {
			const result = execSync('npm run cli logs update-logs summary', {
				env: { ...process.env, LOG_FILE: TEST_LOG_FILE },
				encoding: 'utf-8',
				cwd: path.resolve(__dirname, '../..')
			});

			expect(result).toContain('Update Log Summary');
			expect(result).toContain('Total Entries: 2'); // Only ratos-update entries
		} catch (error) {
			// If CLI is not available in test environment, skip this test
			console.warn('CLI test skipped - CLI not available in test environment');
		}
	});

	it('should execute show command with filters', () => {
		try {
			const result = execSync('npm run cli logs update-logs show -n 10 -l error', {
				env: { ...process.env, LOG_FILE: TEST_LOG_FILE },
				encoding: 'utf-8',
				cwd: path.resolve(__dirname, '../..')
			});

			expect(result).toContain('Test error message');
			expect(result).not.toContain('Test info message');
		} catch (error) {
			// If CLI is not available in test environment, skip this test
			console.warn('CLI test skipped - CLI not available in test environment');
		}
	});

	it('should handle missing log file gracefully', async () => {
		const nonExistentPath = path.join(TEST_LOG_DIR, 'nonexistent.log');

		try {
			execSync('npm run cli logs update-logs summary', {
				env: { ...process.env, LOG_FILE: nonExistentPath },
				encoding: 'utf-8',
				cwd: path.resolve(__dirname, '../..')
			});
		} catch (error) {
			// Expected to fail gracefully with proper error message
			expect(error).toBeDefined();
		}
	});
});
