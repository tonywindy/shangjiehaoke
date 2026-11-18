/**
 * 首页：书架
 */
import { loadIndex, loadLesson } from '../main.js';
import { progress, settings } from '../store.js';
import { icon, esc, h, parentGate } from '../ui.js';
import { openSettings } from './settings.js';

export function coverHTML(lesson, cls = '') {
  const theme = lesson.theme || '#FFB547';
  if (lesson.cover || lesson.image) {
    return `<div class="cover ${cls}" style="--theme:${theme}"><img src="${esc(lesson.cover || lesson.image)}" alt="" loading="lazy"/></div>`;
  }
  const first = [...(lesson.title || '读')][0];
  return `<div class="cover cover-ph ${cls}" style="--theme:${theme}">
    <span class="ph-sun"></span><span class="ph-hill h1"></span><span class="ph-hill h2"></span>
    <span class="ph-char">${esc(first)}</span>
  </div>`;
}

function starsHTML(n, cls = '') {
  return `<span class="stars ${cls}">${[0, 1, 2].map((i) => `<i class="${i < n ? 'on' : ''}">${icon('star')}</i>`).join('')}</span>`;
}

export function mountHome(root) {
  const s = settings.get();
  const p = progress.get();
  root.className = 'view-home';
  root.innerHTML = `
    <header class="home-head">
      <div class="hello">
        <div class="hello-badge"><span class="emo">📖</span></div>
        <div>
          <h1><span class="name">${esc(s.childName)}</span>的朗读小屋</h1>
          <p class="muted">今天也来读一读吧～</p>
        </div>
      </div>
      <div class="head-actions">
        <a class="pill star-pill" href="#/stickers" aria-label="贴纸册">
          ${icon('star')}<b>${p.totalStars}</b><span class="sep"></span>${icon('sticker')}<span>贴纸册</span>
        </a>
        <button class="icon-btn" id="btn-settings" aria-label="家长设置">${icon('gear')}</button>
      </div>
    </header>
    <section id="shelf" class="shelf"><div class="loading-dots"><i></i><i></i><i></i></div></section>
  `;

  root.querySelector('#btn-settings').addEventListener('click', async () => {
    if (await parentGate()) openSettings(() => mountHome(root));
  });

  const shelf = root.querySelector('#shelf');
  loadIndex()
    .then(async (idx) => {
      shelf.innerHTML = '';
      for (const book of idx.books || []) {
        const sec = h(`<div class="book"><h2 class="book-title">${icon('book')}<span>${esc(book.title)}</span></h2><div class="grid"></div></div>`);
        const grid = sec.querySelector('.grid');
        shelf.appendChild(sec);
        const lessons = await Promise.all(book.lessons.map((id) => loadLesson(id).catch(() => null)));
        lessons.forEach((l, i) => {
          if (!l) return;
          const lp = progress.lesson(l.id);
          const card = h(`
            <a class="lesson-card" href="#/read/${encodeURIComponent(l.id)}" style="--i:${i}">
              ${coverHTML(l)}
              <div class="lc-body">
                <div class="lc-title">${esc(l.title)}</div>
                <div class="lc-meta">
                  ${starsHTML(lp.best)}
                  <span class="chip">${lp.times ? `读过 ${lp.times} 次` : '新课文'}</span>
                </div>
              </div>
            </a>`);
          grid.appendChild(card);
        });
      }
    })
    .catch((e) => {
      shelf.innerHTML = `<div class="empty">${esc(e.message)}<br/><small class="muted">请通过网站地址（http/https）打开，而不是直接双击文件</small></div>`;
    });

  return () => {};
}
