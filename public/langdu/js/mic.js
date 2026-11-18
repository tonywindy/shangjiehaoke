/**
 * 麦克风：同时输出 16k PCM（给语音识别）和录音文件（给回放）
 */
export class Mic {
  constructor({ onPcm, onLevel, record = true } = {}) {
    this.onPcm = onPcm || (() => {});
    this.onLevel = onLevel || (() => {});
    this.record = record;
    this.stream = null;
    this.ctx = null;
    this.node = null;
    this.recorder = null;
    this.chunks = [];
    this.startedAt = 0;
  }

  static supported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.AudioWorkletNode);
  }

  async start() {
    if (!Mic.supported()) {
      throw new Error(
        window.isSecureContext ? '这个浏览器不支持录音，请换用 Chrome 或 Edge' : '需要用 https 地址打开网页才能使用麦克风'
      );
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });

    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    await this.ctx.audioWorklet.addModule(new URL('./pcm-worklet.js', import.meta.url));
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, 'pcm-processor');
    this.node.port.onmessage = (e) => {
      this.onPcm(e.data.pcm);
      this.onLevel(e.data.level);
    };
    src.connect(this.node);
    // 不连到扬声器，避免回声；部分浏览器需要连接到 destination 才会运行，这里用静音增益
    const mute = this.ctx.createGain();
    mute.gain.value = 0;
    this.node.connect(mute).connect(this.ctx.destination);
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    if (this.record && window.MediaRecorder) {
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(
        (m) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)
      );
      try {
        this.recorder = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
        this.chunks = [];
        this.recorder.ondataavailable = (e) => e.data && e.data.size && this.chunks.push(e.data);
        this.recorder.start(1000);
      } catch (e) {
        this.recorder = null;
      }
    }
    this.startedAt = Date.now();
  }

  pause() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
    if (this.recorder && this.recorder.state === 'recording') this.recorder.pause();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    if (this.recorder && this.recorder.state === 'paused') this.recorder.resume();
  }

  /** 停止并返回录音 { blob, duration } 或 null */
  async stop() {
    let result = null;
    if (this.recorder && this.recorder.state !== 'inactive') {
      result = await new Promise((resolve) => {
        this.recorder.onstop = () => {
          const type = this.recorder.mimeType || 'audio/webm';
          const blob = new Blob(this.chunks, { type });
          resolve(blob.size ? { blob, duration: (Date.now() - this.startedAt) / 1000 } : null);
        };
        this.recorder.stop();
      });
    }
    try {
      this.node && this.node.disconnect();
    } catch (e) {}
    this.stream && this.stream.getTracks().forEach((t) => t.stop());
    if (this.ctx) {
      try {
        await this.ctx.close();
      } catch (e) {}
    }
    this.stream = this.ctx = this.node = this.recorder = null;
    return result;
  }
}
