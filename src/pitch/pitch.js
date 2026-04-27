const AGENT_ID   = 'agent_2401kc7w0sbhfjw9xesyb9xxxm00';
const BRANCH_ID  = 'agtbrch_7601kc7w0t9kf2x8cvmeaw0y7thg';
// PCM format ElevenLabs expects for input
const INPUT_SAMPLE_RATE  = 16000;
const INPUT_FRAME_MS     = 100;   // chunk size sent per interval

// ── DOM refs ──────────────────────────────────────────────────────────────────
const btn             = document.getElementById('pitchBtn');
const btnLabel        = document.getElementById('btnLabel');
const statusEl        = document.getElementById('pitchStatus');
const avatarWrap      = document.getElementById('pitchAvatarWrap');
const avatarIframe    = document.getElementById('pitchAvatar');
const transcriptInner = document.getElementById('transcriptInner');

// ── State ─────────────────────────────────────────────────────────────────────
let ws           = null;
let micStream    = null;
let audioCtx     = null;
let processorNode= null;
let connected    = false;
let audioQueue   = [];    // queued PCM chunks from agent while avatar not ready
let avatarReady  = false;
let pendingAudio = [];    // accumulated audio chunks for current utterance

// ── Avatar ready handshake ────────────────────────────────────────────────────
window.addEventListener('message', (e) => {
  if (e.data?.type === 'avatar-ready') {
    avatarReady = true;
    // flush any audio that arrived before the iframe was ready
    pendingAudio.forEach(chunk => sendAudioToAvatar(chunk));
    pendingAudio = [];
  }
});

function sendAudioToAvatar(base64Audio) {
  if (!avatarIframe?.contentWindow) return;
  avatarIframe.contentWindow.postMessage({ type: 'audio', audio: base64Audio }, '*');
}

// ── Status helpers ────────────────────────────────────────────────────────────
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
  // Keep only last 4 lines
  while (transcriptInner.children.length > 4) {
    transcriptInner.removeChild(transcriptInner.firstChild);
  }
}

// ── Microphone → PCM → WebSocket ─────────────────────────────────────────────
async function startMic() {
  micStream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: INPUT_SAMPLE_RATE, channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  audioCtx  = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
  const source = audioCtx.createMediaStreamSource(micStream);

  await audioCtx.audioWorklet.addModule('/src/pitch/pcm-processor.js');
  processorNode = new AudioWorkletNode(audioCtx, 'pcm-processor');

  processorNode.port.onmessage = (e) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    // e.data is a Float32Array → convert to PCM16 → base64
    const pcm = float32ToPcm16(e.data);
    const b64 = btoa(String.fromCharCode(...new Uint8Array(pcm.buffer)));
    ws.send(JSON.stringify({ user_audio_chunk: b64 }));
  };

  source.connect(processorNode);
  processorNode.connect(audioCtx.destination); // needed for worklet to run
}

function stopMic() {
  if (processorNode) { processorNode.disconnect(); processorNode = null; }
  if (audioCtx)      { audioCtx.close();           audioCtx = null; }
  if (micStream)     { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
}

function float32ToPcm16(float32) {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return out;
}

// ── WebSocket conversation ────────────────────────────────────────────────────
async function connect() {
  btn.classList.add('connecting');
  btnLabel.textContent = 'CONNECTING';
  setStatus('connecting', 'CONNECTING');

  let wsUrl;
  try {
    const resp = await fetch('/api/elevenlabs-token');
    if (resp.ok) {
      const { signed_url } = await resp.json();
      wsUrl = signed_url;
    }
  } catch {}

  // Fall back to direct agent connection (works for public agents)
  if (!wsUrl) {
    wsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${AGENT_ID}`;
  }

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
      addTranscriptLine('agent', 'Mic access denied — check browser permissions.');
      console.error('[pitch] mic error:', err);
    }
  };

  ws.onmessage = (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }

    switch (msg.type) {
      case 'conversation_initiation_metadata':
        console.log('[pitch] session started', msg.conversation_initiation_metadata_event?.conversation_id);
        break;

      case 'audio': {
        const b64 = msg.audio_event?.audio_base_64;
        if (!b64) break;
        if (avatarReady) {
          sendAudioToAvatar(b64);
        } else {
          pendingAudio.push(b64);
        }
        setStatus('speaking', 'SPEAKING');
        break;
      }

      case 'agent_response':
        addTranscriptLine('agent', msg.agent_response_event?.agent_response);
        break;

      case 'user_transcript':
        addTranscriptLine('user', msg.user_transcription_event?.user_transcript);
        setStatus('listening', 'LISTENING');
        break;

      case 'interruption':
        if (avatarIframe?.contentWindow) {
          avatarIframe.contentWindow.postMessage({ type: 'stop' }, '*');
        }
        setStatus('listening', 'LISTENING');
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', event_id: msg.ping_event?.event_id }));
        break;

      case 'client_tool_call':
        // Echo back a "tool not available" result so the conversation continues
        ws.send(JSON.stringify({
          type: 'client_tool_result',
          tool_call_id: msg.client_tool_call?.tool_call_id,
          result: 'Tool not available in this context.',
          is_error: false,
        }));
        break;
    }
  };

  ws.onclose = () => disconnect(false);
  ws.onerror = (e) => { console.error('[pitch] ws error', e); setStatus('error', 'ERROR'); };
}

function disconnect(closeWs = true) {
  connected = false;
  stopMic();
  if (closeWs && ws && ws.readyState === WebSocket.OPEN) ws.close();
  ws = null;
  pendingAudio = [];
  if (avatarIframe?.contentWindow) {
    avatarIframe.contentWindow.postMessage({ type: 'stop' }, '*');
  }
  btn.classList.remove('active', 'connecting');
  btnLabel.textContent = 'CONNECT';
  setStatus('offline', 'OFFLINE');
}

btn.addEventListener('click', () => {
  if (connected) disconnect();
  else connect();
});
