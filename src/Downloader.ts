import * as fs from 'fs';
import * as https from 'https';
import AdmZip from 'adm-zip';
import * as tar from 'tar';
export class Downloader {
	static async downloadFile(url: string, destPath: string, onProgress?: (pct: number) => void): Promise<void> {
		return new Promise((resolve, reject) => {
			const file = fs.createWriteStream(destPath);
			let totalBytes = 0;
			let receivedBytes = 0;

			const request = https.get(url, (response) => {
				// Handle redirects
				if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
					file.close();
					fs.unlinkSync(destPath); // Delete the empty file
					return this.downloadFile(response.headers.location, destPath, onProgress).then(resolve).catch(reject);
				}

				if (response.statusCode !== 200) {
					file.close();
					reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
					return;
				}

				totalBytes = parseInt(response.headers['content-length'] || '0', 10);

				response.on('data', (chunk: Buffer) => {
					receivedBytes += chunk.length;
					if (totalBytes > 0 && onProgress) {
						onProgress(Math.round((receivedBytes / totalBytes) * 100));
					}
				});

				response.pipe(file);

				file.on('finish', () => {
					file.close();
					resolve();
				});
			});

			request.on('error', (err) => {
				file.close();
				fs.unlink(destPath, () => {});
				reject(err);
			});
		});
	}

	static async extract(archivePath: string, destDir: string): Promise<void> {
		if (archivePath.endsWith('.zip')) {
			const zip = new AdmZip(archivePath);
			zip.extractAllTo(destDir, true);
		} else if (archivePath.endsWith('.tar.gz') || archivePath.endsWith('.tgz')) {
			await tar.x({
				file: archivePath,
				cwd: destDir,
			});
		} else {
			throw new Error('Unsupported archive format: ' + archivePath);
		}
	}

	static setExecutablePermissions(binPath: string): void {
		if (process.platform !== 'win32') {
			try {
				fs.chmodSync(binPath, '755');
			} catch (e) {
				console.error('Failed to set executable permissions for ' + binPath, e);
			}
		}
	}
}
