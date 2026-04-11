# MedScribe - Technical demo of what is possible on device. 

**On-device AI medical transcription & SOAP note generation — runs entirely in your browser.**

MedScribe uses [Gemma 3n E2B](https://ai.google.dev/gemma) with WebGPU to transcribe clinical audio and generate structured SOAP notes, all locally in Chrome. No data ever leaves your device.

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

1. Visit the [live demo](https://johnyquest7.github.io/MedScribe/) or clone this repo
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

## ⚠️ Disclaimer

**This application is experimental software intended for research and development purposes only. It is not intended for production clinical use.**

- This software is **not intended to replace professional medical judgment**. It is provided for informational and educational purposes only.
- All AI-generated transcriptions and SOAP notes **must be reviewed, verified, and approved by a licensed healthcare professional** before any clinical use.
- This software has **not been cleared or approved** by the FDA, CE, or any other medical device or software licensing agency.
- No LLM-based note generator should be trusted without human verification.

## 🔒 Privacy & Data Handling

MedScribe is designed with privacy in mind — **all audio processing, transcription, and SOAP note generation occurs entirely on your local device**. No data is transmitted to any external server or cloud service.

However, please note:

- **This software does not claim HIPAA compliance.** HIPAA compliance encompasses administrative, physical, and technical safeguards that extend far beyond the software itself and are the responsibility of the deploying organization.
- **Do not use this software to process Protected Health Information (PHI)** in a production clinical setting without first ensuring your deployment environment meets all applicable regulatory requirements (HIPAA, HITECH, state privacy laws, etc.).
- The developers of MedScribe are not responsible for how this software is deployed or used. Organizations deploying this tool in a clinical context are solely responsible for ensuring compliance with all applicable healthcare regulations.

## 📄 License

Licensed under [Apache 2.0](LICENSE).

This software is provided **"AS IS"** without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages, or other liability arising from the use of this software.
