// AudioWorkletProcessor — captures mic input, resamples to 16kHz, posts Float32 frames.
const TARGET_RATE = 16000;
const FRAME_SAMPLES = 1600; // 100ms at 16kHz

class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._ratio = sampleRate / TARGET_RATE; // e.g. 3.0 for 48kHz, 2.756 for 44.1kHz
    this._buf   = [];
    this._frac  = 0; // fractional position accumulator
    this._acc   = 0; // sample accumulator for averaging (box low-pass)
    this._n     = 0; // samples in accumulator
  }

  process(inputs) {
    const ch = inputs[0]?.[0];
    if (!ch) return true;

    for (let i = 0; i < ch.length; i++) {
      this._acc += ch[i];
      this._n++;
      this._frac++;

      if (this._frac >= this._ratio) {
        this._frac -= this._ratio;
        // Average over the decimation window = simple box low-pass filter
        this._buf.push(this._n > 0 ? this._acc / this._n : 0);
        this._acc = 0;
        this._n   = 0;
      }
    }

    while (this._buf.length >= FRAME_SAMPLES) {
      this.port.postMessage(new Float32Array(this._buf.splice(0, FRAME_SAMPLES)));
    }

    return true;
  }
}

registerProcessor('pcm-processor', PcmProcessor);
