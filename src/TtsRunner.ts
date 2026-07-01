import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import type { PiperTtsSettings } from './settings';
import { getSampleRate } from './utils';

/**
 * TtsRunner — wraps the Piper CLI (and optional FFmpeg) as a Node.js child process.
 *
 * Input strategy: text is piped to piper via STDIN (not --input-file).
 * --input-file is absent from many piper distributions and causes a crash/null exit.
 *
 * WAV mode:  echo <text> | piper --model <m> --output-file <o> --sentence-silence <s>
 * MP3 mode:  echo <text> | piper --model <m> --output-raw | ffmpeg -f s16le ... -i - <o>
 */
export class TtsRunner {
	private settings: PiperTtsSettings;

	constructor(settings: PiperTtsSettings) {
		this.settings = settings;
	}

	/**
	 * Run TTS generation.
	 * @param textFilePath  Absolute path to the plain-text input file (read and piped to stdin).
	 * @param outputPath    Absolute path for the audio output file.
	 * @param modelPath     Absolute path to the .onnx model file to use.
	 * @param onStderr      Optional callback for stderr data (e.g. progress logging).
	 */
	async run(
		textFilePath: string,
		outputPath: string,
		modelPath: string,
		onStderr?: (line: string) => void
	): Promise<void> {
		// Read the text file — we'll pipe it to piper's stdin
		const text = fs.readFileSync(textFilePath, 'utf8');

		const isMp3 = outputPath.toLowerCase().endsWith('.mp3');
		const wavPath = isMp3 ? `${outputPath}.tmp.wav` : outputPath;
		const piperBin = this.settings.piperPath.trim() || 'piper';

		// 1. Run Piper to generate WAV
		await new Promise<void>((resolve, reject) => {
			const piperArgs = [
				'--model', modelPath,
				'--output_file', wavPath,
				'--sentence_silence', String(this.settings.sentenceSilence),
			];
			
			// Auto-detect config file if it lacks the .onnx extension
			const onnxJsonPath = `${modelPath}.json`;
			const plainJsonPath = modelPath.replace(/\.onnx$/i, '.json');
			if (!fs.existsSync(onnxJsonPath) && fs.existsSync(plainJsonPath)) {
				piperArgs.push('--config', plainJsonPath);
			}
			if (this.settings.speakerIndex > 0) {
				piperArgs.push('--speaker', String(this.settings.speakerIndex));
			}

			const piperStderrLines: string[] = [];
			const piper = spawn(piperBin, piperArgs, {
				stdio: ['pipe', 'ignore', 'pipe'],
			});

			piper.stderr?.on('data', (d: Buffer) => {
				const line = d.toString().trim();
				if (line) {
					piperStderrLines.push(line);
					onStderr?.(line);
				}
			});

			piper.on('error', (err: NodeJS.ErrnoException) => {
				if (err.code === 'ENOENT') {
					reject(new Error(`Piper binary not found: "${piperBin}". Install piper-tts or set path in Settings.`));
				} else {
					reject(err);
				}
			});

			piper.on('close', (code, signal) => {
				if (code === 0) resolve();
				else {
					const reason = signal ? `killed by signal ${signal}` : `exit code ${code ?? 'null'}`;
					const detail = piperStderrLines.join('\n').trim();
					reject(new Error(`Piper failed (${reason}).\n\nPiper output:\n${detail}`));
				}
			});

			if (piper.stdin) {
				piper.stdin.write(text, 'utf8');
				piper.stdin.end();
			} else {
				reject(new Error('Could not open piper stdin pipe.'));
			}
		});

		// 2. If requested format is MP3, run FFmpeg on the finished WAV
		if (isMp3) {
			const ffmpegBin = this.settings.ffmpegPath.trim() || 'ffmpeg';
			await new Promise<void>((resolve, reject) => {
				const ffmpegArgs = [
					'-y',
					'-i', wavPath,
					'-c:a', 'libmp3lame',
					'-b:a', '64k', // CBR 64k guarantees robust duration parsing in all players
					'-write_xing', '0',
					outputPath,
				];

				const ffmpegStderrLines: string[] = [];
				const ffmpeg = spawn(ffmpegBin, ffmpegArgs, {
					stdio: ['ignore', 'ignore', 'pipe'],
				});

				ffmpeg.stderr?.on('data', (d: Buffer) => {
					const line = d.toString().trim();
					if (line) {
						ffmpegStderrLines.push(line);
						onStderr?.(`[ffmpeg] ${line}`);
					}
				});

				ffmpeg.on('error', (err: NodeJS.ErrnoException) => {
					if (err.code === 'ENOENT') {
						reject(new Error(`FFmpeg not found: "${ffmpegBin}". Install ffmpeg or set path in Settings.`));
					} else {
						reject(err);
					}
				});

				ffmpeg.on('close', (code, signal) => {
					if (code === 0) resolve();
					else {
						const reason = signal ? `killed by signal ${signal}` : `exit code ${code ?? 'null'}`;
						const detail = ffmpegStderrLines.join('\n').trim();
						reject(new Error(`FFmpeg failed (${reason}).\n\nFFmpeg output:\n${detail}`));
					}
				});
			});

			// Clean up temp WAV file
			try {
				const fs = require('fs');
				if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
			} catch (e) {
				console.warn('[piper-tts] Failed to delete temp wav file', e);
			}
		}
	}
}
