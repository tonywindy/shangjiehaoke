/**
 * 阿里云 · 智能语音交互 · 实时语音识别（WebSocket）
 * 文档：https://help.aliyun.com/zh/isi/developer-reference/websocket
 */
import { settings } from './store.js';

const CFG = window.APP_CONFIG || {};
let tokenCache = null; // { token, expireTime, appkey }

function uid32() {
  if (window.crypto && crypto.getRandomValues) {
    const a = new Uint8Array(16);
    crypto.getRandomValues(a);
    return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return (Date.now().toString(16) + Math.random().toString(16).slice(2) + '0'.repeat(32)).slice(0, 32);
}

async function getToken() {
  const now = Date.now() / 1000;
  if (tokenCache && tokenCache.expireTime - 120 > now) return tokenCache;
  const url = settings.get().tokenUrl || CFG.tokenUrl;
  if (!url) throw new Error('还没有配置 Token 接口地址');
  const headers = {};
  const code = settings.get().accessCode;
  if (code) headers['X-Access-Code'] = code;
  let res;
  try {
    res = await fetch(url, { headers, cache: 'no-store' });
  } catch (e) {
    throw new Error('连不上 Token 接口，请检查网络或接口地址');
  }
  if (res.status === 401) {
    const err = new Error('需要输入访问口令');
    err.needCode = true;
    throw err;
  }
  if (!res.ok) throw new Error('获取 Token 失败（' + res.status + '）');
  const data = await res.json();
  if (!data.token) throw new Error(data.error || 'Token 接口没有返回 token');
  tokenCache = {
    token: data.token,
    expireTime: Number(data.expireTime) || now + 3600,
    appkey: data.appkey || CFG.appkey,
  };
  if (!tokenCache.appkey) throw new Error('缺少 appkey，请在 config.js 或后端配置');
  return tokenCache;
}

export class AliyunASR {
  constructor(h = {}) {
    this.h = h;
    this.ws = null;
    this.ready = false;
    this.queue = [];
    this.taskId = '';
    this.active = false;
  }

  async start() {
    const { token, appkey } = await getToken();
    const gateway = CFG.aliyunGateway || 'wss://nls-gateway-cn-shanghai.aliyuncs.com/ws/v1';
    this.taskId = uid32();
    this.appkey = appkey;
    this.ready = false;
    this.queue = [];
    this.active = true;

    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (msg) => {
        if (!settled) {
          settled = true;
          reject(new Error(msg));
        } else if (this.active) {
          this.h.onError && this.h.onError(new Error(msg));
        }
      };
      const timer = setTimeout(() => fail('语音识别连接超时'), 8000);

      const ws = new WebSocket(gateway + '?token=' + encodeURIComponent(token));
      ws.binaryType = 'arraybuffer';
      this.ws = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            header: {
              message_id: uid32(),
              task_id: this.taskId,
              namespace: 'SpeechTranscriber',
              name: 'StartTranscription',
              appkey,
            },
            payload: {
              format: 'pcm',
              sample_rate: 16000,
              enable_intermediate_result: true,
              enable_punctuation_prediction: false,
              enable_inverse_text_normalization: false,
              max_sentence_silence: 1000,
            },
          })
        );
      };

      ws.onmessage = (e) => {
        if (typeof e.data !== 'string') return;
        let msg;
        try {
          msg = JSON.parse(e.data);
        } catch (err) {
          return;
        }
        const name = msg.header && msg.header.name;
        const p = msg.payload || {};
        switch (name) {
          case 'TranscriptionStarted':
            clearTimeout(timer);
            this.ready = true;
            this.queue.forEach((b) => ws.send(b));
            this.queue = [];
            if (!settled) {
              settled = true;
              resolve();
            }
            break;
          case 'TranscriptionResultChanged':
            this.h.onPartial && this.h.onPartial(p.result || '');
            break;
          case 'SentenceEnd':
            this.h.onFinal && this.h.onFinal(p.result || '');
            break;
          case 'TranscriptionCompleted':
            this._completed && this._completed();
            break;
          case 'TaskFailed':
            clearTimeout(timer);
            if ((msg.header.status_text || '').includes('TOKEN')) tokenCache = null;
            fail('语音识别出错：' + (msg.header.status_text || msg.header.status));
            break;
        }
      };

      ws.onerror = () => fail('语音识别连接出错');
      ws.onclose = () => {
        clearTimeout(timer);
        this.ready = false;
        if (this.active) fail('语音识别连接断开了');
        this._completed && this._completed();
      };
    });
  }

  feed(buf) {
    if (!this.ws || !this.active) return;
    if (this.ready && this.ws.readyState === 1) this.ws.send(buf);
    else if (this.queue.length < 50) this.queue.push(buf);
  }

  async stop() {
    this.active = false;
    const ws = this.ws;
    if (!ws) return;
    if (ws.readyState === 1 && this.ready) {
      await new Promise((resolve) => {
        const t = setTimeout(resolve, 1500);
        this._completed = () => {
          clearTimeout(t);
          resolve();
        };
        ws.send(
          JSON.stringify({
            header: {
              message_id: uid32(),
              task_id: this.taskId,
              namespace: 'SpeechTranscriber',
              name: 'StopTranscription',
              appkey: this.appkey,
            },
          })
        );
      });
    }
    try {
      ws.close();
    } catch (e) {}
    this.ws = null;
    this._completed = null;
  }
}
