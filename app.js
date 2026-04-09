import { FilesetResolver, LlmInference } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@0.10.25';

const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@0.10.25/wasm';
const STORAGE_KEY_MODEL_URL = 'gemma3n_demo_model_url';
const STORAGE_KEY_CONTEXT = 'gemma3n_demo_context';
const TARGET_SAMPLE_RATE = 16000;
const MAX_AUDIO_CHUNK_SECONDS = 28;
const AUDIO_CHUNK_OVERLAP_SECONDS = 0.5;
const TRANSCRIPT_CLEANUP_MAX_TOKENS = 512;

/* ============================================================
   UI References
   ============================================================ */
const ui = {
  // Top bar
  burgerBtn: document.getElementById('burgerBtn'),
  statusBadge: document.getElementById('statusBadge'),
  statusText: document.getElementById('statusText'),

  // Sidebar
  sidebar: document.getElementById('sidebar'),
  sidebarOverlay: document.getElementById('sidebarOverlay'),
  modelUrl: document.getElementById('modelUrl'),
  modelFile: document.getElementById('modelFile'),
  initModelBtn: document.getElementById('initModelBtn'),
  disposeModelBtn: document.getElementById('disposeModelBtn'),
  modelProgress: document.getElementById('modelProgress'),
  modelProgressFill: document.getElementById('modelProgressFill'),
  modelProgressLabel: document.getElementById('modelProgressLabel'),
  maxTokens: document.getElementById('maxTokens'),
  temperature: document.getElementById('temperature'),
  specialty: document.getElementById('specialty'),
  noteStyle: document.getElementById('noteStyle'),
  contextNotes: document.getElementById('contextNotes'),
  audioFile: document.getElementById('audioFile'),
  log: document.getElementById('log'),

  // Main content
  welcomeCard: document.getElementById('welcomeCard'),
  welcomeTitle: document.getElementById('welcomeTitle'),
  welcomeMessage: document.getElementById('welcomeMessage'),
  recordingSection: document.getElementById('recordingSection'),
  waveformCanvas: document.getElementById('waveformCanvas'),
  waveformPlaceholder: document.getElementById('waveformPlaceholder'),
  recordingTimer: document.getElementById('recordingTimer'),
  recordBtn: document.getElementById('recordBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  stopBtn: document.getElementById('stopBtn'),
  clearAudioBtn: document.getElementById('clearAudioBtn'),
  uploadAudioBtnMain: document.getElementById('uploadAudioBtnMain'),
  audioPlayback: document.getElementById('audioPlayback'),
  audioPreview: document.getElementById('audioPreview'),
  audioDuration: document.getElementById('audioDuration'),
  audioRate: document.getElementById('audioRate'),
  audioChannels: document.getElementById('audioChannels'),

  // Generate
  generateBtn: document.getElementById('generateBtn'),
  generationProgress: document.getElementById('generationProgress'),
  generationStatus: document.getElementById('generationStatus'),
  cancelBtn: document.getElementById('cancelBtn'),

  // Output
  outputSection: document.getElementById('outputSection'),
  soapNote: document.getElementById('soapNote'),
  transcript: document.getElementById('transcript'),
  copySoapBtn: document.getElementById('copySoapBtn'),
  downloadSoapBtn: document.getElementById('downloadSoapBtn'),
  copyTranscriptBtn: document.getElementById('copyTranscriptBtn'),

  // Toast
  toastContainer: document.getElementById('toastContainer'),

  // Help modal
  helpBtn: document.getElementById('helpBtn'),
  helpModalOverlay: document.getElementById('helpModalOverlay'),
  helpModalClose: document.getElementById('helpModalClose'),

  // Theme toggle
  themeToggleBtn: document.getElementById('themeToggleBtn'),
};

/* ============================================================
   State
   ============================================================ */
const state = {
  genaiFileset: null,
  llm: null,
  busy: false,
  mediaRecorder: null,
  mediaStream: null,
  recordingMimeType: '',
  audioChunks: [],
  audioBlob: null,
  audioBuffer: null,
  audioContext: null,
  // Recording timer
  recordingStartTime: null,
  recordingElapsed: 0,
  timerInterval: null,
  // Waveform
  analyser: null,
  waveformAnimFrame: null,
  // Model progress simulation
  progressInterval: null,
};

/* ============================================================
   Logging
   ============================================================ */
function log(message) {
  const stamp = new Date().toLocaleTimeString();
  ui.log.textContent += `[${stamp}] ${message}\n`;
  ui.log.scrollTop = ui.log.scrollHeight;
}

/* ============================================================
   Toasts
   ============================================================ */
function showToast(message, type = 'info', duration = 3500) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  ui.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('out');
    toast.addEventListener('animationend', () => toast.remove());
  }, duration);
}

/* ============================================================
   Sidebar
   ============================================================ */
function toggleSidebar() {
  const isOpen = ui.sidebar.classList.toggle('open');
  ui.burgerBtn.classList.toggle('active', isOpen);
  ui.sidebarOverlay.classList.toggle('visible', isOpen);
}
function closeSidebar() {
  ui.sidebar.classList.remove('open');
  ui.burgerBtn.classList.remove('active');
  ui.sidebarOverlay.classList.remove('visible');
}

/* ============================================================
   Help Modal
   ============================================================ */
function openHelpModal() {
  ui.helpModalOverlay.classList.add('visible');
}
function closeHelpModal() {
  ui.helpModalOverlay.classList.remove('visible');
}

/* ============================================================
   Theme Toggle
   ============================================================ */
const STORAGE_KEY_THEME = 'medscribe_theme';

function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  html.setAttribute('data-theme', next);
  localStorage.setItem(STORAGE_KEY_THEME, next);
}

function restoreTheme() {
  const saved = localStorage.getItem(STORAGE_KEY_THEME);
  if (saved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  }
}

/* ============================================================
   Status Badge
   ============================================================ */
function setStatus(text, kind = '') {
  ui.statusText.textContent = text;
  ui.statusBadge.className = `status-badge ${kind}`;
}

/* ============================================================
   Welcome Card
   ============================================================ */
function updateWelcome() {
  if (state.llm) {
    ui.welcomeCard.classList.add('ready');
    ui.welcomeTitle.textContent = '✅ Ready to use';
    ui.welcomeMessage.textContent = 'Record or upload audio, then hit Generate to create your transcript and SOAP note.';
  } else {
    ui.welcomeCard.classList.remove('ready');
    ui.welcomeTitle.textContent = 'Welcome to MedScribe';
    ui.welcomeMessage.textContent = 'Open the sidebar menu to load your AI model. Once the model is ready, record or upload audio to generate transcriptions and SOAP notes — all locally in your browser.';
  }
}

/* ============================================================
   Audio Helpers (unchanged logic)
   ============================================================ */
function getAudioContext() {
  if (!state.audioContext) {
    state.audioContext = new AudioContext();
  }
  return state.audioContext;
}

function saveUserPrefs() {
  localStorage.setItem(STORAGE_KEY_MODEL_URL, ui.modelUrl.value.trim());
  localStorage.setItem(STORAGE_KEY_CONTEXT, ui.contextNotes.value);
}

function restoreUserPrefs() {
  const urlParam = new URL(window.location.href).searchParams.get('model');
  const defaultModelUrl = 'https://huggingface.co/Johnyquest7/gemma-3n-E2B-it-int4-Web.litertlm/resolve/main/gemma-3n-E2B-it-int4-Web.litertlm';
  ui.modelUrl.value = urlParam || localStorage.getItem(STORAGE_KEY_MODEL_URL) || defaultModelUrl;
  ui.contextNotes.value = localStorage.getItem(STORAGE_KEY_CONTEXT) || '';
}

function checkEnvironment() {
  const hasWebGpu = typeof navigator.gpu !== 'undefined';
  const isolated = window.crossOriginIsolated;

  if (hasWebGpu && isolated) {
    setStatus('Environment OK', 'info');
  } else if (!hasWebGpu) {
    setStatus('WebGPU not detected', 'error');
  } else {
    setStatus('Waiting for isolation…', 'loading');
  }

  return hasWebGpu && isolated;
}

/* ============================================================
   Button State Management
   ============================================================ */
function updateButtons() {
  const hasModel = !!state.llm;
  const hasAudio = !!state.audioBuffer;
  const hasTranscript = ui.transcript.value.trim().length > 0;
  const hasSoap = ui.soapNote.value.trim().length > 0;
  const isRecording = !!state.mediaRecorder;
  const isPaused = isRecording && state.mediaRecorder.state === 'paused';

  ui.disposeModelBtn.disabled = !hasModel || state.busy;
  ui.initModelBtn.disabled = state.busy;
  ui.recordBtn.disabled = state.busy || isRecording;
  ui.pauseBtn.disabled = !isRecording;
  ui.stopBtn.disabled = !isRecording;
  ui.clearAudioBtn.disabled = !hasAudio || state.busy || isRecording;
  ui.generateBtn.disabled = !hasModel || !hasAudio || state.busy;
  ui.cancelBtn.disabled = !state.busy || !state.llm;
  ui.copyTranscriptBtn.disabled = !hasTranscript;
  ui.copySoapBtn.disabled = !hasSoap;
  ui.downloadSoapBtn.disabled = !hasSoap;

  // Show/hide output section
  if (hasTranscript || hasSoap) {
    ui.outputSection.classList.add('visible');
  }

  // Recording section state
  ui.recordingSection.classList.toggle('active', isRecording && !isPaused);
  ui.recordingSection.classList.toggle('paused', isPaused);

  // Record button visual
  ui.recordBtn.classList.toggle('recording', isRecording && !isPaused);
}

function setBusy(isBusy) {
  state.busy = isBusy;
  updateButtons();
}

/* ============================================================
   Audio Decoding & Processing (unchanged logic)
   ============================================================ */
async function resampleAudioBuffer(inputBuffer, targetSampleRate = TARGET_SAMPLE_RATE) {
  if (inputBuffer.sampleRate === targetSampleRate) {
    return inputBuffer;
  }
  const duration = inputBuffer.duration;
  const targetLength = Math.max(1, Math.round(duration * targetSampleRate));
  const offlineContext = new OfflineAudioContext(1, targetLength, targetSampleRate);
  const source = offlineContext.createBufferSource();
  source.buffer = inputBuffer;
  source.connect(offlineContext.destination);
  source.start(0);
  return offlineContext.startRendering();
}

async function decodeBlobToMonoAudioBuffer(blob) {
  const audioContext = getAudioContext();
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
  const sourceArrayBuffer = await blob.arrayBuffer();
  const decoded = await audioContext.decodeAudioData(sourceArrayBuffer.slice(0));
  const mono = audioContext.createBuffer(1, decoded.length, decoded.sampleRate);
  const monoData = mono.getChannelData(0);

  if (decoded.numberOfChannels === 1) {
    monoData.set(decoded.getChannelData(0));
  } else {
    for (let i = 0; i < decoded.length; i += 1) {
      let sum = 0;
      for (let ch = 0; ch < decoded.numberOfChannels; ch += 1) {
        sum += decoded.getChannelData(ch)[i];
      }
      monoData[i] = sum / decoded.numberOfChannels;
    }
  }
  return resampleAudioBuffer(mono, TARGET_SAMPLE_RATE);
}

function sliceAudioBuffer(audioBuffer, startSeconds, endSeconds) {
  const startFrame = Math.max(0, Math.floor(startSeconds * audioBuffer.sampleRate));
  const endFrame = Math.min(audioBuffer.length, Math.ceil(endSeconds * audioBuffer.sampleRate));
  const frameCount = Math.max(1, endFrame - startFrame);
  const chunk = new AudioBuffer({
    length: frameCount,
    numberOfChannels: 1,
    sampleRate: audioBuffer.sampleRate,
  });
  const source = audioBuffer.getChannelData(0).subarray(startFrame, endFrame);
  chunk.getChannelData(0).set(source);
  return chunk;
}

function splitAudioBufferIntoChunks(audioBuffer, maxChunkSeconds = MAX_AUDIO_CHUNK_SECONDS, overlapSeconds = AUDIO_CHUNK_OVERLAP_SECONDS) {
  const chunks = [];
  const duration = audioBuffer.duration;

  if (duration <= maxChunkSeconds) {
    return [{
      buffer: audioBuffer,
      startSeconds: 0,
      endSeconds: duration,
      index: 1,
    }];
  }

  const stepSeconds = Math.max(1, maxChunkSeconds - overlapSeconds);
  let cursor = 0;
  let index = 1;

  while (cursor < duration) {
    const end = Math.min(duration, cursor + maxChunkSeconds);
    chunks.push({
      buffer: sliceAudioBuffer(audioBuffer, cursor, end),
      startSeconds: cursor,
      endSeconds: end,
      index,
    });
    if (end >= duration) break;
    cursor += stepSeconds;
    index += 1;
  }
  return chunks;
}

function secondsLabel(value) {
  return `${value.toFixed(1)}s`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

/* ============================================================
   Audio Blob Management
   ============================================================ */
async function setAudioBlob(blob) {
  state.audioBlob = blob;
  state.audioBuffer = await decodeBlobToMonoAudioBuffer(blob);

  if (ui.audioPreview.dataset.objectUrl) {
    URL.revokeObjectURL(ui.audioPreview.dataset.objectUrl);
    delete ui.audioPreview.dataset.objectUrl;
  }

  const objectUrl = URL.createObjectURL(blob);
  ui.audioPreview.src = objectUrl;
  ui.audioPreview.dataset.objectUrl = objectUrl;
  ui.audioDuration.textContent = formatDuration(state.audioBuffer.duration);
  ui.audioRate.textContent = `${state.audioBuffer.sampleRate} Hz`;
  ui.audioChannels.textContent = `${state.audioBuffer.numberOfChannels}`;
  ui.audioPlayback.classList.add('visible');
  log(`Loaded audio: ${formatDuration(state.audioBuffer.duration)}, ${state.audioBuffer.sampleRate} Hz`);
  updateButtons();
}

function clearAudio() {
  if (ui.audioPreview.dataset.objectUrl) {
    URL.revokeObjectURL(ui.audioPreview.dataset.objectUrl);
    delete ui.audioPreview.dataset.objectUrl;
  }
  state.audioBlob = null;
  state.audioBuffer = null;
  ui.audioPreview.removeAttribute('src');
  ui.audioPreview.load();
  ui.audioDuration.textContent = '—';
  ui.audioRate.textContent = '—';
  ui.audioChannels.textContent = '—';
  ui.audioPlayback.classList.remove('visible');
  ui.waveformPlaceholder.classList.remove('hidden');
  ui.waveformPlaceholder.textContent = '🎙 Ready to record';
  updateButtons();
}

/* ============================================================
   Model Initialization (with progress bar)
   ============================================================ */
function showModelProgress(indeterminate = true) {
  ui.modelProgress.classList.add('visible');
  if (indeterminate) {
    ui.modelProgressFill.classList.add('indeterminate');
    ui.modelProgressFill.style.width = '100%';
  }
}

function setModelProgress(pct, label) {
  ui.modelProgressFill.classList.remove('indeterminate');
  ui.modelProgressFill.style.width = `${pct}%`;
  if (label) ui.modelProgressLabel.textContent = label;
}

function hideModelProgress() {
  ui.modelProgress.classList.remove('visible');
  ui.modelProgressFill.classList.remove('indeterminate');
  ui.modelProgressFill.style.width = '0%';
}

async function initializeModel() {
  const envOk = checkEnvironment();
  if (!envOk) {
    throw new Error('Chrome must have WebGPU enabled and the page must be cross-origin isolated.');
  }

  const localFile = ui.modelFile.files?.[0] || null;
  const modelUrl = ui.modelUrl.value.trim();
  if (!localFile && !modelUrl) {
    throw new Error('Provide either a public model URL or a local .litertlm file.');
  }

  saveUserPrefs();
  setBusy(true);
  setStatus('Loading model…', 'loading');

  // Show progress bar
  showModelProgress(true);
  ui.modelProgressLabel.textContent = 'Resolving MediaPipe GenAI wasm…';
  log('Resolving MediaPipe GenAI wasm files.');

  if (!state.genaiFileset) {
    state.genaiFileset = await FilesetResolver.forGenAiTasks(WASM_ROOT);
  }

  ui.modelProgressLabel.textContent = 'Downloading and initializing model…';

  // Simulate progress ticks for user feedback
  let simulatedPct = 0;
  state.progressInterval = setInterval(() => {
    simulatedPct = Math.min(simulatedPct + Math.random() * 3, 90);
    setModelProgress(simulatedPct, 'Downloading and initializing model…');
  }, 800);

  const baseOptions = localFile
    ? { modelAssetBuffer: localFile.stream().getReader() }
    : { modelAssetPath: modelUrl };

  const options = {
    baseOptions,
    maxTokens: Number(ui.maxTokens.value) || 1536,
    topK: 40,
    temperature: Number(ui.temperature.value) || 0.2,
    randomSeed: 101,
    supportAudio: true,
  };

  log(localFile ? `Loading local model: ${localFile.name}` : `Loading from URL: ${modelUrl}`);
  state.llm = await LlmInference.createFromOptions(state.genaiFileset, options);

  // Finish progress
  clearInterval(state.progressInterval);
  setModelProgress(100, 'Model loaded!');
  setTimeout(hideModelProgress, 1500);

  setStatus('Ready', 'ready');
  log('Model initialized successfully.');
  showToast('✓ Model loaded — ready to use', 'success');
  setBusy(false);
  updateWelcome();
  updateButtons();
}

function disposeModel() {
  if (!state.llm) return;
  try {
    if (typeof state.llm.close === 'function') {
      state.llm.close();
    }
  } catch (error) {
    log(`Non-fatal unload warning: ${error.message}`);
  }
  state.llm = null;
  setStatus('Model unloaded', '');
  showToast('Model unloaded', 'info');
  updateWelcome();
  updateButtons();
}

/* ============================================================
   Waveform Visualizer
   ============================================================ */
function startWaveform(stream) {
  const audioCtx = getAudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const source = audioCtx.createMediaStreamSource(stream);
  state.analyser = audioCtx.createAnalyser();
  state.analyser.fftSize = 256;
  source.connect(state.analyser);

  const canvas = ui.waveformCanvas;
  const ctx = canvas.getContext('2d');
  const bufferLen = state.analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLen);

  function draw() {
    state.waveformAnimFrame = requestAnimationFrame(draw);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * (window.devicePixelRatio || 1);
    canvas.height = rect.height * (window.devicePixelRatio || 1);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    const W = rect.width;
    const H = rect.height;

    state.analyser.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, W, H);

    const barWidth = W / bufferLen;
    const centerY = H / 2;

    for (let i = 0; i < bufferLen; i++) {
      const v = dataArray[i] / 255;
      const barH = v * (H * 0.8);

      // Gradient color from teal to blue
      const r = Math.round(0 + v * 0);
      const g = Math.round(180 + v * 37);
      const b = Math.round(166 + v * 46);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.5 + v * 0.5})`;

      ctx.fillRect(i * barWidth, centerY - barH / 2, Math.max(barWidth - 1, 1), barH);
    }
  }
  draw();
}

function stopWaveform() {
  if (state.waveformAnimFrame) {
    cancelAnimationFrame(state.waveformAnimFrame);
    state.waveformAnimFrame = null;
  }
  state.analyser = null;

  // Clear canvas
  const canvas = ui.waveformCanvas;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/* ============================================================
   Recording Timer
   ============================================================ */
function startTimer() {
  state.recordingStartTime = Date.now();
  state.recordingElapsed = 0;
  ui.recordingTimer.textContent = '00:00';
  ui.recordingTimer.classList.add('visible', 'active');
  ui.recordingTimer.classList.remove('paused');

  state.timerInterval = setInterval(() => {
    if (state.mediaRecorder && state.mediaRecorder.state === 'paused') return;
    state.recordingElapsed = Date.now() - state.recordingStartTime;
    const totalSec = Math.floor(state.recordingElapsed / 1000);
    const mins = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const secs = (totalSec % 60).toString().padStart(2, '0');
    ui.recordingTimer.textContent = `${mins}:${secs}`;
  }, 250);
}

function stopTimer() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  ui.recordingTimer.classList.remove('active', 'paused');
  // Keep visible showing final time
}

/* ============================================================
   Recording Controls
   ============================================================ */
function getSupportedRecordingMimeType() {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  for (const type of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone recording not available in this browser.');
  }

  clearAudio();
  state.audioChunks = [];
  state.recordingMimeType = getSupportedRecordingMimeType();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      noiseSuppression: true,
      echoCancellation: true,
      autoGainControl: true,
    },
  });
  state.mediaStream = stream;

  state.mediaRecorder = state.recordingMimeType
    ? new MediaRecorder(stream, { mimeType: state.recordingMimeType })
    : new MediaRecorder(stream);

  state.mediaRecorder.ondataavailable = (event) => {
    if (event.data?.size) {
      state.audioChunks.push(event.data);
    }
  };

  state.mediaRecorder.onstop = async () => {
    try {
      const blob = new Blob(state.audioChunks, {
        type: state.recordingMimeType || state.mediaRecorder?.mimeType || 'audio/webm',
      });
      await setAudioBlob(blob);
      log('Recording stopped and audio decoded successfully.');
      showToast('Recording saved', 'success');
      ui.waveformPlaceholder.textContent = '✓ Audio ready';
      ui.waveformPlaceholder.classList.remove('hidden');
    } catch (error) {
      log(`Failed to decode recorded audio: ${error.message}`);
      showToast(`Audio decode error: ${error.message}`, 'error');
    } finally {
      state.mediaStream?.getTracks().forEach((track) => track.stop());
      state.mediaStream = null;
      state.mediaRecorder = null;
      state.audioChunks = [];
      stopWaveform();
      stopTimer();
      updateButtons();
    }
  };

  state.mediaRecorder.start();
  log('Recording started.');
  ui.waveformPlaceholder.classList.add('hidden');
  startWaveform(stream);
  startTimer();
  setStatus('Recording…', 'loading');
  updateButtons();
}

function pauseRecording() {
  if (!state.mediaRecorder) return;
  if (state.mediaRecorder.state === 'recording') {
    state.mediaRecorder.pause();
    ui.recordingTimer.classList.add('paused');
    ui.recordingTimer.classList.remove('active');
    ui.pauseBtn.textContent = '▶';
    ui.pauseBtn.title = 'Resume';
    setStatus('Paused', 'loading');
    log('Recording paused.');
  } else if (state.mediaRecorder.state === 'paused') {
    state.mediaRecorder.resume();
    // Adjust start time so timer continues correctly
    state.recordingStartTime = Date.now() - state.recordingElapsed;
    ui.recordingTimer.classList.remove('paused');
    ui.recordingTimer.classList.add('active');
    ui.pauseBtn.textContent = '⏸';
    ui.pauseBtn.title = 'Pause';
    setStatus('Recording…', 'loading');
    log('Recording resumed.');
  }
  updateButtons();
}

function stopRecording() {
  if (!state.mediaRecorder) return;
  state.mediaRecorder.stop();
  setStatus(state.llm ? 'Ready' : 'Model not loaded', state.llm ? 'ready' : '');
  log('Stopping recording…');
}

async function loadAudioFile(file) {
  clearAudio();
  await setAudioBlob(file);
  ui.waveformPlaceholder.textContent = '✓ Audio ready';
  showToast('Audio file loaded', 'success');
}

/* ============================================================
   Prompt Building (unchanged logic)
   ============================================================ */
function wrapUserTurn(content) {
  return `<start_of_turn>user\n${content}<end_of_turn>\n<start_of_turn>model\n`;
}

function buildTranscriptPrompt(audioBuffer, metadata = {}) {
  const specialty = ui.specialty.value === 'Custom' ? 'medical' : ui.specialty.value;
  const context = ui.contextNotes.value.trim();
  const prefixLines = [
    `You are an on-device ${specialty} medical transcription assistant.`,
    'Transcribe the attached dictated clinical audio into a clean, faithful transcript.',
    'Rules:',
    '- Do not invent information.',
    '- Keep medical terms, drug names, numbers, and units when spoken.',
    '- If a segment is unclear, write [inaudible] rather than guessing.',
    '- Remove filler words only when they do not change meaning.',
    '- Return only the transcript and no preamble.',
  ];

  if (metadata.total && metadata.total > 1) {
    prefixLines.push(`This is chunk ${metadata.index} of ${metadata.total}, covering approximately ${secondsLabel(metadata.startSeconds)} to ${secondsLabel(metadata.endSeconds)} of the full recording.`);
    prefixLines.push('Transcribe only this chunk. Do not summarize prior or future chunks.');
  }

  if (context) {
    prefixLines.push(`Additional context: ${context}`);
  }

  return [
    '<start_of_turn>user\n',
    `${prefixLines.join('\n')}\n`,
    { audioSource: audioBuffer },
    '<end_of_turn>\n<start_of_turn>model\n',
  ];
}

function buildTranscriptCleanupPrompt(combinedTranscript) {
  return wrapUserTurn([
    'You are cleaning a multi-part medical transcript that came from overlapping audio chunks.',
    'Rewrite it as one continuous clean transcript.',
    'Rules:',
    '- Remove duplicated words, phrases, or sentences caused by overlapping chunk boundaries.',
    '- Preserve the original meaning and wording as much as possible.',
    '- Do not add new clinical facts.',
    '- Return only the cleaned transcript and no preamble.',
    '',
    'Transcript to clean:',
    combinedTranscript,
  ].join('\n'));
}

function buildSoapPrompt(transcript) {
  const specialty = ui.specialty.value;
  const noteStyle = ui.noteStyle.value;
  const context = ui.contextNotes.value.trim();

  return wrapUserTurn([
    `You are an expert ${specialty} clinical documentation assistant.`,
    `Create a ${noteStyle} SOAP note from the transcript below.`,
    'Rules:',
    '- Use only information present in the transcript.',
    '- Never fabricate vitals, lab values, exam findings, medication doses, diagnoses, or follow-up intervals.',
    '- If information is missing, explicitly write "Not stated."',
    '- Use clear section headers: Subjective, Objective, Assessment, Plan.',
    '- In Assessment and Plan, organize problems as numbered items when possible.',
    '- Keep the note clinically polished and easy to read.',
    '- Output plain text only. Do NOT use markdown formatting such as **, ##, *, or any other markdown syntax. Use plain text headers, dashes for lists, and numbered items. The output must be ready to paste directly into an EMR or clinical note without any formatting artifacts.',
    context ? `Additional context: ${context}` : '',
    '',
    'Transcript:',
    transcript,
  ].filter(Boolean).join('\n'));
}

/* ============================================================
   Generation (with progress spinner)
   ============================================================ */
async function generateText(input, outputElement, options = {}) {
  if (!state.llm) {
    throw new Error('Model is not initialized.');
  }

  setBusy(true);
  outputElement.value = '';

  try {
    await new Promise((resolve, reject) => {
      let settled = false;
      state.llm.generateResponse(
        input,
        (partialResult, done) => {
          outputElement.value += partialResult;
          if (done && !settled) {
            settled = true;
            resolve();
          }
        },
        options,
      ).catch((error) => {
        if (!settled) {
          settled = true;
          reject(error);
        }
      });
    });
  } catch (error) {
    setBusy(false);
    updateButtons();
    throw error;
  }

  setBusy(false);
  updateButtons();
}

async function transcribeAudio() {
  if (!state.audioBuffer) {
    throw new Error('No audio available.');
  }

  const chunks = splitAudioBufferIntoChunks(state.audioBuffer);
  log(`Starting transcription${chunks.length > 1 ? ` in ${chunks.length} chunks` : ''}.`);

  if (chunks.length === 1) {
    await generateText(buildTranscriptPrompt(state.audioBuffer), ui.transcript);
    ui.transcript.value = ui.transcript.value.trim();
    log('Transcription finished.');
    updateButtons();
    return;
  }

  const transcripts = [];
  const perChunkMaxTokens = Math.max(256, Number(ui.maxTokens.value) || 1536);

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    const tmpOutput = { value: '' };
    log(`Transcribing chunk ${i + 1}/${chunks.length} (${secondsLabel(chunk.startSeconds)}–${secondsLabel(chunk.endSeconds)}).`);
    ui.generationStatus.textContent = `Transcribing chunk ${i + 1} of ${chunks.length}…`;
    await generateText(
      buildTranscriptPrompt(chunk.buffer, {
        index: i + 1,
        total: chunks.length,
        startSeconds: chunk.startSeconds,
        endSeconds: chunk.endSeconds,
      }),
      tmpOutput,
      { maxTokens: perChunkMaxTokens },
    );
    transcripts.push(tmpOutput.value.trim());
    ui.transcript.value = transcripts.filter(Boolean).join('\n');
  }

  const combinedTranscript = transcripts.filter(Boolean).join('\n');
  log('Cleaning merged transcript to remove overlap duplicates.');
  ui.generationStatus.textContent = 'Cleaning transcript…';
  await generateText(
    buildTranscriptCleanupPrompt(combinedTranscript),
    ui.transcript,
    { maxTokens: TRANSCRIPT_CLEANUP_MAX_TOKENS },
  );
  ui.transcript.value = ui.transcript.value.trim();
  log('Transcription finished.');
  updateButtons();
}

async function generateSoap() {
  const transcript = ui.transcript.value.trim();
  if (!transcript) {
    throw new Error('Transcript is empty.');
  }
  log('Generating SOAP note.');
  ui.generationStatus.textContent = 'Generating SOAP note…';
  await generateText(buildSoapPrompt(transcript), ui.soapNote);
  ui.soapNote.value = ui.soapNote.value.trim();
  log('SOAP note generation finished.');
  updateButtons();
}

async function runAll() {
  // Show spinner and status IMMEDIATELY (synchronous) before any async work
  ui.generateBtn.disabled = true;
  ui.generationProgress.classList.add('visible');
  ui.generationStatus.textContent = 'Preparing transcription…';
  ui.cancelBtn.disabled = false;
  setStatus('Generating…', 'loading');
  ui.outputSection.classList.add('visible');

  // Yield to browser to render the spinner before heavy async work
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  try {
    ui.generationStatus.textContent = 'Transcribing audio…';
    await transcribeAudio();
    ui.generationStatus.textContent = 'Generating SOAP note…';
    await generateSoap();
    showToast('✓ Transcript & SOAP note generated', 'success');
    setStatus('Ready', 'ready');
  } catch (error) {
    setStatus('Ready', 'ready');
    throw error;
  } finally {
    ui.generationProgress.classList.remove('visible');
  }
}

/* ============================================================
   Utility Actions
   ============================================================ */
function audioFileName() {
  return `${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}-soap-note.txt`;
}

async function copyText(text, label) {
  await navigator.clipboard.writeText(text);
  log(`${label} copied to clipboard.`);
  showToast(`${label} copied`, 'info');
}

function downloadSoapNote() {
  const blob = new Blob([ui.soapNote.value], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = audioFileName();
  anchor.click();
  URL.revokeObjectURL(url);
  log('SOAP note downloaded.');
  showToast('SOAP note downloaded', 'success');
}

function cancelGeneration() {
  if (!state.llm) return;
  try {
    state.llm.cancelProcessing();
    log('Generation cancelled.');
    showToast('Generation cancelled', 'info');
  } catch (error) {
    log(`Cancel warning: ${error.message}`);
  } finally {
    setBusy(false);
    ui.generationProgress.classList.remove('visible');
    setStatus('Ready', 'ready');
    updateButtons();
  }
}

/* ============================================================
   Error Wrapper
   ============================================================ */
async function safeAction(fn) {
  try {
    await fn();
  } catch (error) {
    log(`Error: ${error.message}`);
    showToast(error.message, 'error', 5000);
    setBusy(false);
    ui.generationProgress.classList.remove('visible');
    updateButtons();
  }
}

/* ============================================================
   Event Binding
   ============================================================ */
function bindEvents() {
  // Sidebar
  ui.burgerBtn.addEventListener('click', toggleSidebar);
  ui.sidebarOverlay.addEventListener('click', closeSidebar);

  // Help modal
  ui.helpBtn.addEventListener('click', openHelpModal);
  ui.helpModalClose.addEventListener('click', closeHelpModal);
  ui.helpModalOverlay.addEventListener('click', (e) => {
    if (e.target === ui.helpModalOverlay) closeHelpModal();
  });

  // Theme toggle
  ui.themeToggleBtn.addEventListener('click', toggleTheme);

  // Model
  ui.initModelBtn.addEventListener('click', () => safeAction(initializeModel));
  ui.disposeModelBtn.addEventListener('click', () => disposeModel());

  // Recording
  ui.recordBtn.addEventListener('click', () => safeAction(startRecording));
  ui.pauseBtn.addEventListener('click', () => pauseRecording());
  ui.stopBtn.addEventListener('click', () => stopRecording());
  ui.clearAudioBtn.addEventListener('click', () => clearAudio());

  // Upload audio (main shortcut button)
  ui.uploadAudioBtnMain.addEventListener('click', () => {
    ui.audioFile.click();
  });

  // Audio file change (sidebar or triggered)
  ui.audioFile.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (file) {
      await safeAction(() => loadAudioFile(file));
    }
  });

  // Generate
  ui.generateBtn.addEventListener('click', () => safeAction(runAll));
  ui.cancelBtn.addEventListener('click', () => cancelGeneration());

  // Copy / download
  ui.copyTranscriptBtn.addEventListener('click', () => safeAction(() => copyText(ui.transcript.value, 'Transcript')));
  ui.copySoapBtn.addEventListener('click', () => safeAction(() => copyText(ui.soapNote.value, 'SOAP note')));
  ui.downloadSoapBtn.addEventListener('click', () => downloadSoapNote());

  // Track edits in output
  ui.transcript.addEventListener('input', updateButtons);
  ui.soapNote.addEventListener('input', updateButtons);

  // Prefs
  ui.modelUrl.addEventListener('change', saveUserPrefs);
  ui.contextNotes.addEventListener('change', saveUserPrefs);
}

/* ============================================================
   Init
   ============================================================ */
function init() {
  restoreTheme();
  restoreUserPrefs();
  bindEvents();
  checkEnvironment();
  updateButtons();
  updateWelcome();
  log('App loaded.');
  log(`WebGPU available: ${typeof navigator.gpu !== 'undefined'}`);
  log(`crossOriginIsolated: ${window.crossOriginIsolated}`);
}

init();
