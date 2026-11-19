/**
 * 朗读页（核心）
 */
import { loadLesson } from '../main.js';
import { compileLesson } from '../pinyin.js';
import { Matcher } from '../matcher.js';
import { Mic } from '../mic.js';
import { AliyunASR } from '../asr-aliyun.js';
import { DemoASR } from '../asr-demo.js';
import { settings, progress, recordings } from '../store.js';
import { icon, esc, h, toast, modal, sfx, confetti, speak, parentGate, STICKERS, STARS_PER_STICKER } from '../ui.js';
import { openSettings } from './settings.js';
import { coverHTML } from './home.js';

const PY_PUNCT_OPEN = new Set([...'“‘（《【「『']);

function starsFor(errors) {
  if (errors <= 1) return 3;
  if (errors <= 4) return 2;
  return 1;
}

function fmtTime(sec) {
  sec = Math.round(sec);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m} 分 ${s} 秒` : `${s} 秒`;
}

export function mountReader(root, id) {
  root.className = 'view-reader';
  root.innerHTML = `<div class="loading-dots center"><i></i><i></i><i></i></div>`;
  let disposed = false;
  let teardown = () => {};

  loadLesson(id)
    .then((lesson) => {
      if (disposed) return;
      teardown = build(root, lesson);
    })
    .catch((e) => {
      root.innerHTML = `<div class="empty">${esc(e.message)}<br/><a class="btn" href="#/">回到书架</a></div>`;
    });

  return () => {
    disposed = true;
    teardown();
  };
}

function build(root, lesson) {
  const S = settings.get();
  const { sentences, tokens } = compileLesson(lesson);
  const N = tokens.length;
  const matcher = new Matcher(tokens, S.level);

  // 收集连环画分镜（按句去重，保留对应第一句索引）
  const scenes = [];
  sentences.forEach((s, si) => {
    if (s.isTitle || !s.image) return;
    if (!scenes.length || scenes[scenes.length - 1].image !== s.image) {
      scenes.push({ image: s.image, sent: si, first: s.first });
    }
  });
  // 预加载全部插画，切换零闪烁
  const preloadSet = new Set([lesson.image, lesson.cover, ...scenes.map((x) => x.image)].filter(Boolean));
  preloadSet.forEach((src) => {
    const img = new Image();
    img.src = src;
  });

  /* ---------------- 页面结构 ---------------- */
  root.innerHTML = `
    <div class="reader ${S.showPinyin ? 'show-py' : ''} ${S.focus ? 'focus-mode' : ''}">
      <div class="art-ambient" id="art-ambient" aria-hidden="true"></div>

      <header class="topbar">
        <div class="tb-left">
          <a class="icon-btn" href="#/" aria-label="返回书架">${icon('back')}</a>
        </div>
        <div class="tb-title">${esc(lesson.title)}</div>
        <div class="tb-actions">
          <button class="toggle-py ${S.showPinyin ? 'on' : ''}" id="btn-py" aria-label="拼音开关"><span class="py-a">pīn</span><span class="py-b">拼</span></button>
          <button class="icon-btn" id="btn-rec" aria-label="我的录音">${icon('headphones')}</button>
          <button class="icon-btn" id="btn-set" aria-label="家长设置">${icon('gear')}</button>
        </div>
      </header>

      <section class="stage">
        <div class="art-col">
          <div class="art-frame">
            <figure class="art" id="art"></figure>
            ${scenes.length > 1 ? `<span class="scene-badge" id="scene-badge">1 / ${scenes.length}</span>` : ''}
            <button type="button" class="cinema-btn" id="btn-cinema" aria-label="全屏绘本">
              ${icon('expand', 'i-exp')}${icon('compress', 'i-cmp')}<span class="cb-lbl">全屏</span>
            </button>
          </div>
          ${
            scenes.length > 1
              ? `<div class="scene-strip" id="scene-strip" role="tablist" aria-label="故事分镜">
                  ${scenes
                    .map(
                      (sc, idx) =>
                        `<button class="sc-thumb" type="button" data-sc="${idx}" data-t="${sc.first ?? 0}" aria-label="第 ${idx + 1} 幅画面">
                          <img src="${esc(sc.image)}" alt=""/>
                          <span>${idx + 1}</span>
                        </button>`
                    )
                    .join('')}
                </div>`
              : ''
          }
        </div>

        <div class="page-wrap">
          <article class="page" id="page">
            <div class="page-inner" id="text"></div>
            ${
              lesson.words && lesson.words.length
                ? `<div class="words">${lesson.words
                    .map((w) => `<button class="word" data-w="${esc(w)}">${esc(w)}</button>`)
                    .join('')}</div>`
                : ''
            }
          </article>
        </div>
      </section>

      <div class="bubble" id="bubble" hidden></div>

      <footer class="dock">
        <div class="dock-side left">
          <button class="round-btn" id="btn-restart" aria-label="从头再读">${icon('restart')}<span>重来</span></button>
        </div>
        <div class="dock-center">
          <div class="progress"><i id="bar"></i></div>
          <div class="mic-wrap">
            <span class="ring r1"></span><span class="ring r2"></span><span class="ring r3"></span>
            <button class="mic" id="mic" aria-label="开始朗读">${icon('mic', 'i-mic')}${icon('pause', 'i-pause')}</button>
          </div>
          <div class="status-wrap">
            <div class="status" id="status">点一下话筒，开始读吧</div>
            <div class="heard" id="heard" aria-live="polite"></div>
          </div>
        </div>
        <div class="dock-side right">
          <button class="round-btn" id="btn-skip" aria-label="跳过这个字">${icon('skip')}<span>跳过</span></button>
        </div>
      </footer>
      ${
        S.asr === 'demo'
          ? `<form class="demo-bar" id="demo-bar"><span class="tag">演示模式</span><input class="input" placeholder="输入文字模拟识别结果，回车" /><button class="btn sm">发送</button></form>`
          : ''
      }
    </div>`;

  const $ = (sel) => root.querySelector(sel);
  const readerEl = $('.reader');
  const ambientEl = $('#art-ambient');
  const textEl = $('#text');
  const pageEl = $('#page');
  const artEl = $('#art');
  const sceneBadge = $('#scene-badge');
  const sceneThumbs = [...root.querySelectorAll('.sc-thumb')];
  const bubble = $('#bubble');
  const bar = $('#bar');
  const statusEl = $('#status');
  const heardEl = $('#heard');
  const micBtn = $('#mic');
  const micWrap = $('.mic-wrap');

  /* ---------------- 渲染课文 ---------------- */
  const chEls = new Array(N);
  const sentEls = [];
  let paraEl = null;

  sentences.forEach((s, si) => {
    if (s.isTitle) {
      paraEl = h(`<h2 class="title-line"></h2>`);
      textEl.appendChild(paraEl);
    } else if (s.paraStart) {
      paraEl = h(`<p class="para"></p>`);
      textEl.appendChild(paraEl);
    }
    const sEl = h(`<span class="sent" data-s="${si}"></span>`);
    sentEls[si] = sEl;
    paraEl.appendChild(sEl);

    // 字 + 后面的标点合成一个不可断行的组；开引号粘到后一个字
    let group = null;
    let pendingOpen = '';
    s.items.forEach((it) => {
      if (it.kind === 'hz') {
        const t = tokens[it.t];
        group = h(`<span class="w"></span>`);
        if (pendingOpen) {
          group.appendChild(h(`<span class="pu">${esc(pendingOpen)}</span>`));
          pendingOpen = '';
        }
        const el = h(
          `<span class="ch${t.isNew ? ' new' : ''}" data-t="${t.i}"><i class="py">${esc(t.py)}</i><b class="hz" data-c="${esc(t.ch)}">${esc(t.ch)}</b></span>`
        );
        chEls[t.i] = el;
        group.appendChild(el);
        sEl.appendChild(group);
      } else if (PY_PUNCT_OPEN.has(it.ch)) {
        pendingOpen += it.ch;
      } else if (group) {
        group.appendChild(h(`<span class="pu">${esc(it.ch)}</span>`));
      } else {
        sEl.appendChild(h(`<span class="w"><span class="pu">${esc(it.ch)}</span></span>`));
      }
    });
  });

  /* ---------------- 配图与分镜 ---------------- */
  let curImg = undefined;
  function showArt(si) {
    // 当前句的图 → 往前找最近一张 → 整页图 → 占位图
    let src = null;
    for (let k = si; k >= 0; k--) {
      if (sentences[k] && sentences[k].image) {
        src = sentences[k].image;
        break;
      }
    }
    src = src || lesson.image || null;

    // 更新分镜条高亮
    if (scenes.length > 1) {
      let activeIdx = 0;
      for (let i = 0; i < scenes.length; i++) {
        if (si >= scenes[i].sent) activeIdx = i;
      }
      if (sceneBadge) sceneBadge.textContent = `${activeIdx + 1} / ${scenes.length}`;
      sceneThumbs.forEach((btn, idx) => {
        btn.classList.toggle('on', idx === activeIdx);
        btn.classList.toggle('done', idx < activeIdx);
      });
    }

    if (src === curImg) return;
    const isFirst = curImg === undefined;
    curImg = src;
    const layer = src
      ? h(`<div class="art-layer${isFirst ? ' in' : ''}"><img class="fg" src="${esc(src)}" alt=""/></div>`)
      : h(`<div class="art-layer${isFirst ? ' in' : ''}">${coverHTML(lesson, 'big')}<div class="art-hint">配图待添加</div></div>`);
    artEl.appendChild(layer);
    if (!isFirst) requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add('in')));
    const old = [...artEl.children].slice(0, -1);
    setTimeout(() => old.forEach((o) => o.remove()), 650);

    if (src) {
      const amb = h(`<div class="amb-layer${isFirst ? ' in' : ''}" style="background-image:url('${esc(src)}')"></div>`);
      ambientEl.appendChild(amb);
      if (!isFirst) requestAnimationFrame(() => requestAnimationFrame(() => amb.classList.add('in')));
      const oldAmb = [...ambientEl.children].slice(0, -1);
      setTimeout(() => oldAmb.forEach((o) => o.remove()), 850);
    }
  }

  /* ---------------- 状态 → 界面 ---------------- */
  let phase = 'idle'; // idle | connecting | listening | paused | done
  let lastPos = -1;
  let lastSent = -1;
  let heardTimer = 0;

  function setPhase(p, msg) {
    phase = p;
    readerEl.dataset.phase = p;
    micBtn.setAttribute('aria-label', p === 'listening' ? '暂停' : '开始朗读');
    if (msg != null) setStatus(msg);
    if (p !== 'listening') setHeard('');
  }
  function setStatus(msg, cls = '') {
    statusEl.innerHTML = msg;
    statusEl.className = 'status ' + cls;
  }
  function setHeard(text) {
    clearTimeout(heardTimer);
    if (!text) {
      heardEl.textContent = '';
      heardEl.classList.remove('show');
      return;
    }
    const clean = text.trim();
    if (!clean) return;
    const tail = clean.length > 14 ? '…' + clean.slice(-14) : clean;
    heardEl.textContent = `听到：${tail}`;
    heardEl.classList.add('show');
    heardTimer = setTimeout(() => heardEl.classList.remove('show'), 2800);
  }

  function render(state, { silent = false } = {}) {
    const pos = state.pos;
    const err = state.error;
    if (pos !== lastPos) {
      for (let i = 0; i < N; i++) {
        const el = chEls[i];
        const read = i < pos;
        if (el.classList.contains('read') !== read) el.classList.toggle('read', read);
        el.classList.toggle('cur', i === pos && phase !== 'idle');
      }
      bar.style.width = (pos / N) * 100 + '%';
    } else {
      chEls.forEach((el, i) => el.classList.toggle('cur', i === pos && phase !== 'idle'));
    }

    // 当前句
    const si = pos < N ? tokens[pos].sent : sentences.length - 1;
    if (si !== lastSent) {
      const activeSent = si === 0 && sentences.length > 1 ? new Set([0, 1]) : new Set([si]);
      sentEls.forEach((el, k) => {
        el.classList.toggle('on', k === si);
        el.classList.toggle('past', k < si);
        el.classList.toggle('cin-on', activeSent.has(k));
      });
      if (!silent && lastSent >= 0 && si > lastSent) sfx.sentence();
      lastSent = si;
      showArt(si);
    }
    if (!readerEl.classList.contains('cinema') && pos !== lastPos && pos < N) scrollToToken(pos);

    // 读错
    chEls.forEach((el) => el.classList.remove('err'));
    if (err && err.at < N) {
      const el = chEls[err.at];
      el.classList.add('err');
      showBubble(el, err);
      readerEl.classList.add('has-err');
      setStatus(`再读一遍「<b>${esc(tokens[err.at].ch)}</b>」`, 'warn');
    } else {
      hideBubble();
      readerEl.classList.remove('has-err');
      if (phase === 'listening') setStatus('我在听，请大声读～', 'live');
    }
    lastPos = pos;
  }

  function scrollToToken(pos) {
    const el = chEls[pos];
    if (!el) return;
    const pr = pageEl.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.top < pr.top + 36 || r.bottom > pr.bottom - 36) {
      pageEl.scrollTo({ top: pageEl.scrollTop + (r.top - pr.top) - pr.height * 0.35, behavior: 'smooth' });
    }
  }

  let bubbleFor = -1;
  function showBubble(el, err) {
    const t = tokens[err.at];
    if (bubbleFor !== err.at + err.heard) {
      bubbleFor = err.at + err.heard;
      bubble.innerHTML = `
        <div class="bb-main"><span class="bb-py">${esc(t.py)}</span><span class="bb-hz">${esc(t.ch)}</span></div>
        <div class="bb-side">
          <div>再读一遍哦</div>
          <small>听成了「${esc(err.heard)}」</small>
        </div>
        <button class="bb-say" aria-label="听一听">${icon('speaker')}</button>`;
      bubble.querySelector('.bb-say').onclick = (e) => {
        e.stopPropagation();
        if (!speak(t.ch)) toast('这台设备不支持朗读示范');
      };
      bubble.hidden = false;
      bubble.classList.remove('pop');
      void bubble.offsetWidth;
      bubble.classList.add('pop');
      el.classList.remove('shake');
      void el.offsetWidth;
      el.classList.add('shake');
      sfx.oops();
    }
  }
  function hideBubble() {
    bubbleFor = -1;
    bubble.hidden = true;
  }

  /* ---------------- 识别会话 ---------------- */
  let asr = null;
  let mic = null;
  let wakeLock = null;
  let activeMs = 0;
  let activeSince = 0;
  let reconnects = 0;

  const handlers = {
    onPartial: (text) => {
      setHeard(text);
      apply(matcher.feed(text, false));
    },
    onFinal: (text) => {
      setHeard(text);
      apply(matcher.feed(text, true));
    },
    onError: async (e) => {
      if (phase !== 'listening') return;
      if (reconnects < 2) {
        reconnects++;
        setStatus('网络有点慢，重新连接中…', 'warn');
        try {
          await asr.stop();
        } catch (er) {}
        try {
          asr = makeAsr();
          await asr.start();
          setStatus('我在听，请大声读～', 'live');
          return;
        } catch (er) {}
      }
      toast(e.message || '语音识别出错了');
      pause();
    },
  };

  function makeAsr() {
    return S.asr === 'demo'
      ? new DemoASR(handlers, { tokens, startPos: matcher.pos })
      : new AliyunASR(handlers);
  }

  function apply(state) {
    if (phase !== 'listening') return;
    render(state);
    if (state.done) finish();
  }

  let levelRaf = 0;
  let level = 0;
  function onLevel(v) {
    level = Math.min(1, v * 9);
    if (!levelRaf)
      levelRaf = requestAnimationFrame(() => {
        levelRaf = 0;
        micWrap.style.setProperty('--lv', level.toFixed(3));
      });
  }

  async function start() {
    if (matcher.done) await restart(true);
    setPhase('connecting', '准备中…');
    render(matcher.state(false), { silent: true });
    try {
      if (S.asr !== 'demo') {
        if (!mic) {
          mic = new Mic({ onPcm: (b) => asr && asr.feed(b), onLevel, record: S.record });
          await mic.start();
        } else mic.resume();
      }
      asr = makeAsr();
      await asr.start();
      reconnects = 0;
      activeSince = Date.now();
      setPhase('listening', '我在听，请大声读～');
      setStatus('我在听，请大声读～', 'live');
      render(matcher.state(false), { silent: true });
      requestWakeLock();
      if (S.asr === 'demo') fakeLevel();
    } catch (e) {
      console.error(e);
      if (asr) asr.stop().catch(() => {});
      asr = null;
      if (mic && phase === 'connecting') mic.pause();
      if (e && e.needCode) {
        setPhase('idle', '点一下话筒，输入口令即可开始');
        const entered = await askAccessCode(Boolean(settings.get().accessCode));
        if (entered) {
          settings.set({ accessCode: entered });
          return start();
        }
        return;
      }
      setPhase('idle');
      const msg =
        e && e.name === 'NotAllowedError'
          ? '需要允许使用麦克风哦（点地址栏左边的锁可以打开）'
          : (e && e.message) || '启动失败';
      setStatus(esc(msg), 'warn');
      if (S.asr !== 'demo' && /Token|token|接口/.test(msg)) {
        setStatus(esc(msg) + '　<button class="link" id="try-demo">先用演示模式看看</button>', 'warn');
        const b = root.querySelector('#try-demo');
        b && b.addEventListener('click', () => {
          settings.set({ asr: 'demo' });
          location.reload();
        });
      }
    }
  }

  let fakeTimer = 0;
  function fakeLevel() {
    clearInterval(fakeTimer);
    fakeTimer = setInterval(() => {
      if (phase !== 'listening') return clearInterval(fakeTimer);
      onLevel(0.02 + Math.random() * 0.06);
    }, 120);
  }

  async function pause(msg = '暂停啦，点话筒继续') {
    if (phase !== 'listening' && phase !== 'connecting') return;
    setPhase('paused', msg);
    if (activeSince) activeMs += Date.now() - activeSince;
    activeSince = 0;
    const a = asr;
    asr = null;
    if (a) await a.stop().catch(() => {});
    mic && mic.pause();
    micWrap.style.setProperty('--lv', 0);
    releaseWakeLock();
    render(matcher.state(false), { silent: true });
  }

  async function stopAll() {
    const a = asr;
    asr = null;
    if (a) await a.stop().catch(() => {});
    let rec = null;
    if (mic) rec = await mic.stop().catch(() => null);
    mic = null;
    if (activeSince) activeMs += Date.now() - activeSince;
    activeSince = 0;
    clearInterval(fakeTimer);
    clearTimeout(heardTimer);
    releaseWakeLock();
    micWrap.style.setProperty('--lv', 0);
    return rec;
  }

  async function restart(keepPhase) {
    await stopAll();
    matcher.reset(0);
    activeMs = 0;
    lastSent = -1;
    lastPos = -1;
    if (!keepPhase) setPhase('idle', '点一下话筒，开始读吧');
    render(matcher.state(false), { silent: true });
    pageEl.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function finish() {
    setPhase('done', '读完啦！');
    hideBubble();
    chEls.forEach((el) => el.classList.remove('cur'));
    const rec = await stopAll();
    const errors = matcher.errorCount || 0;
    const stars = starsFor(errors);
    const result = progress.complete(lesson.id, stars, STICKERS.length, STARS_PER_STICKER);
    if (rec && rec.blob) {
      try {
        await recordings.add(lesson.id, rec.blob, rec.duration, stars);
      } catch (e) {
        console.warn(e);
      }
    }
    readerEl.classList.add('celebrate');
    setTimeout(() => readerEl.classList.remove('celebrate'), 1600);
    sfx.win();
    confetti();
    setTimeout(() => showResult({ stars, errors, rec, newStickers: result.newStickers }), 700);
  }

  /* ---------------- 访问口令弹窗（每台设备只需输一次） ---------------- */
  function askAccessCode(wrong) {
    return new Promise((resolve) => {
      let val = '';
      const m = modal(
        `<form class="code-box">
          <h3>输入访问口令</h3>
          <p class="muted">${wrong ? '口令不对，请重新输入' : '在这台设备输一次就会自动记住'}</p>
          <input class="input code-input" type="text" inputmode="numeric" autocomplete="one-time-code" placeholder="请输入口令" />
          <div class="res-actions">
            <button type="button" class="btn ghost" data-close>取消</button>
            <button type="submit" class="btn primary">确定</button>
          </div>
        </form>`,
        { onClose: () => resolve(val) }
      );
      const inp = m.card.querySelector('input');
      setTimeout(() => inp && inp.focus(), 80);
      m.card.querySelector('form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const v = inp.value.trim();
        if (!v) return;
        val = v;
        m.close();
      });
    });
  }

  /* ---------------- 结果弹窗 ---------------- */
  function showResult({ stars, errors, rec, newStickers }) {
    const praise = ['继续加油哦！', '读得真好！', '太棒啦，满分！'][stars - 1];
    const url = rec && rec.blob ? URL.createObjectURL(rec.blob) : null;
    const sticker = newStickers.length ? STICKERS[newStickers[newStickers.length - 1]] : null;
    const m = modal(
      `<div class="result">
        <div class="res-stars">${[0, 1, 2]
          .map((i) => `<i class="${i < stars ? 'on' : ''}" style="--d:${i}">${icon('star')}</i>`)
          .join('')}</div>
        <h3>${praise}</h3>
        <p class="muted">用时 ${fmtTime(activeMs / 1000)} · ${errors ? `读错 ${errors} 个字` : '一个字都没读错'}</p>
        ${
          sticker
            ? `<div class="res-sticker" style="--bg:${sticker[2]}"><span class="emo">${sticker[0]}</span><div><b>获得新贴纸</b><small>${sticker[1]}</small></div></div>`
            : ''
        }
        ${url ? `<button class="btn ghost wide" id="res-play">${icon('play')}<span>听听我读的</span></button>` : ''}
        <div class="res-actions">
          <button class="btn ghost" id="res-again">${icon('restart')} 再读一次</button>
          <a class="btn primary" href="#/" data-close>${icon('book')} 回书架</a>
        </div>
      </div>`,
      {
        cls: 'pop-modal',
        onClose: () => {
          audio.pause();
          if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
        },
      }
    );
    [0, 1, 2].slice(0, stars).forEach((i) => setTimeout(() => sfx.star(i), 350 + i * 260));
    const playBtn = m.card.querySelector('#res-play');
    if (playBtn) playBtn.addEventListener('click', () => togglePlay(url, playBtn));
    m.card.querySelector('#res-again').addEventListener('click', () => {
      m.close();
      restart();
    });
  }

  /* ---------------- 录音回放 ---------------- */
  const audio = new Audio();
  let playingBtn = null;
  function togglePlay(url, btn) {
    if (playingBtn === btn && !audio.paused) {
      audio.pause();
      return;
    }
    if (playingBtn) playingBtn.classList.remove('playing');
    audio.src = url;
    audio.play().catch(() => toast('播放失败'));
    playingBtn = btn;
    btn.classList.add('playing');
    btn.querySelector('svg').outerHTML = icon('pause');
    const reset = () => {
      btn.classList.remove('playing');
      const svg = btn.querySelector('svg');
      if (svg) svg.outerHTML = icon('play');
    };
    audio.onended = audio.onpause = reset;
  }

  async function openRecordings() {
    const list = await recordings.list(lesson.id).catch(() => []);
    const urls = [];
    const m = modal(
      `<div class="recs">
        <div class="set-head"><h3>${icon('headphones')} 我的录音</h3><button class="icon-btn sm" data-close>${icon('close')}</button></div>
        ${
          list.length
            ? `<ul>${list
                .map((r, i) => {
                  const u = URL.createObjectURL(r.blob);
                  urls.push(u);
                  const d = new Date(r.createdAt);
                  return `<li>
                    <button class="play-btn" data-i="${i}">${icon('play')}</button>
                    <div class="rec-info"><b>${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}</b>
                    <small>${fmtTime(r.duration || 0)}</small></div>
                    <span class="stars sm">${[0, 1, 2].map((k) => `<i class="${k < (r.stars || 0) ? 'on' : ''}">${icon('star')}</i>`).join('')}</span>
                    <button class="icon-btn sm ghost" data-del="${r.id}" aria-label="删除">${icon('trash')}</button>
                  </li>`;
                })
                .join('')}</ul>`
            : `<div class="empty small">还没有录音<br/><small class="muted">读完一整篇就会自动保存</small></div>`
        }
      </div>`,
      {
        cls: 'sheet',
        onClose: () => {
          audio.pause();
          urls.forEach((u) => URL.revokeObjectURL(u));
        },
      }
    );
    m.card.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => togglePlay(urls[b.dataset.i], b)));
    m.card.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', async () => {
        await recordings.remove(Number(b.dataset.del));
        b.closest('li').remove();
      })
    );
  }

  /* ---------------- 屏幕常亮 ---------------- */
  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    } catch (e) {}
  }
  function releaseWakeLock() {
    try {
      wakeLock && wakeLock.release();
    } catch (e) {}
    wakeLock = null;
  }

  /* ---------------- 交互 ---------------- */
  async function restartDemo() {
    if (S.asr !== 'demo' || phase !== 'listening' || !asr) return;
    await asr.stop();
    asr = makeAsr();
    await asr.start();
  }

  function jumpToToken(t, msg) {
    if (phase === 'done') return;
    const st = matcher.jumpTo(t);
    lastPos = -1;
    render(st, { silent: true });
    restartDemo();
    if (msg) toast(msg, 1600);
  }

  micBtn.addEventListener('click', () => {
    if (phase === 'listening') pause();
    else if (phase !== 'connecting') start();
  });

  $('#btn-restart').addEventListener('click', () => {
    if (matcher.pos === 0 && phase === 'idle') return;
    restart();
    toast('从头开始读');
  });

  $('#btn-skip').addEventListener('click', () => {
    if (matcher.done) return;
    const st = matcher.skip();
    lastPos = -1;
    if (phase === 'idle' || phase === 'paused') render(st, { silent: true });
    else apply(st);
    restartDemo();
  });

  textEl.addEventListener('click', (e) => {
    const ch = e.target.closest('.ch');
    if (!ch) return;
    const t = Number(ch.dataset.t);
    jumpToToken(t, `从「${tokens[t].ch}」开始读`);
  });

  sceneThumbs.forEach((btn) =>
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.sc);
      const t = Number(btn.dataset.t);
      jumpToToken(t, `跳到第 ${idx + 1} 幅画面`);
    })
  );

  root.querySelectorAll('.word').forEach((b) =>
    b.addEventListener('click', () => {
      b.classList.remove('bump');
      void b.offsetWidth;
      b.classList.add('bump');
      speak(b.dataset.w);
    })
  );

  $('#btn-py').addEventListener('click', (e) => {
    const on = !readerEl.classList.contains('show-py');
    readerEl.classList.toggle('show-py', on);
    e.currentTarget.classList.toggle('on', on);
    settings.set({ showPinyin: on });
  });

  const cinemaBtn = $('#btn-cinema');
  const artFrameEl = $('.art-frame');
  const tbActionsEl = $('.tb-actions');
  function setCinema(on) {
    readerEl.classList.toggle('cinema', on);
    cinemaBtn.querySelector('.cb-lbl').textContent = on ? '退出全屏' : '全屏';
    cinemaBtn.setAttribute('aria-label', on ? '退出全屏绘本' : '全屏绘本');
    if (on) tbActionsEl.prepend(cinemaBtn);
    else artFrameEl.appendChild(cinemaBtn);
    if (!on && matcher.pos < N) requestAnimationFrame(() => scrollToToken(matcher.pos));
  }
  cinemaBtn.addEventListener('click', () => setCinema(!readerEl.classList.contains('cinema')));

  const onKey = (e) => {
    if (e.key === 'Escape' && readerEl.classList.contains('cinema')) setCinema(false);
  };
  document.addEventListener('keydown', onKey);

  $('#btn-rec').addEventListener('click', () => {
    if (phase === 'listening') pause();
    openRecordings();
  });

  $('#btn-set').addEventListener('click', async () => {
    if (phase === 'listening') await pause();
    if (await parentGate()) {
      openSettings(() => {
        const ns = settings.get();
        if (ns.asr !== S.asr || ns.record !== S.record) {
          location.reload();
          return;
        }
        S.level = ns.level;
        S.focus = ns.focus;
        S.sound = ns.sound;
        matcher.level = ns.level;
        readerEl.classList.toggle('focus-mode', ns.focus);
      });
    }
  });

  const demoBar = $('#demo-bar');
  if (demoBar) {
    demoBar.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = demoBar.querySelector('input');
      const v = input.value.trim();
      if (!v) return;
      input.value = '';
      setHeard(v);
      if (phase !== 'listening') {
        const prev = phase;
        phase = 'listening';
        apply(matcher.feed(v, true));
        if (phase === 'listening') phase = prev;
        return;
      }
      apply(matcher.feed(v, true));
    });
  }

  const onVis = () => {
    if (document.hidden && phase === 'listening') pause();
  };
  document.addEventListener('visibilitychange', onVis);

  // 初始渲染
  setPhase('idle');
  render(matcher.state(false), { silent: true });
  if (S.asr === 'demo') setStatus('演示模式：点话筒看自动朗读效果');

  return () => {
    document.removeEventListener('visibilitychange', onVis);
    document.removeEventListener('keydown', onKey);
    audio.pause();
    stopAll();
  };
}
