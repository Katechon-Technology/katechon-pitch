const AGENT_ID          = 'agent_2401kc7w0sbhfjw9xesyb9xxxm00';
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 16000; // ElevenLabs default output: PCM 16-bit mono 16kHz

// ── DOM refs ──────────────────────────────────────────────────────────────────
const btn             = document.getElementById('pitchBtn');
const btnLabel        = document.getElementById('btnLabel');
const statusEl        = document.getElementById('pitchStatus');
const avatarWrap      = document.getElementById('pitchAvatarWrap');
const avatarIframe    = document.getElementById('pitchAvatar');
const transcriptInner = document.getElementById('transcriptInner');

// ── State ─────────────────────────────────────────────────────────────────────
let ws            = null;
let micStream     = null;
let micCtx        = null;
let processorNode = null;
let connected     = false;

// ── Playback ──────────────────────────────────────────────────────────────────
let playCtx      = null;
let playAnalyser = null;
let nextPlayTime = 0;
let rmsRafId     = null;

function ensurePlayCtx() {
  if (playCtx) return;
  playCtx = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
  playAnalyser = playCtx.createAnalyser();
  playAnalyser.fftSize = 256;
  playAnalyser.connect(playCtx.destination);
  startRmsLoop();
}

function startRmsLoop() {
  const data = new Float32Array(playAnalyser.fftSize);
  function tick() {
    playAnalyser.getFloatTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    const rms = Math.min(1, Math.sqrt(sum / data.length) * 3);
    avatarIframe?.contentWindow?.postMessage({ type: 'rms', value: rms }, '*');
    rmsRafId = requestAnimationFrame(tick);
  }
  rmsRafId = requestAnimationFrame(tick);
}

// Directly create AudioBuffer from raw PCM16 LE bytes — no decodeAudioData needed.
function pcmBase64ToAudioBuffer(b64) {
  const binary = atob(b64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const numSamples  = Math.floor(bytes.length / 2);
  const audioBuffer = playCtx.createBuffer(1, numSamples, OUTPUT_SAMPLE_RATE);
  const channel     = audioBuffer.getChannelData(0);
  const view        = new DataView(bytes.buffer);
  for (let i = 0; i < numSamples; i++) {
    channel[i] = view.getInt16(i * 2, true) / 32768; // PCM16 LE → float32
  }
  return audioBuffer;
}

function queueAudioChunk(b64) {
  ensurePlayCtx();
  if (playCtx.state === 'suspended') playCtx.resume();
  try {
    const audioBuffer = pcmBase64ToAudioBuffer(b64);
    const source = playCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(playAnalyser);

    const now     = playCtx.currentTime;
    const startAt = Math.max(now + 0.005, nextPlayTime);
    source.start(startAt);
    nextPlayTime = startAt + audioBuffer.duration;
  } catch (e) {
    console.error('[pitch] audio queue error:', e);
  }
}

function stopPlayback() {
  nextPlayTime = 0;
  if (rmsRafId) { cancelAnimationFrame(rmsRafId); rmsRafId = null; }
  if (playCtx)  { playCtx.close(); playCtx = null; playAnalyser = null; }
  avatarIframe?.contentWindow?.postMessage({ type: 'rms', value: 0 }, '*');
}

// ── Status / transcript ───────────────────────────────────────────────────────
function setStatus(state, label) {
  statusEl.textContent = label;
  statusEl.dataset.state = state;
  avatarWrap.dataset.mode = state === 'speaking' ? 'speaking' : state === 'listening' ? 'listening' : '';
}

function addTranscriptLine(source, text) {
  if (!text?.trim()) return;
  const line = document.createElement('div');
  line.className = `transcript-line ${source}`;
  line.innerHTML = `<span class="tl-source">${source === 'agent' ? 'MAO' : 'YOU'}</span>${text}`;
  transcriptInner.appendChild(line);
  while (transcriptInner.children.length > 4) transcriptInner.removeChild(transcriptInner.firstChild);
}

// ── Microphone → PCM16 → WebSocket ───────────────────────────────────────────
async function startMic() {
  micStream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  });

  const track = micStream.getAudioTracks()[0];
  console.log('[pitch] mic track:', track?.label, 'muted:', track?.muted, 'enabled:', track?.enabled, 'state:', track?.readyState);

  micCtx = new AudioContext();
  console.log('[pitch] micCtx state:', micCtx.state, 'sampleRate:', micCtx.sampleRate);
  if (micCtx.state === 'suspended') await micCtx.resume();
  console.log('[pitch] micCtx state after resume:', micCtx.state);

  const source = micCtx.createMediaStreamSource(micStream);

  // ScriptProcessorNode — deprecated but reliably in the pull graph and fires
  // onaudioprocess even without exotic graph tricks.
  const NATIVE_RATE  = micCtx.sampleRate;
  const TARGET_RATE  = 16000;
  const ratio        = NATIVE_RATE / TARGET_RATE;
  const BUF_SIZE     = 4096;
  const FRAME        = 1600; // 100ms at 16kHz

  processorNode = micCtx.createScriptProcessor(BUF_SIZE, 1, 1);

  let frac = 0, acc = 0, n = 0, outBuf = [], chunksSent = 0;

  processorNode.onaudioprocess = (evt) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const ch = evt.inputBuffer.getChannelData(0);

    for (let i = 0; i < ch.length; i++) {
      acc += ch[i]; n++; frac++;
      if (frac >= ratio) {
        frac -= ratio;
        outBuf.push(n > 0 ? acc / n : 0);
        acc = 0; n = 0;
      }
    }

    while (outBuf.length >= FRAME) {
      const f32 = new Float32Array(outBuf.splice(0, FRAME));
      if (chunksSent % 20 === 0) {
        let sum = 0;
        for (let j = 0; j < f32.length; j++) sum += f32[j] * f32[j];
        console.log('[pitch] mic chunk', chunksSent, 'RMS:', Math.sqrt(sum / f32.length).toFixed(5));
      }
      const pcm   = float32ToPcm16(f32);
      const bytes = new Uint8Array(pcm.buffer);
      let binary  = '';
      for (let j = 0; j < bytes.length; j++) binary += String.fromCharCode(bytes[j]);
      ws.send(JSON.stringify({ user_audio_chunk: btoa(binary) }));
      chunksSent++;
    }
  };

  // ScriptProcessorNode must be in the pull graph; route through a silent gain
  // so no mic audio reaches speakers while still forcing graph traversal.
  const silentSink = micCtx.createGain();
  silentSink.gain.value = 0;
  processorNode.connect(silentSink);
  silentSink.connect(micCtx.destination);

  source.connect(processorNode);
  console.log('[pitch] mic pipeline ready (ScriptProcessor)');
}

function stopMic() {
  if (processorNode) { processorNode.disconnect(); processorNode = null; }
  if (micCtx)        { micCtx.close();             micCtx = null; }
  if (micStream)     { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
}

function float32ToPcm16(f32) {
  const out = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return out;
}

// ── WebSocket ─────────────────────────────────────────────────────────────────
async function connect() {
  btn.classList.add('connecting');
  btnLabel.textContent = 'CONNECTING';
  setStatus('connecting', 'CONNECTING');

  let wsUrl;
  try {
    const resp = await fetch('/api/elevenlabs-token');
    if (resp.ok) ({ signed_url: wsUrl } = await resp.json());
  } catch {}
  if (!wsUrl) wsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${AGENT_ID}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = async () => {
    connected = true;
    btn.classList.remove('connecting');
    btn.classList.add('active');
    btnLabel.textContent = 'DISCONNECT';
    setStatus('listening', 'LISTENING');
    try {
      await startMic();
    } catch (err) {
      const name = err?.name || '';
      const msg = name === 'NotAllowedError' ? 'Mic blocked — allow microphone access and reconnect.'
                : name === 'NotFoundError'   ? 'No microphone found.'
                : `Mic error: ${err?.message || err}`;
      addTranscriptLine('agent', msg);
      console.error('[pitch] mic:', name, err);
    }
  };

  ws.onmessage = (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }

    switch (msg.type) {
      case 'conversation_initiation_metadata':
        console.log('[pitch] session', msg.conversation_initiation_metadata_event);
        break;

      case 'audio': {
        const b64 = msg.audio_event?.audio_base_64;
        if (b64) queueAudioChunk(b64);
        setStatus('speaking', 'SPEAKING');
        break;
      }

      case 'agent_response':
        addTranscriptLine('agent', msg.agent_response_event?.agent_response);
        break;

      case 'user_transcript': {
        const t = msg.user_transcription_event?.user_transcript;
        console.log('[pitch] user_transcript:', JSON.stringify(t), msg);
        addTranscriptLine('user', t);
        setStatus('listening', 'LISTENING');
        break;
      }

      case 'interruption':
        stopPlayback();
        setStatus('listening', 'LISTENING');
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', event_id: msg.ping_event?.event_id }));
        break;

      case 'client_tool_call':
        ws.send(JSON.stringify({ type: 'client_tool_result', tool_call_id: msg.client_tool_call?.tool_call_id, result: 'unavailable', is_error: false }));
        break;

      default:
        console.log('[pitch] msg:', msg.type, msg);
    }
  };

  ws.onclose = (e) => { console.log('[pitch] ws closed', e.code, e.reason); disconnect(false); };
  ws.onerror = (e) => { console.error('[pitch] ws error', e); setStatus('error', 'ERROR'); };
}

function disconnect(closeWs = true) {
  connected = false;
  stopMic();
  stopPlayback();
  if (closeWs && ws?.readyState === WebSocket.OPEN) ws.close();
  ws = null;
  btn.classList.remove('active', 'connecting');
  btnLabel.textContent = 'CONNECT';
  setStatus('offline', 'OFFLINE');
}

btn.addEventListener('click', () => { if (connected) disconnect(); else connect(); });
