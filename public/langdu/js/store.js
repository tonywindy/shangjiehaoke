/**
 * 本地存储：设置、学习进度、星星、录音
 */
const CFG = window.APP_CONFIG || {};
const KEY_SETTINGS = 'reading.settings.v1';
const KEY_PROGRESS = 'reading.progress.v1';

const DEFAULTS = {
  childName: '宝贝',
  asr: CFG.defaultAsr || 'aliyun', // 'aliyun' | 'demo'
  level: 'normal', // 'loose' | 'normal' | 'strict'
  leadMode: false, // 带读模式：老师先读一句，孩子跟读一句
  activeBook: 'book-1', // 'book-1' | 'book-2' | 'all'
  showPinyin: true,
  fontSize: 'm', // 's' | 'm' | 'l'
  record: true,
  focus: true,
  sound: true,
  tokenUrl: '',
  accessCode: '',
};

function load(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v == null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}
function save(key, v) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch (e) {}
}

/* ---------------- 设置 ---------------- */
const listeners = new Set();
let cur = { ...DEFAULTS, ...load(KEY_SETTINGS, {}) };

export const settings = {
  get: () => cur,
  set(patch) {
    cur = { ...cur, ...patch };
    save(KEY_SETTINGS, cur);
    listeners.forEach((fn) => fn(cur));
  },
  on(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

/* ---------------- 进度与星星 ---------------- */
// { lessons: { [id]: { best, times, last } }, totalStars, stickers: [] }
let prog = load(KEY_PROGRESS, { lessons: {}, totalStars: 0, stickers: [] });

export const progress = {
  get: () => prog,
  lesson: (id) => prog.lessons[id] || { best: 0, times: 0 },
  /** 记录一次完成，返回 { totalStars, newStickers } */
  complete(id, stars, stickerCount, starsPerSticker) {
    const l = prog.lessons[id] || { best: 0, times: 0 };
    l.best = Math.max(l.best, stars);
    l.times += 1;
    l.last = Date.now();
    prog.lessons[id] = l;
    const before = Math.floor(prog.totalStars / starsPerSticker);
    prog.totalStars += stars;
    const after = Math.min(stickerCount, Math.floor(prog.totalStars / starsPerSticker));
    const newStickers = [];
    for (let i = before; i < after; i++) {
      if (!prog.stickers.includes(i)) {
        prog.stickers.push(i);
        newStickers.push(i);
      }
    }
    save(KEY_PROGRESS, prog);
    return { totalStars: prog.totalStars, newStickers };
  },
  reset() {
    prog = { lessons: {}, totalStars: 0, stickers: [] };
    save(KEY_PROGRESS, prog);
  },
};

/* ---------------- 录音（IndexedDB） ---------------- */
const DB_NAME = 'reading-db';
const KEEP = 5;
let dbp = null;

function db() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const s = req.result.createObjectStore('recordings', { keyPath: 'id', autoIncrement: true });
      s.createIndex('lesson', 'lessonId');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx(store, mode, fn) {
  return db().then(
    (d) =>
      new Promise((resolve, reject) => {
        const t = d.transaction(store, mode);
        const r = fn(t.objectStore(store));
        t.oncomplete = () => resolve(r && 'result' in r ? r.result : undefined);
        t.onerror = () => reject(t.error);
      })
  );
}

export const recordings = {
  async list(lessonId) {
    const all = await tx('recordings', 'readonly', (s) => s.index('lesson').getAll(lessonId));
    return (all || []).sort((a, b) => b.createdAt - a.createdAt);
  },
  async add(lessonId, blob, duration, stars) {
    await tx('recordings', 'readwrite', (s) => s.add({ lessonId, blob, duration, stars, createdAt: Date.now() }));
    const list = await this.list(lessonId);
    for (const r of list.slice(KEEP)) await this.remove(r.id);
  },
  remove(id) {
    return tx('recordings', 'readwrite', (s) => s.delete(id));
  },
};
