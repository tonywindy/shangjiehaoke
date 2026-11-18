/**
 * 演示模式：不用麦克风和密钥，模拟"一个孩子在朗读"，用于预览效果和调试
 * - 自动朗读整篇，中途故意读错一个生字，停顿后再读对
 * - 也可以由家长手动输入文字，模拟识别结果
 */
const WRONG_POOL = [...'跑天花山水月火土木草'];

export class DemoASR {
  constructor(h = {}, { tokens = [], startPos = 0, speed = 300 } = {}) {
    this.h = h;
    this.tokens = tokens;
    this.pos = startPos;
    this.speed = speed;
    this.active = false;
    this.timer = null;
    this.madeMistake = false;
  }

  async start() {
    this.active = true;
    await new Promise((r) => setTimeout(r, 300));
    this._run();
  }

  /** 外部同步当前位置（跳过 / 点字回退之后） */
  sync(pos) {
    this.pos = pos;
  }

  _run() {
    const T = this.tokens;
    let sentText = '';
    let sent = T[this.pos] ? T[this.pos].sent : -1;

    const step = () => {
      if (!this.active) return;
      if (this.pos >= T.length) {
        if (sentText) this.h.onFinal && this.h.onFinal(sentText);
        return;
      }
      const t = T[this.pos];
      if (t.sent !== sent) {
        // 一句读完，停顿一下
        this.h.onFinal && this.h.onFinal(sentText);
        sentText = '';
        sent = t.sent;
        this.timer = setTimeout(step, this.speed * 2.6);
        return;
      }

      // 故意读错第一个生字（只错一次）
      if (t.isNew && !this.madeMistake && this.pos > 4) {
        this.madeMistake = true;
        const wrong = WRONG_POOL[Math.floor(Math.random() * WRONG_POOL.length)];
        this.h.onPartial && this.h.onPartial(sentText + wrong);
        this.timer = setTimeout(() => {
          this.h.onPartial && this.h.onPartial(sentText + wrong);
          this.timer = setTimeout(() => {
            this.h.onFinal && this.h.onFinal(sentText + wrong);
            sentText = '';
            this.timer = setTimeout(step, 2200);
          }, 500);
        }, 400);
        return;
      }

      sentText += t.ch;
      this.pos++;
      this.h.onPartial && this.h.onPartial(sentText);
      const jitter = this.speed * (0.7 + Math.random() * 0.7);
      this.timer = setTimeout(step, jitter);
    };
    step();
  }

  feed() {}

  /** 家长手动输入一段"识别结果" */
  inject(text) {
    this.h.onFinal && this.h.onFinal(text);
  }

  async stop() {
    this.active = false;
    clearTimeout(this.timer);
  }
}
