/**
 * 界面小工具：图标、提示、弹窗、音效、彩带
 */
import { settings } from './store.js';

/* ---------------- 图标（线性风格） ---------------- */
const paths = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  prev: '<path d="M14.5 6l-6 6 6 6"/>',
  next: '<path d="M9.5 6l6 6-6 6"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  pause: '<rect x="7" y="5" width="3.6" height="14" rx="1.4"/><rect x="13.4" y="5" width="3.6" height="14" rx="1.4"/>',
  play: '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/>',
  restart: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4v4.5H8"/>',
  skip: '<path d="M5 5.5l8 6.5-8 6.5zM17 5v14"/>',
  headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4.5" height="6.5" rx="1.8"/><rect x="16.5" y="14" width="4.5" height="6.5" rx="1.8"/>',
  star: '<path d="M12 2.8l2.8 5.7 6.3.9-4.6 4.4 1.1 6.3L12 17.1l-5.6 3 1.1-6.3L2.9 9.4l6.3-.9z"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  sticker: '<path d="M20 12.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6.5"/><path d="M20 12.5L12.5 20c0-4.1 3.4-7.5 7.5-7.5z"/>',
  speaker: '<path d="M4 9.5v5h3.5L12 19V5L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
  expand: '<path d="M15 4h5v5M9 20H4v-5M20 4l-6 6M4 20l6-6"/>',
  compress: '<path d="M4 14h6v6M20 10h-6V4M14 10l6-6M10 14l-6 6"/>',
};

export function icon(name, cls = '') {
  const fill = name === 'star' || name === 'play' ? ' fill="currentColor"' : ' fill="none"';
  return `<svg class="ic ${cls}" viewBox="0 0 24 24"${fill} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
}

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------------- 提示 ---------------- */
let toastTimer;
export function toast(msg, ms = 2600) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

/* ---------------- 弹窗 ---------------- */
export function modal(content, { onClose, cls = '', dismissible = true } = {}) {
  const root = document.getElementById('modal-root');
  const wrap = h(`<div class="modal ${cls}"><div class="modal-mask"></div><div class="modal-card" role="dialog"></div></div>`);
  const card = wrap.querySelector('.modal-card');
  if (typeof content === 'string') card.innerHTML = content;
  else card.appendChild(content);
  root.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));
  const close = () => {
    wrap.classList.remove('open');
    setTimeout(() => wrap.remove(), 280);
    onClose && onClose();
  };
  if (dismissible) wrap.querySelector('.modal-mask').addEventListener('click', close);
  wrap.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  return { el: wrap, card, close };
}

/** 家长验证：做一道算术题 */
export function parentGate() {
  return new Promise((resolve) => {
    const a = 3 + Math.floor(Math.random() * 7);
    const b = 3 + Math.floor(Math.random() * 7);
    const opts = new Set([a * b]);
    while (opts.size < 4) opts.add(a * b + (Math.floor(Math.random() * 15) - 7) || a * b + 11);
    const list = [...opts].sort(() => Math.random() - 0.5);
    let ok = false;
    const m = modal(
      `<div class="gate">
        <div class="gate-badge">${icon('gear')}</div>
        <h3>家长专区</h3>
        <p class="muted">请家长回答：</p>
        <div class="gate-q">${a} × ${b} = ?</div>
        <div class="gate-opts">${list.map((n) => `<button class="btn ghost" data-v="${n}">${n}</button>`).join('')}</div>
      </div>`,
      { onClose: () => resolve(ok) }
    );
    m.card.querySelectorAll('[data-v]').forEach((btn) =>
      btn.addEventListener('click', () => {
        if (Number(btn.dataset.v) === a * b) {
          ok = true;
          m.close();
        } else {
          btn.classList.add('shake');
          setTimeout(() => btn.classList.remove('shake'), 500);
        }
      })
    );
  });
}

/* ---------------- 音效（WebAudio 合成，无需音频文件） ---------------- */
let actx;
function ac() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
function tone(freq, start, dur, { type = 'sine', vol = 0.18 } = {}) {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = c.currentTime + start;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const sfx = {
  enabled: () => settings.get().sound,
  sentence() {
    if (!this.enabled()) return;
    tone(880, 0, 0.25, { vol: 0.12 });
    tone(1318.5, 0.08, 0.35, { vol: 0.1 });
  },
  oops() {
    if (!this.enabled()) return;
    tone(330, 0, 0.18, { type: 'triangle', vol: 0.14 });
    tone(262, 0.12, 0.25, { type: 'triangle', vol: 0.12 });
  },
  win() {
    if (!this.enabled()) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.11, 0.5, { vol: 0.13 }));
    tone(1568, 0.5, 0.8, { vol: 0.08 });
  },
  star(i) {
    if (!this.enabled()) return;
    tone(988 + i * 196, 0, 0.3, { vol: 0.12 });
  },
};

/* ---------------- 朗读示范（浏览器自带语音合成，可能不可用） ---------------- */
export function speak(text) {
  try {
    if (!window.speechSynthesis) return false;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    u.rate = 0.8;
    const v = speechSynthesis.getVoices().find((x) => /zh[-_]CN/i.test(x.lang));
    if (v) u.voice = v;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    return true;
  } catch (e) {
    return false;
  }
}

/* ---------------- 彩带 ---------------- */
export function confetti(duration = 2600) {
  const cv = document.getElementById('confetti');
  const ctx = cv.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = innerWidth * dpr;
  cv.height = innerHeight * dpr;
  ctx.scale(dpr, dpr);
  cv.classList.add('on');
  const colors = ['#FF7A6B', '#FFB547', '#5CC9A7', '#6FB7FF', '#B18CFF', '#FF8FB8'];
  const parts = Array.from({ length: 140 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.3,
    y: innerHeight * 0.38,
    vx: (Math.random() - 0.5) * 16,
    vy: -Math.random() * 16 - 6,
    r: 5 + Math.random() * 7,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    c: colors[(Math.random() * colors.length) | 0],
    s: (Math.random() * 3) | 0,
  }));
  const t0 = performance.now();
  (function frame(now) {
    const k = (now - t0) / duration;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.42;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k * k);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      if (p.s === 0) ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
      else if (p.s === 1) {
        ctx.beginPath();
        ctx.arc(0, 0, p.r / 2.4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
          ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * p.r * 0.6, Math.sin(a) * p.r * 0.6);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    if (k < 1) requestAnimationFrame(frame);
    else {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      cv.classList.remove('on');
    }
  })(t0);
}

/* ---------------- 贴纸 ---------------- */
export const STARS_PER_STICKER = 3;
export const STICKERS = [
  ['🐭', '小老鼠', '#FFE3D3'], ['🎻', '小提琴', '#FFEFC2'], ['🎺', '小号', '#DDF3EA'], ['🥁', '小鼓', '#DCEBFF'],
  ['🎹', '钢琴', '#EDE4FF'], ['🌈', '彩虹', '#FFE0EC'], ['⭐', '星星', '#FFF3C4'], ['🌸', '樱花', '#FFE3EE'],
  ['🐰', '小兔', '#F1E9FF'], ['🐻', '小熊', '#FBE7D6'], ['🦊', '狐狸', '#FFE3D0'], ['🐼', '熊猫', '#E6F2EE'],
  ['🐧', '企鹅', '#DDEEFF'], ['🦄', '独角兽', '#F5E3FF'], ['🐳', '鲸鱼', '#D8F0FF'], ['🌙', '月亮', '#FFF4CF'],
  ['🍓', '草莓', '#FFE1E4'], ['🍉', '西瓜', '#E1F6E4'], ['🎈', '气球', '#FFE0E0'], ['🧸', '玩具熊', '#F7E6D4'],
  ['🚀', '火箭', '#E2E8FF'], ['🦋', '蝴蝶', '#E0F4FF'], ['🌻', '向日葵', '#FFF1C9'], ['👑', '皇冠', '#FFF0C0'],
];
