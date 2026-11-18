/**
 * 贴纸册
 */
import { progress } from '../store.js';
import { icon, STICKERS, STARS_PER_STICKER } from '../ui.js';

export function mountStickers(root) {
  const p = progress.get();
  const owned = new Set(p.stickers);
  const nextAt = (Math.floor(p.totalStars / STARS_PER_STICKER) + 1) * STARS_PER_STICKER;
  const remain = Math.max(0, nextAt - p.totalStars);
  const pct = ((p.totalStars % STARS_PER_STICKER) / STARS_PER_STICKER) * 100;
  root.className = 'view-stickers';
  root.innerHTML = `
    <header class="topbar">
      <a class="icon-btn" href="#/" aria-label="返回">${icon('back')}</a>
      <div class="tb-title">我的贴纸册</div>
      <span class="pill star-pill static">${icon('star')}<b>${p.totalStars}</b></span>
    </header>
    <section class="sticker-hero">
      <div class="sh-count"><b>${owned.size}</b> / ${STICKERS.length}</div>
      <div class="sh-text">${owned.size >= STICKERS.length ? '全部集齐啦，你真厉害！' : `再得 <b>${remain}</b> 颗星星，就能解锁下一张贴纸`}</div>
      <div class="sh-bar"><i style="width:${pct}%"></i></div>
    </section>
    <section class="sticker-grid">
      ${STICKERS.map(
        ([e, name, bg], i) => `
        <div class="sticker ${owned.has(i) ? 'got' : 'locked'}" style="--bg:${bg};--r:${((i * 37) % 11) - 5}deg;--i:${i}">
          <div class="st-face"><span class="emo">${owned.has(i) ? e : '?'}</span></div>
          <div class="st-name">${owned.has(i) ? name : '还没解锁'}</div>
        </div>`
      ).join('')}
    </section>
  `;
  return () => {};
}
