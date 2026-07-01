import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type PiperTtsPlugin from './main';
import { findOnPath } from './utils';

// ─── Settings interface ───────────────────────────────────────────────────────

export interface LanguageModelConfig {
	id: string;             // A unique ID (e.g. UUID) for Reactivity in UI
	languageCode: string;   // e.g., 'eng', 'spa', 'zho', 'fra' (franc uses ISO 639-3)
	languageName: string;   // e.g., 'English', 'Spanish'
	modelPath: string;      // Absolute path to the .onnx file
}

export interface PiperTtsSettings {
	/** Absolute path to the piper binary, or '' to auto-detect on PATH */
	piperPath: string;
	/** Configured language models */
	languageModels: LanguageModelConfig[];
	/** Output directory — relative to vault root or absolute */
	outputDir: string;
	/** Audio output format */
	outputFormat: 'wav' | 'mp3';
	/** Absolute path to ffmpeg, or '' to auto-detect (only used in mp3 mode) */
	ffmpegPath: string;
	/** Speaker index for multi-speaker models */
	speakerIndex: number;
	/** Default playback speed for the sidebar player */
	playbackSpeed: number;
	/** Whether to start playback automatically after generation */
	autoPlayOnGenerate: boolean;
	/** Seconds of silence inserted between sentences by Piper */
	sentenceSilence: number;
	/** Indicates if the onboarding wizard has been completed */
	firstRun: boolean;
}

export const DEFAULT_SETTINGS: PiperTtsSettings = {
	piperPath: '',
	languageModels: [],
	outputDir: '_tts',
	outputFormat: 'wav',
	ffmpegPath: '',
	speakerIndex: 0,
	playbackSpeed: 1.0,
	autoPlayOnGenerate: true,
	sentenceSilence: 0.2,
	firstRun: true,
};

// ─── Settings tab ─────────────────────────────────────────────────────────────

export class PiperTtsSettingTab extends PluginSettingTab {
	plugin: PiperTtsPlugin;

	constructor(app: App, plugin: PiperTtsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// ── Piper binary ──────────────────────────────────────────────────────
		new Setting(containerEl).setName('Piper TTS engine').setHeading();

		new Setting(containerEl)
			.setName('Piper executable path')
			.setDesc(
				'Leave empty to auto-detect on PATH. ' +
					'Or enter the full path to the piper binary (e.g. /usr/local/bin/piper).'
			)
			.addText((text) =>
				text
					.setPlaceholder('(auto-detect)')
					.setValue(this.plugin.settings.piperPath)
					.onChange(async (value) => {
						this.plugin.settings.piperPath = value;
						await this.plugin.saveSettings();
					})
			)
			.addButton((btn) =>
				btn
					.setButtonText('Test')
					.setTooltip('Check that piper is accessible')
					.onClick(async () => {
						const binary =
							this.plugin.settings.piperPath.trim() || 'piper';
						const found = await findOnPath(binary === 'piper' ? 'piper' : binary);
						if (found || this.plugin.settings.piperPath.trim()) {
							new Notice(`✅ Piper found: ${found ?? binary}`);
						} else {
							new Notice(
								'❌ Piper not found on PATH. Set the executable path above.'
							);
						}
					})
			);

		// ── Language Models ───────────────────────────────────────────────────
		new Setting(containerEl)
			.setName('Language Models')
			.setDesc('Configure different TTS models for different languages. The plugin will auto-detect the note\'s language and use the appropriate model.')
			.setHeading();

		const renderLanguageModels = () => {
			// Clear existing language model settings first (we use a wrapper div to avoid clearing everything)
			let modelsContainer = containerEl.querySelector('.tts-models-container');
			if (!modelsContainer) {
				modelsContainer = containerEl.createDiv({ cls: 'tts-models-container' });
			} else {
				modelsContainer.empty();
			}

			this.plugin.settings.languageModels.forEach((modelConfig, index) => {
				const setting = new Setting(modelsContainer as HTMLElement)
					.setName(`Language ${index + 1}`)
					.setDesc('Enter language code (e.g., eng, spa, fra) and model path.')
					.addText((text) =>
						text
							.setPlaceholder('Code (e.g. eng)')
							.setValue(modelConfig.languageCode)
							.onChange(async (value) => {
								modelConfig.languageCode = value.trim().toLowerCase();
								await this.plugin.saveSettings();
							})
					)
					.addText((text) =>
						text
							.setPlaceholder('/path/to/model.onnx')
							.setValue(modelConfig.modelPath)
							.onChange(async (value) => {
								modelConfig.modelPath = value;
								await this.plugin.saveSettings();
							})
					)
					.addButton((btn) =>
						btn
							.setIcon('trash-2')
							.setTooltip('Delete this language')
							.onClick(async () => {
								this.plugin.settings.languageModels.splice(index, 1);
								await this.plugin.saveSettings();
								renderLanguageModels();
							})
					);
				setting.settingEl.style.borderTop = '1px solid var(--background-modifier-border)';
				setting.settingEl.style.paddingTop = '1em';
			});

			new Setting(modelsContainer as HTMLElement)
				.addButton((btn) =>
					btn
						.setButtonText('+ Add Language')
						.setCta()
						.onClick(async () => {
							this.plugin.settings.languageModels.push({
								id: Date.now().toString(),
								languageCode: '',
								languageName: '',
								modelPath: '',
							});
							await this.plugin.saveSettings();
							renderLanguageModels();
						})
				);
		};

		renderLanguageModels();

		new Setting(containerEl)
			.setName('Speaker index')
			.setDesc(
				'For multi-speaker models only. Leave at 0 for single-speaker models.'
			)
			.addSlider((slider) =>
				slider
					.setLimits(0, 20, 1)
					.setValue(this.plugin.settings.speakerIndex)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.speakerIndex = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Sentence silence (seconds)')
			.setDesc('Pause duration inserted between sentences. Default: 0.2s.')
			.addSlider((slider) =>
				slider
					.setLimits(0, 2, 0.05)
					.setValue(this.plugin.settings.sentenceSilence)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.sentenceSilence = value;
						await this.plugin.saveSettings();
					})
			);

		// ── Output ────────────────────────────────────────────────────────────
		new Setting(containerEl).setName('Output').setHeading();

		new Setting(containerEl)
			.setName('Output directory')
			.setDesc(
				'Where audio files are saved. ' +
					'Use a relative path (from vault root) or an absolute path. Default: _tts'
			)
			.addText((text) =>
				text
					.setPlaceholder('_tts')
					.setValue(this.plugin.settings.outputDir)
					.onChange(async (value) => {
						this.plugin.settings.outputDir = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Output format')
			.setDesc(
				'WAV: no extra dependencies required. ' +
					'MP3: requires ffmpeg to be installed.'
			)
			.addDropdown((drop) =>
				drop
					.addOption('wav', 'WAV (recommended)')
					.addOption('mp3', 'MP3 (requires ffmpeg)')
					.setValue(this.plugin.settings.outputFormat)
					.onChange(async (value) => {
						this.plugin.settings.outputFormat = value as 'wav' | 'mp3';
						await this.plugin.saveSettings();
						// Re-render so the FFmpeg field appears/disappears
						this.display();
					})
			);

		// Show FFmpeg path only when MP3 is selected
		if (this.plugin.settings.outputFormat === 'mp3') {
			new Setting(containerEl)
				.setName('FFmpeg path')
				.setDesc(
					'Leave empty to auto-detect on PATH, or enter the full path to ffmpeg.'
				)
				.addText((text) =>
					text
						.setPlaceholder('(auto-detect)')
						.setValue(this.plugin.settings.ffmpegPath)
						.onChange(async (value) => {
							this.plugin.settings.ffmpegPath = value;
							await this.plugin.saveSettings();
						})
				)
				.addButton((btn) =>
					btn
						.setButtonText('Test')
						.setTooltip('Check that ffmpeg is accessible')
						.onClick(async () => {
							const binary =
								this.plugin.settings.ffmpegPath.trim() || 'ffmpeg';
							const found = await findOnPath(
								binary === 'ffmpeg' ? 'ffmpeg' : binary
							);
							if (found || this.plugin.settings.ffmpegPath.trim()) {
								new Notice(`✅ FFmpeg found: ${found ?? binary}`);
							} else {
								new Notice(
									'❌ FFmpeg not found on PATH. Set the path above or install it.'
								);
							}
						})
				);
		}

		// ── Playback ──────────────────────────────────────────────────────────
		new Setting(containerEl).setName('Playback').setHeading();

		new Setting(containerEl)
			.setName('Auto-play on generate')
			.setDesc('Start playback automatically once audio generation is complete.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoPlayOnGenerate)
					.onChange(async (value) => {
						this.plugin.settings.autoPlayOnGenerate = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
