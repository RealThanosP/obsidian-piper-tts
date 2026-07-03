import { ItemView, WorkspaceLeaf, Notice, setIcon } from "obsidian";
import * as fs from "fs";
import type PiperTtsPlugin from "./main";
import { formatTime } from "./utils";

export const TTS_PLAYER_VIEW_TYPE = "piper-tts-player";

type PlayerState = "idle" | "ready" | "playing" | "paused" | "error";

/**
 * TtsPlayerView — persistent right-sidebar audio player implemented as an Obsidian ItemView.
 *
 * External API:
 *   view.loadAudio(absoluteFilePath, noteTitle)   — load a new audio file
 */
export class TtsPlayerView extends ItemView {
  private plugin: PiperTtsPlugin;

  // DOM elements
  private idleEl!: HTMLElement;
  private playerEl!: HTMLElement;
  private titleEl!: HTMLElement;
  private seekBar!: HTMLInputElement;
  private currentTimeEl!: HTMLElement;
  private totalTimeEl!: HTMLElement;
  private playBtn!: HTMLButtonElement;
  private volumeBar!: HTMLInputElement;
  private speedBtns: HTMLButtonElement[] = [];
  private audioEl!: HTMLAudioElement;

  private regenBtn!: HTMLButtonElement;
  private regenBtnText!: HTMLSpanElement;
  private deleteBtn!: HTMLButtonElement;

  // State
  private currentFile: string | null = null;
  private currentTitle = "";
  private state: PlayerState = "idle";
  private isSeeking = false;

  private readonly SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

  constructor(leaf: WorkspaceLeaf, plugin: PiperTtsPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return TTS_PLAYER_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "TTS Player";
  }

  getIcon(): string {
    return "headphones";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("tts-player-container");
    this.buildUI(container);
  }

  async onClose(): Promise<void> {
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.removeAttribute("src");
    }
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  private currentBlobUrl: string | null = null;

  setNoAudio(noteTitle: string): void {
    this.currentFile = null;
    this.currentTitle = noteTitle;
    this.audioEl.pause();
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
    this.audioEl.removeAttribute("src");
    
    this.titleEl.textContent = noteTitle;
    this.seekBar.value = "0";
    this.currentTimeEl.textContent = "00:00";
    this.totalTimeEl.textContent = "00:00";
    
    this.setPlayerMode("no-audio");
    this.setPlayerState("idle");
  }

  async loadAudio(
    filePath: string,
    noteTitle: string,
    autoPlay: boolean = this.plugin.settings.autoPlayOnGenerate,
  ): Promise<void> {
    this.currentFile = filePath;
    this.currentTitle = noteTitle;

    // Reset audio state
    this.audioEl.pause();

    try {
      // Read the file directly into a buffer.
      // Obsidian's app:// protocol often fails to handle byte-range requests
      // properly for MP3 files, causing Chrome to wildly miscalculate duration.
      // Loading it as a Blob guarantees perfect duration parsing in memory.
      const buffer = await fs.promises.readFile(filePath);
      const blob = new Blob([buffer], { type: "audio/mpeg" });

      if (this.currentBlobUrl) {
        URL.revokeObjectURL(this.currentBlobUrl);
      }

      this.currentBlobUrl = URL.createObjectURL(blob);
      this.audioEl.src = this.currentBlobUrl;
    } catch (error) {
      console.error("[piper-tts] Failed to load audio to Blob:", error);
      new Notice("❌ Failed to load generated audio file.");
      return;
    }
    this.audioEl.playbackRate = this.plugin.settings.playbackSpeed;
    this.audioEl.load();

    this.titleEl.textContent = noteTitle;
    this.seekBar.value = "0";
    this.currentTimeEl.textContent = "00:00";
    this.totalTimeEl.textContent = "00:00";

    this.setPlayerMode("has-audio");
    this.setPlayerState("ready");

    if (autoPlay) {
      this.audioEl.play().catch((e) => {
        console.error("[piper-tts] play error", e);
      });
    }
  }

  // ─── UI Construction ───────────────────────────────────────────────────────

  private buildUI(container: HTMLElement): void {
    // Hidden audio element
    this.audioEl = container.createEl("audio");
    this.audioEl.setCssStyles({ display: "none" });
    this.wireAudioEvents();

    // ── Player ────────────────────────────────────────────────────────────
    this.playerEl = container.createDiv({ cls: "tts-player-inner" });
    // Always show the player
    this.playerEl.setCssStyles({ display: "flex" });

    // Note title
    this.titleEl = this.playerEl.createDiv({ cls: "tts-player-title" });

    // Seek bar
    const seekContainer = this.playerEl.createDiv({
      cls: "tts-seek-container",
    });
    this.seekBar = seekContainer.createEl("input", {
      type: "range",
      cls: "tts-seek-bar",
    });
    this.seekBar.min = "0";
    this.seekBar.max = "100";
    this.seekBar.value = "0";
    this.seekBar.step = "0.1";
    this.seekBar.addEventListener("mousedown", () => (this.isSeeking = true));
    this.seekBar.addEventListener("touchstart", () => (this.isSeeking = true), {
      passive: true,
    });
    this.seekBar.addEventListener("mouseup", () => (this.isSeeking = false));
    this.seekBar.addEventListener("touchend", () => (this.isSeeking = false));
    this.seekBar.addEventListener("change", () => (this.isSeeking = false));
    this.seekBar.addEventListener("input", () => {
      if (this.audioEl.duration) {
        this.audioEl.currentTime =
          (parseFloat(this.seekBar.value) / 100) * this.audioEl.duration;
      }
    });

    const timeRow = seekContainer.createDiv({ cls: "tts-time-display" });
    this.currentTimeEl = timeRow.createSpan({ text: "00:00" });
    this.totalTimeEl = timeRow.createSpan({ text: "00:00" });

    // Main controls
    const controlsRow = this.playerEl.createDiv({ cls: "tts-controls-main" });

    // Rewind 10s
    const rewindBtn = controlsRow.createEl("button", {
      cls: "tts-btn tts-btn-rewind",
      title: "Rewind 10 seconds",
    });
    setIcon(rewindBtn, "rewind");
    rewindBtn.addEventListener("click", () => {
      this.audioEl.currentTime = Math.max(0, this.audioEl.currentTime - 10);
    });

    // Play / Pause
    this.playBtn = controlsRow.createEl("button", {
      cls: "tts-btn tts-btn-play",
      title: "Play / Pause",
    });
    setIcon(this.playBtn, "play");
    this.playBtn.addEventListener("click", () => this.togglePlay());

    // Skip 30s
    const skipBtn = controlsRow.createEl("button", {
      cls: "tts-btn tts-btn-skip",
      title: "Skip 30 seconds",
    });
    setIcon(skipBtn, "fast-forward");
    skipBtn.addEventListener("click", () => {
      if (this.audioEl.duration) {
        this.audioEl.currentTime = Math.min(
          this.audioEl.duration,
          this.audioEl.currentTime + 30,
        );
      }
    });

    // Speed buttons
    const speedRow = this.playerEl.createDiv({ cls: "tts-speed-row" });
    this.SPEEDS.forEach((speed) => {
      const btn = speedRow.createEl("button", {
        cls: "tts-speed-btn",
        text: `${speed}×`,
        title: `Set speed to ${speed}×`,
      });
      if (speed === this.plugin.settings.playbackSpeed) {
        btn.addClass("active");
      }
      btn.addEventListener("click", () => {
        this.audioEl.playbackRate = speed;
        this.speedBtns.forEach((b) => b.removeClass("active"));
        btn.addClass("active");
      });
      this.speedBtns.push(btn);
    });

    // Volume row
    const volumeRow = this.playerEl.createDiv({ cls: "tts-volume-row" });
    const volIcon = volumeRow.createSpan({ cls: "tts-volume-icon" });
    setIcon(volIcon, "volume-2");
    this.volumeBar = volumeRow.createEl("input", {
      type: "range",
      cls: "tts-volume-bar",
    });
    this.volumeBar.min = "0";
    this.volumeBar.max = "1";
    this.volumeBar.step = "0.02";
    this.volumeBar.value = "1";
    this.volumeBar.addEventListener("input", () => {
      this.audioEl.volume = parseFloat(this.volumeBar.value);
    });

    // Action buttons
    const actionsRow = this.playerEl.createDiv({ cls: "tts-actions-row" });

    this.regenBtn = actionsRow.createEl("button", {
      cls: "tts-btn tts-btn-action",
      title: "Regenerate TTS for the same note",
    });
    setIcon(this.regenBtn.createSpan(), "refresh-cw");
    this.regenBtnText = this.regenBtn.createSpan({ text: " Regenerate", cls: "tts-btn-text" });
    this.regenBtn.onclick = async () => {
      const file = this.app.workspace.getActiveFile();
      if (!file) {
        new Notice("No active file to regenerate.");
        return;
      }
      const text = await this.app.vault.read(file);
      await this.plugin.generateTts(file, text);
    };

    this.deleteBtn = actionsRow.createEl("button", {
      cls: "tts-btn tts-btn-action tts-btn-danger",
      title: "Delete the generated audio file",
    });
    setIcon(this.deleteBtn.createSpan(), "trash-2");
    this.deleteBtn.createSpan({ text: " Delete audio", cls: "tts-btn-text" });
    this.deleteBtn.onclick = async () => {
      if (!this.currentFile) return;
      try {
        await fs.promises.unlink(this.currentFile);
        this.audioEl.pause();
        this.audioEl.removeAttribute("src");
        this.currentFile = null;
        this.setNoAudio(this.currentTitle);
        new Notice("Audio file deleted.");
      } catch (e) {
        new Notice(`Could not delete file: ${(e as Error).message}`);
      }
    };
  }

  // ─── Audio event wiring ────────────────────────────────────────────────────

  private wireAudioEvents(): void {
    this.audioEl.addEventListener("timeupdate", () => {
      if (!this.audioEl.duration || !isFinite(this.audioEl.duration)) return;
      if (!this.isSeeking) {
        const pct = (this.audioEl.currentTime / this.audioEl.duration) * 100;
        this.seekBar.value = String(pct);
      }
      this.currentTimeEl.textContent = formatTime(this.audioEl.currentTime);
      this.totalTimeEl.textContent = formatTime(this.audioEl.duration);
    });

    this.audioEl.addEventListener("loadedmetadata", () => {
      this.seekBar.max = "100";
      this.totalTimeEl.textContent = formatTime(this.audioEl.duration);
    });

    this.audioEl.addEventListener("play", () => this.setPlayerState("playing"));
    this.audioEl.addEventListener("pause", () => {
      if (!this.audioEl.ended) this.setPlayerState("paused");
    });

    this.audioEl.addEventListener("ended", () => {
      this.setPlayerState("ready");
      this.seekBar.value = "0";
      this.currentTimeEl.textContent = "00:00";
    });

    this.audioEl.addEventListener("error", (e) => {
      if (!this.audioEl.getAttribute("src")) {
        // Ignore errors caused by clearing the audio source
        return;
      }
      this.setPlayerState("error");
      console.error(
        "[piper-tts] Audio playback error. src:",
        this.audioEl.src,
        e,
      );
      new Notice(
        `❌ Audio playback error. Check console for URL.\nsrc: ${this.audioEl.src}`,
      );
    });
  }

  // ─── State management ──────────────────────────────────────────────────────

  private setPlayerState(state: PlayerState): void {
    this.state = state;
    if (!this.playBtn) return;
    this.playBtn.empty();

    switch (state) {
      case "playing":
        setIcon(this.playBtn, "pause");
        this.playBtn.title = "Pause";
        break;
      case "paused":
      case "ready":
        setIcon(this.playBtn, "play");
        this.playBtn.title = "Play";
        break;
      case "error":
        setIcon(this.playBtn, "alert-triangle");
        this.playBtn.title = "Error";
        break;
      case "idle":
        break;
    }
  }

  private togglePlay(): void {
    if (this.state === "playing") {
      this.audioEl.pause();
    } else if (this.state === "paused" || this.state === "ready") {
      this.audioEl.play().catch((e) => {
        console.error("[piper-tts] play error", e);
      });
    }
  }

  private setPlayerMode(mode: "has-audio" | "no-audio"): void {
    const hasAudio = mode === "has-audio";
    
    // Toggle controls
    this.seekBar.disabled = !hasAudio;
    this.playBtn.disabled = !hasAudio;
    this.volumeBar.disabled = !hasAudio;
    this.speedBtns.forEach(b => b.disabled = !hasAudio);
    
    // Toggle action buttons
    this.deleteBtn.setCssStyles({ display: hasAudio ? "flex" : "none" });
    
    // Update Regen/Generate button
    if (hasAudio) {
      this.regenBtnText.textContent = " Regenerate";
      this.regenBtn.title = "Regenerate TTS for the same note";
      // Icon is still refresh-cw (we don't change the SVG here as it's harder, but text is clear enough)
    } else {
      this.regenBtnText.textContent = " Generate Audio";
      this.regenBtn.title = "Generate TTS for this note";
    }
  }
}
