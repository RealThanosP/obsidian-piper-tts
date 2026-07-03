import { Plugin, Notice, TFile } from "obsidian";
import * as path from "path";
import * as fs from "fs";
import { franc } from "franc-min";

import {
  PiperTtsSettings,
  DEFAULT_SETTINGS,
  PiperTtsSettingTab,
} from "./settings";
import { TextExtractor } from "./TextExtractor";
import { TtsRunner } from "./TtsRunner";
import { TtsPlayerView, TTS_PLAYER_VIEW_TYPE } from "./TtsPlayerView";
import { OnboardingModal } from "./OnboardingModal";
import { resolveOutputDir, ensureDirSync } from "./utils";

export default class PiperTtsPlugin extends Plugin {
  settings!: PiperTtsSettings;

  // Lifecycle

  async onload(): Promise<void> {
    await this.loadSettings();

    // Show onboarding wizard if it's the first run
    if (this.settings.firstRun) {
      new OnboardingModal(this.app, this).open();
    }

    // Register the sidebar player view
    this.registerView(
      TTS_PLAYER_VIEW_TYPE,
      (leaf) => new TtsPlayerView(leaf, this),
    );

    // Settings tab
    this.addSettingTab(new PiperTtsSettingTab(this.app, this));

    // Auto-load audio for the active note if it exists
    this.registerEvent(
      this.app.workspace.on("file-open", async (file: TFile | null) => {
        if (!file) return;

        const outputDir = resolveOutputDir(this.app, this.settings.outputDir);
        const ext = this.settings.outputFormat;
        const audioFileName = `${file.basename}.${ext}`;
        const audioPath = path.join(outputDir, audioFileName);

        const leaves = this.app.workspace.getLeavesOfType(TTS_PLAYER_VIEW_TYPE);
        for (const leaf of leaves) {
          const view = leaf.view as TtsPlayerView;
          if (fs.existsSync(audioPath)) {
            await view.loadAudio(audioPath, file.basename, false);
          } else {
            await view.setNoAudio(file.basename);
          }
        }
      }),
    );

    // Ribbon button — opens / reveals the player sidebar
    this.addRibbonIcon("headphones", "Open TTS Player", async () => {
      await this.activateView();
    });

    // Command: generate TTS for the entire active note
    this.addCommand({
      id: "generate-tts-for-note",
      name: "Generate TTS for current note",
      icon: "mic",
      editorCallback: async (editor, ctx) => {
        const file = ctx.file;
        if (!file) {
          new Notice("No active file.");
          return;
        }
        await this.generateTts(file, editor.getValue());
      },
    });

    // Command: generate TTS for selected text only
    this.addCommand({
      id: "generate-tts-for-selection",
      name: "Generate TTS for selected text",
      icon: "text-select",
      editorCallback: async (editor, ctx) => {
        const selection = editor.getSelection();
        if (!selection.trim()) {
          new Notice("No text selected.");
          return;
        }
        const file = ctx.file;
        if (!file) {
          new Notice("No active file.");
          return;
        }
        await this.generateTts(file, selection);
      },
    });

    // Command: open / reveal the player sidebar
    this.addCommand({
      id: "open-tts-player",
      name: "Open TTS Player sidebar",
      icon: "headphones",
      callback: async () => {
        await this.activateView();
      },
    });

    console.log("[piper-tts] Plugin loaded.");
  }

  onunload(): void {
    console.log("[piper-tts] Plugin unloaded.");
  }

  // ─── Settings ──────────────────────────────────────────────────────────────

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  // ─── View management ───────────────────────────────────────────────────────

  async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(TTS_PLAYER_VIEW_TYPE)[0];

    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (!rightLeaf) {
        new Notice("Could not open TTS Player sidebar.");
        return;
      }
      leaf = rightLeaf;
      await leaf.setViewState({ type: TTS_PLAYER_VIEW_TYPE, active: true });
    }

    workspace.revealLeaf(leaf);
  }

  // ─── Core TTS generation ───────────────────────────────────────────────────

  /**
   * Full TTS generation pipeline:
   *  1. Validate settings
   *  2. Extract/sanitize text
   *  3. Ensure output directory exists
   *  4. Write temp .txt file
   *  5. Run piper (+ optional ffmpeg)
   *  6. Delete temp .txt file
   *  7. Load audio into the sidebar player
   */
  async generateTts(file: TFile, rawText: string): Promise<void> {
    // ── 1. Validate ───────────────────────────────────────────────────────
    if (this.settings.languageModels.length === 0) {
      new Notice(
        "⚠ Piper TTS: No language models configured. " +
          "Open Settings → Piper TTS and add a language model.",
        6000,
      );
      return;
    }

    // ── 2. Extract text ───────────────────────────────────────────────────
    const extractor = new TextExtractor();
    const cleanText = extractor.extract(rawText);

    if (!cleanText.trim()) {
      new Notice("The note appears to be empty after text extraction.");
      return;
    }

    const detectedLang = franc(cleanText);    const matchedModel = this.settings.languageModels.find(
      (m) => m.languageCode.toLowerCase() === detectedLang.toLowerCase(),
    );

    if (!matchedModel || !matchedModel.modelPath.trim()) {
      new Notice(
        `⚠ Piper TTS: Detected language "${detectedLang}", but no model is configured for it. Add it in settings.`,
        6000,
      );
      return;
    }

    // ── 3. Resolve output directory ───────────────────────────────────────
    const outputDir = resolveOutputDir(this.app, this.settings.outputDir);
    ensureDirSync(outputDir);

    // ── 4. Build file paths ───────────────────────────────────────────────
    const stem = file.basename;
    const ext = this.settings.outputFormat;
    const txtPath = path.join(outputDir, `${stem}.txt`);
    const audioPath = path.join(outputDir, `${stem}.${ext}`);

    // Write temp text file
    fs.writeFileSync(txtPath, cleanText, "utf8");

    // ── 5. Run TTS ────────────────────────────────────────────────────────
    const notice = new Notice("🔊 Generating TTS audio…", 0);

    try {
      const runner = new TtsRunner(this.settings);
      await runner.run(txtPath, audioPath, matchedModel.modelPath, (line) => {
        console.debug("[piper]", line);
      });

      // ── 6. Clean up temp file ─────────────────────────────────────────
      try {
        fs.unlinkSync(txtPath);
      } catch {
        // Non-fatal: temp file cleanup failure
      }

      notice.hide();
      new Notice("✅ TTS ready!", 2500);

      // ── 7. Load into player ───────────────────────────────────────────
      await this.activateView();

      const leaf = this.app.workspace.getLeavesOfType(TTS_PLAYER_VIEW_TYPE)[0];
      const view = leaf?.view as unknown as TtsPlayerView | undefined;
      if (view) await view.loadAudio(audioPath, file.basename);
    } catch (err) {
      notice.hide();
      const message = (err as Error).message ?? String(err);
      new Notice(`❌ TTS generation failed:\n${message}`, 8000);
      console.error("[piper-tts] Error:", err);

      // Clean up temp text file even on failure
      try {
        if (fs.existsSync(txtPath)) fs.unlinkSync(txtPath);
      } catch {
        // ignore
      }
    }
  }
}
