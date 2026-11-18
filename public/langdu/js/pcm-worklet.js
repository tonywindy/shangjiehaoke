/**
 * AudioWorklet：把麦克风音频降采样为 16kHz / 16bit / 单声道 PCM，每 100ms 发一包
 * 同时计算音量，用于界面上的声波动画
 */
class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.target = 16000;
    this.ratio = sampleRate / this.target;
    this.chunk = 1600; // 100ms
    this.buf = new Int16Array(this.chunk);
    this.len = 0;
    this.acc = 0; // 小数采样位置
    this.sum = 0;
    this.cnt = 0;
    this.sumSq = 0;
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;

    for (let i = 0; i < ch.length; i++) {
      const v = ch[i];
      this.sum += v;
      this.cnt++;
      this.sumSq += v * v;
      this.acc += 1;
      if (this.acc >= this.ratio) {
        this.acc -= this.ratio;
        let s = this.sum / this.cnt; // 简单平均做低通
        this.sum = 0;
        this.cnt = 0;
        s = Math.max(-1, Math.min(1, s));
        this.buf[this.len++] = s < 0 ? s * 0x8000 : s * 0x7fff;
        if (this.len === this.chunk) {
          const rms = Math.sqrt(this.sumSq / (this.chunk * this.ratio));
          this.sumSq = 0;
          this.port.postMessage({ pcm: this.buf.buffer, level: rms }, [this.buf.buffer]);
          this.buf = new Int16Array(this.chunk);
          this.len = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor('pcm-processor', PcmProcessor);
