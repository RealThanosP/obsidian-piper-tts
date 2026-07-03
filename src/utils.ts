import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { FileSystemAdapter } from 'obsidian';

/**
 * Resolves a binary path:
 * - If override is set, return it directly.
 * - Otherwise, search the system PATH using `which`.
 */
export async function resolveBinaryPath(
	name: string,
	override: string
): Promise<string | null> {
	if (override.trim() !== '') {
		return override.trim();
	}
	return findOnPath(name);
}

/**
 * Runs `which <name>` and returns the resolved path, or null if not found.
 */
export function findOnPath(name: string): Promise<string | null> {
	return new Promise((resolve) => {
		const cmd = process.platform === 'win32' ? 'where' : 'which';
		const proc = spawn(cmd, [name]);
		let out = '';
		proc.stdout.on('data', (d: Buffer) => (out += d.toString()));
		proc.on('close', (code: number | null) => {
			if (code === 0) {
				// Windows 'where' can return multiple lines, take the first one
				resolve(out.trim().split(/\r?\n/)[0]);
			} else {
				resolve(null);
			}
		});
		proc.on('error', () => resolve(null));
	});
}

/**
 * Formats seconds as MM:SS.
 */
export function formatTime(seconds: number): string {
	if (!isFinite(seconds) || seconds < 0) return '00:00';
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Reads the sample_rate from a Piper .onnx.json sidecar file.
 * Falls back to 22050 Hz if the file is missing or malformed.
 */
export function getSampleRate(onnxPath: string): number {
	const configPath = onnxPath + '.json';
	try {
		const raw = fs.readFileSync(configPath, 'utf8');
		const config = JSON.parse(raw) as { audio?: { sample_rate?: number } };
		return config?.audio?.sample_rate ?? 22050;
	} catch {
		return 22050;
	}
}

/**
 * Ensures a directory exists, creating it recursively if needed.
 */
export function ensureDirSync(dirPath: string): void {
	fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Returns the absolute filesystem path for the vault root.
 * Uses the internal `basePath` property of the Adapter.
 */
export function getVaultBasePath(app: import('obsidian').App): string {
	const adapter = app.vault.adapter;
	if (adapter instanceof FileSystemAdapter) {
		return adapter.getBasePath();
	}
	throw new Error('Not running on local file system');
}

/**
 * Resolves the output directory to an absolute path.
 * If the configured path is relative, it is resolved against the vault root.
 */
export function resolveOutputDir(
	app: import('obsidian').App,
	outputDirSetting: string
): string {
	const dir = outputDirSetting.trim() || '_tts';
	if (path.isAbsolute(dir)) {
		return dir;
	}
	return path.join(getVaultBasePath(app), dir);
}
