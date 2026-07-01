# Obsidian Piper TTS

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

1. Open Obsidian and go to **Settings > Community Plugins**.
2. Turn off Safe Mode (if it isn't already).
3. Search for **Piper TTS**.
4. Click **Install** and then **Enable** the plugin.

### First-Time Setup (One-Click Auto-Install)
When you enable the plugin for the first time, an onboarding wizard will appear. 
- Click **"Start Setup"**, and the plugin will automatically download everything it needs to run completely offline (the Piper TTS engine, FFmpeg for MP3 support, and the default English voice model).
- The download may take a couple of minutes depending on your internet connection. 
- Once finished, you are ready to start generating audio!

*Note: If you want to use custom voice models or languages, you can still add them manually in the plugin settings by downloading `.onnx` and `.json` files from the [Hugging Face Repository](https://huggingface.co/rhasspy/piper-voices/tree/main).*

### Manual Installation

If the auto-installer fails or you prefer to manage the binaries yourself, you can install the dependencies manually:

**1. Download the Piper Engine**
- Go to the [Piper GitHub Releases page](https://github.com/rhasspy/piper/releases).
- Download the latest `.tar.gz` or `.zip` file for your operating system (ex. `piper_windows_amd64.zip`).
- Extract the folder to a safe location on your computer.
- In Obsidian, go to the **Piper TTS Settings** and enter the absolute path to the extracted `piper` executable. *(If it's in your system `PATH`, leave this blank).*

**2. Download a Voice Model**
- Browse the official [Hugging Face Repository](https://huggingface.co/rhasspy/piper-voices/tree/main).
- Download **both** the `.onnx` file AND its corresponding `.json` file.
- In Obsidian **Piper TTS Settings**, click **"+ Add Language"**, type the language code, and paste the absolute path to the `.onnx` file.

**3. Install FFmpeg (Optional for MP3)**
- **Windows:** Download from [gyan.dev](https://www.gyan.dev/ffmpeg/builds/) or install via winget: `winget install ffmpeg`
- **Mac:** Install via Homebrew: `brew install ffmpeg`
- **Linux:** Install via package manager: `sudo apt install ffmpeg`

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
