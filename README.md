# Obsidian Piper TTS

![Obsidian Piper TTS](https://img.shields.io/badge/Obsidian-Piper%20TTS-blue)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Mac%20%7C%20Linux-lightgrey)

A high-performance, completely offline, privacy-respecting Text-to-Speech (TTS) plugin for Obsidian. By leveraging the ultra-fast [Piper](https://github.com/rhasspy/piper) neural engine, this plugin allows you to convert your markdown notes into natural-sounding audio and play them back seamlessly within an integrated sidebar player.

Created by **RealThanosP**.

---

## 🌟 Features

- **100% Offline & Private:** Your notes never leave your machine.
- **Lightning Fast:** Uses the Piper TTS engine, designed for incredibly fast local generation on regular CPUs.
- **Multi-Language Auto-Detection:** Configure different voice models for different languages. The plugin automatically detects the language of your note and uses the correct model.
- **Built-in Sidebar Player:** A sleek, fully integrated audio player inside Obsidian.
- **MP3 & WAV Support:** Choose between instantaneous raw WAV generation or compact MP3 encoding via FFmpeg.
- **Native OS Compatibility:** Works flawlessly on Windows, macOS, and Linux.

---

## 🛠️ Installation & Setup

Since Piper TTS runs locally, you need to download the core engine and voice models to your computer. Don't worry, it only takes a few minutes!

### Step 1: Install the Plugin
1. Open Obsidian and go to **Settings > Community Plugins**.
2. Turn off Safe Mode (if it isn't already).
3. Search for **Piper TTS** (or manually install via [BRAT](https://github.com/TfTHacker/obsidian42-brat) using `RealThanosP/obsidian-piper-tts`).
4. Enable the plugin.

### Step 2: Download the Piper Engine
1. Go to the [Piper GitHub Releases page](https://github.com/rhasspy/piper/releases).
2. Download the latest `.tar.gz` or `.zip` file for your operating system:
   - **Windows:** `piper_windows_amd64.zip`
   - **MacOS:** Download the official [Piper - Neural TTS]() from the App Store.
   - **Mac (Intel):** `piper_macos_x64.tar.gz`
   - **Linux:** `piper_linux_x86_64.tar.gz`
3. Extract the downloaded folder to a safe location on your computer (e.g., `C:\Program Files\piper` or `/usr/local/bin/piper`).
4. In Obsidian, go to the **Piper TTS Settings** and enter the absolute path to the extracted `piper` executable. (e.g., `C:\Program Files\piper\piper.exe` or `/usr/local/bin/piper/piper`). 
   *(Note: If you have added piper to your system `PATH`, you can just leave this field blank!)*

### Step 3: Download a Voice Model
Piper uses `.onnx` model files to generate voices.
1. Browse the vast collection of voices at the official [Hugging Face Repository](https://huggingface.co/rhasspy/piper-voices/tree/main).
2. Navigate to your language (e.g., `en/en_US/` for English).
3. Download **both** the `.onnx` file AND its corresponding `.json` file (e.g., `en_US-amy-medium.onnx` and `en_US-amy-medium.onnx.json`).
4. Save them in a folder on your computer.
5. In Obsidian, go to **Piper TTS Settings**, click **"+ Add Language"**, type the 3-letter language code (e.g., `eng` for English, `ell` for Greek), and paste the absolute path to the `.onnx` file.

### Step 4 (Optional): Install FFmpeg for MP3 Support
By default, the plugin outputs `.wav` files. If you prefer smaller `.mp3` files, you must install FFmpeg.
- **Windows:** Download from [gyan.dev](https://www.gyan.dev/ffmpeg/builds/) or install via winget: `winget install ffmpeg`
- **Mac:** Install via Homebrew: `brew install ffmpeg`
- **Linux:** Install via package manager: `sudo apt install ffmpeg`
Once installed, change the "Output format" setting in the plugin to MP3.

---

## 🎧 How to Use

1. Open any Markdown note in Obsidian.
2. Click the **Headphones Icon** in the left ribbon to open the TTS Player sidebar.
3. Click the **Regenerate** button in the player.
4. The plugin will auto-detect the language of your note, generate the audio in the background, and load it into the player.
5. Hit **Play** and enjoy!

You can also highlight specific text in your note, press `Ctrl/Cmd + P` to open the Command Palette, and run **"Generate TTS for selected text"**.

---

## 🔧 Advanced Settings

- **Output Directory:** Choose where the generated audio files are saved (default is `_tts` in your vault root).
- **Sentence Silence:** Control the pause duration between sentences.
- **Speaker Index:** If you downloaded a multi-speaker model (like `vctk`), you can change this number to switch voices.

## 🤝 Contributing
Contributions, issues, and feature requests are welcome!

## 📝 License
This project is licensed under the MIT License.
