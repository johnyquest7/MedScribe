# MedScribe

**On-device AI medical transcription & SOAP note generation — runs entirely in your browser.**

MedScribe uses [Gemma 3n E2B](https://ai.google.dev/gemma) with WebGPU to transcribe clinical audio and generate structured SOAP notes, all locally in Chrome. No data ever leaves your device.

![MedScribe Screenshot](https://raw.githubusercontent.com/prePhilip/MedScribe/main/screenshot.png)

## Features

- 🎙 **Record or upload** clinical audio directly in Chrome
- 📝 **AI transcription** using Gemma 3n with audio understanding
- 📋 **SOAP note generation** — structured clinical notes from transcripts
- 🔒 **100% local** — no server calls, no data uploads, complete privacy
- 🌙 **Dark & light mode** toggle
- ❓ **Built-in help** with step-by-step onboarding
- ⏸ **Pause/resume** recording support
- 📊 **Live waveform** visualizer during recording
- ⚡ **Progress indicators** for model loading and AI generation

## Requirements

- **Chrome 128+** with WebGPU enabled
- **8 GB+ GPU VRAM** recommended
- The model is [hosted on Hugging Face](https://huggingface.co/Johnyquest7/gemma-3n-E2B-it-int4-Web.litertlm) and pre-loaded in the app (~2.9 GB, downloads to GPU memory)

## Quick Start

1. Visit the [live demo](https://prephilip.github.io/MedScribe/) or clone this repo
2. Open the **☰ sidebar** and click **Initialize Model** (the model URL is pre-filled)
3. Wait for the model to load (~2.9 GB download)
4. **Record** or upload audio
5. Click **Generate Transcript & SOAP Note**

## Running Locally

Serve with any static HTTP server:

```bash
npx http-server . -p 8090 --cors -c-1
```

Then open `http://localhost:8090` in Chrome.

## GitHub Pages

This app is designed to be hosted as a GitHub Page. The included `coi-serviceworker.js` handles cross-origin isolation required for WebGPU + SharedArrayBuffer.

## Tech Stack

- Vanilla HTML/CSS/JS — no build step required
- [MediaPipe GenAI](https://developers.google.com/mediapipe) for on-device LLM inference
- WebGPU for GPU-accelerated model execution
- Web Audio API for recording and waveform visualization

## Disclaimer

⚠️ **Research use only.** Review all output before clinical use. No LLM note generator should be trusted without human verification.

## License

MIT
