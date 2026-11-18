/**
 * 入口：路由 + 课文加载
 */
import { mountHome } from './views/home.js';
import { mountReader } from './views/reader.js';
import { mountStickers } from './views/stickers.js';
import { settings } from './store.js';

const app = document.getElementById('app');
let cleanup = null;

/* ---------------- 课文数据 ---------------- */
const cache = new Map();
let indexP = null;

export function loadIndex() {
  if (!indexP) {
    indexP = fetch('lessons/index.json', { cache: 'no-cache' }).then((r) => {
      if (!r.ok) throw new Error('课文目录加载失败');
      return r.json();
    });
  }
  return indexP;
}

export function loadLesson(id) {
  if (!cache.has(id)) {
    cache.set(
      id,
      fetch(`lessons/${encodeURIComponent(id)}.json`, { cache: 'no-cache' }).then((r) => {
        if (!r.ok) throw new Error('找不到这篇课文：' + id);
        return r.json();
      })
    );
  }
  return cache.get(id);
}

/* ---------------- 路由 ---------------- */
function route() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [name, arg] = hash.split('/');
  if (cleanup) {
    try {
      cleanup();
    } catch (e) {
      console.error(e);
    }
    cleanup = null;
  }
  app.innerHTML = '';
  app.className = '';
  window.scrollTo(0, 0);

  if (name === 'read' && arg) cleanup = mountReader(app, decodeURIComponent(arg));
  else if (name === 'stickers') cleanup = mountStickers(app);
  else cleanup = mountHome(app);
}

export function go(path) {
  location.hash = '#/' + path;
}

function applyFontSize() {
  document.documentElement.dataset.fs = settings.get().fontSize;
}

settings.on(applyFontSize);
applyFontSize();
window.addEventListener('hashchange', route);
route();
