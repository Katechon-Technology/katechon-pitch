// AudioWorkletProcessor — captures mic input as Float32 frames and posts to main thread.
class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buf = [];
    this._frameSize = Math.ceil(sampleRate * 0.1); // 100ms chunks
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    this._buf.push(...channel);
    while (this._buf.length >= this._frameSize) {
      this.port.postMessage(new Float32Array(this._buf.splice(0, this._frameSize)));
    }
    return true;
  }
}

registerProcessor('pcm-processor', PcmProcessor);
