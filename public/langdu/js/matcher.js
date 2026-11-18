/**
 * 跟读比对器
 * 把语音识别的（不断修正的）文字结果，与课文的字序列对齐，算出孩子读到哪里、是否读错。
 */
import { HANZI_RE, isMatch } from './pinyin.js';

const FILLERS = new Set([...'嗯啊呃哦唉额诶噢呀哎']);
const LIGHT = new Set([...'的了着地得么呢吧啊呀子']);
const BACK_WINDOW = 12;

export class Matcher {
  constructor(tokens, level = 'normal') {
    this.tokens = tokens;
    this.level = level;
    this.reset(0);
  }

  get done() {
    return this.pos >= this.tokens.length;
  }

  reset(pos = 0) {
    this.pos = Math.max(0, Math.min(pos, this.tokens.length));
    this.anchor = this.pos;
    this.error = null;
    this._streak = 0;
    this._lastErrKey = '';
    this.errorPositions = new Set();
    if (pos === 0) this.errorCount = 0;
  }

  /** 家长强制跳过当前字 */
  skip() {
    if (this.done) return this.state(false);
    this.pos += 1;
    this.anchor = this.pos;
    this.error = null;
    return this.state(true);
  }

  /** 从某个字重新开始 */
  jumpTo(pos) {
    this.pos = Math.max(0, Math.min(pos, this.tokens.length));
    this.anchor = this.pos;
    this.error = null;
    return this.state(true);
  }

  /**
   * 输入一段识别结果（同一句话的结果会被反复修正）
   * @param {string} text
   * @param {boolean} isFinal 这一句识别是否已结束
   */
  feed(text, isFinal) {
    const T = this.tokens;
    const N = T.length;
    const hz = [...(text || '')].filter((c) => HANZI_RE.test(c));
    const lv = this.level;

    let p = this.anchor;
    let mismatch = null;

    for (let i = 0; i < hz.length && p < N; i++) {
      const c = hz[i];

      if (isMatch(c, T[p], lv)) {
        p++;
        mismatch = null;
        continue;
      }

      // 识别服务偶尔吞掉轻声字（了/的/着…）
      if (
        lv !== 'strict' &&
        p + 1 < N &&
        (T[p].tone === 0 || LIGHT.has(T[p].ch)) &&
        isMatch(c, T[p + 1], lv)
      ) {
        p += 2;
        mismatch = null;
        continue;
      }

      if (FILLERS.has(c)) continue;

      // 回读：孩子把前面几个字又读了一遍
      let reread = false;
      for (let j = p - 1; j >= Math.max(0, p - BACK_WINDOW); j--) {
        if (isMatch(c, T[j], lv)) {
          reread = true;
          break;
        }
      }
      if (reread) continue;

      mismatch = { at: p, heard: c };
    }

    const advanced = p > this.pos;
    if (advanced) {
      this.pos = p;
      this.error = null;
      this._streak = 0;
      this._lastErrKey = '';
    }

    // 读错判定：错误需持续出现（避免中间结果抖动），或者这句话已结束
    if (mismatch && mismatch.at >= this.pos) {
      const key = mismatch.at + ':' + mismatch.heard;
      this._streak = key === this._lastErrKey ? this._streak + 1 : 1;
      this._lastErrKey = key;
      if (isFinal || this._streak >= 2) {
        this.error = mismatch;
        if (!this.errorPositions.has(mismatch.at)) {
          this.errorPositions.add(mismatch.at);
          this.errorCount = (this.errorCount || 0) + 1;
        }
      }
    }

    if (isFinal) {
      this.anchor = this.pos;
      this._streak = 0;
      this._lastErrKey = '';
    }

    return this.state(advanced);
  }

  state(advanced) {
    return { pos: this.pos, error: this.error, advanced, done: this.done };
  }
}
