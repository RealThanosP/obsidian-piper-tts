import { Modal, App, FileSystemAdapter } from 'obsidian';
import PiperTtsPlugin from './main';
import * as fs from 'fs';
import * as path from 'path';
import { Downloader } from './Downloader';

export class OnboardingModal extends Modal {
	plugin: PiperTtsPlugin;
	isInstalling: boolean = false;
	statusEl!: HTMLElement;
	progressBar!: HTMLProgressElement;

	constructor(app: App, plugin: PiperTtsPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('tts-onboarding-modal');

		contentEl.createEl('h2', { text: 'Welcome to Piper TTS! 🎉' });
		
		contentEl.createEl('p', { text: 'To convert your notes into high-quality audio completely offline, we need to download the core Piper engine and an English voice model.' });
		contentEl.createEl('p', { text: 'This will download about ~40MB of data directly into this plugin\'s hidden folder, so it won\'t pollute your system.' });

		const btnDiv = contentEl.createDiv({ attr: { style: 'margin-top: 30px; text-align: center;' } });
		
		const installBtn = btnDiv.createEl('button', { text: 'One-Click Install', cls: 'mod-cta' });
		installBtn.setCssStyles({ padding: '10px 30px', fontSize: '16px' });

		this.statusEl = contentEl.createEl('p', { attr: { style: 'margin-top: 20px; font-weight: bold; text-align: center; color: var(--text-accent);' } });
		this.progressBar = contentEl.createEl('progress', { attr: { max: '100', value: '0', style: 'width: 100%; display: none;' } });

		installBtn.onclick = async () => {
			if (this.isInstalling) return;
			this.isInstalling = true;
			installBtn.disabled = true;
			this.progressBar.setCssStyles({ display: 'block' });

			try {
				await this.runInstallation();
				this.statusEl.textContent = '✅ Installation Complete! You can close this window.';
				this.progressBar.setCssStyles({ display: 'none' });
				
				this.plugin.settings.firstRun = false;
				await this.plugin.saveSettings();
				
				const finishBtn = btnDiv.createEl('button', { text: 'Close & Start Listening' });
				finishBtn.setCssStyles({ marginLeft: '10px' });
				finishBtn.onclick = () => this.close();
				installBtn.setCssStyles({ display: 'none' });

			} catch (e) {
				this.statusEl.textContent = '❌ Installation Failed. Please check the developer console.';
				console.error('[piper-tts] Install Error:', e);
				installBtn.disabled = false;
				this.isInstalling = false;
			}
		};
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	async runInstallation() {
		// Get absolute path to the plugin folder
		const adapter = this.app.vault.adapter;
		if (!(adapter instanceof FileSystemAdapter)) {
			throw new Error('Not running on local file system');
		}
		
		const vaultPath = adapter.getBasePath();
		const pluginDir = path.join(vaultPath, this.app.vault.configDir, 'plugins', 'piper-tts');
		const binDir = path.join(pluginDir, 'bin');
		const modelsDir = path.join(pluginDir, 'models');

		if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });
		if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true });

		// 1. Download Piper
		this.statusEl.textContent = 'Downloading Piper engine...';
		const platform = process.platform;
		const arch = process.arch;
		let piperUrl = '';
		let archiveName = '';

		if (platform === 'win32') { piperUrl = 'https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_windows_amd64.zip'; archiveName = 'piper.zip'; }
		else if (platform === 'darwin' && arch === 'arm64') { piperUrl = 'https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_macos_aarch64.tar.gz'; archiveName = 'piper.tar.gz'; }
		else if (platform === 'darwin') { piperUrl = 'https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_macos_x64.tar.gz'; archiveName = 'piper.tar.gz'; }
		else { piperUrl = 'https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_linux_x86_64.tar.gz'; archiveName = 'piper.tar.gz'; }

		const piperArchive = path.join(binDir, archiveName);
		
		await Downloader.downloadFile(piperUrl, piperArchive, (pct) => { this.progressBar.value = pct; });
		
		this.statusEl.textContent = 'Extracting Piper...';
		this.progressBar.removeAttribute('value'); // indeterminate
		await Downloader.extract(piperArchive, binDir);
		fs.unlinkSync(piperArchive); // cleanup

		// Find the piper executable inside the extracted folder
		let piperExecutable = platform === 'win32' ? path.join(binDir, 'piper', 'piper.exe') : path.join(binDir, 'piper', 'piper');
		if (!fs.existsSync(piperExecutable)) {
			piperExecutable = platform === 'win32' ? path.join(binDir, 'piper.exe') : path.join(binDir, 'piper');
		}

		Downloader.setExecutablePermissions(piperExecutable);
		this.plugin.settings.piperPath = piperExecutable;

		// 2. Download English Voice Model
		this.statusEl.textContent = 'Downloading English voice model...';
		this.progressBar.value = 0;
		
		const onnxUrl = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx';
		const jsonUrl = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json';
		
		const onnxPath = path.join(modelsDir, 'en_US-amy-medium.onnx');
		const jsonPath = path.join(modelsDir, 'en_US-amy-medium.onnx.json');

		await Downloader.downloadFile(onnxUrl, onnxPath, (pct) => { this.progressBar.value = pct; });
		
		this.statusEl.textContent = 'Downloading model configuration...';
		await Downloader.downloadFile(jsonUrl, jsonPath);

		// Register the model
		this.plugin.settings.languageModels.push({
			id: Date.now().toString(),
			languageCode: 'eng',
			languageName: 'English (Amy)',
			modelPath: onnxPath
		});

		// 3. Download FFmpeg
		this.statusEl.textContent = 'Downloading FFmpeg (for MP3 support)...';
		this.progressBar.value = 0;
		
		let ffmpegUrl = '';
		if (platform === 'win32') ffmpegUrl = 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v4.4.1/ffmpeg-4.4.1-win-64.zip';
		else if (platform === 'darwin') ffmpegUrl = 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v4.4.1/ffmpeg-4.4.1-osx-64.zip';
		else ffmpegUrl = 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v4.4.1/ffmpeg-4.4.1-linux-64.zip';

		const ffmpegArchive = path.join(binDir, 'ffmpeg.zip');
		await Downloader.downloadFile(ffmpegUrl, ffmpegArchive, (pct) => { this.progressBar.value = pct; });

		this.statusEl.textContent = 'Extracting FFmpeg...';
		this.progressBar.removeAttribute('value');
		await Downloader.extract(ffmpegArchive, binDir);
		fs.unlinkSync(ffmpegArchive);

		const ffmpegExecutable = platform === 'win32' ? path.join(binDir, 'ffmpeg.exe') : path.join(binDir, 'ffmpeg');
		Downloader.setExecutablePermissions(ffmpegExecutable);
		this.plugin.settings.ffmpegPath = ffmpegExecutable;
	}
}
