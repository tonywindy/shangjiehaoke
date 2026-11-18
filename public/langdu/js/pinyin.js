/**
 * 拼音工具：把课文切成可朗读的"字"序列，并提供读音比对
 */
const P = window.pinyinPro;

export const HANZI_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

/** 'xiang1' -> { base:'xiang', tone:1 } ；统一 ü -> v */
function splitNum(s) {
  s = String(s || '').trim().replace(/ü/g, 'v').replace(/u:/g, 'v');
  const m = s.match(/^([a-zv]+)([0-5])?$/i);
  if (!m) return { base: s.toLowerCase(), tone: 0 };
  const tone = m[2] ? Number(m[2]) % 5 : 0;
  return { base: m[1].toLowerCase(), tone };
}

function symbolToNum(sym) {
  return P.convert(sym, { format: 'symbolToNum' });
}

/**
 * 把一课内容编译成渲染/比对所需的数据
 * 返回 { sentences:[{text,image,isTitle,para,items:[...]}], tokens:[...] }
 * items: { kind:'hz', t:tokenIndex } | { kind:'punct', ch }
 */
export function compileLesson(lesson) {
  const newSet = new Set(lesson.newChars || []);
  const overrides = lesson.pinyinOverrides || {};
  const tokens = [];
  const sentences = [];

  const raw = [{ text: lesson.title, isTitle: true, para: -1, image: lesson.image || null }];
  (lesson.paragraphs || []).forEach((p, pi) => {
    (p.sentences || []).forEach((s, si) => {
      raw.push({ text: s.text, image: s.image || null, para: pi, paraStart: si === 0, isTitle: false });
    });
  });

  raw.forEach((s, sIdx) => {
    const text = s.text;
    const arr = P.pinyin(text, { type: 'all', toneSandhi: false });
    const pys = arr.map((x) => x.pinyin);

    // 人工校对的多音字覆盖
    for (const [word, py] of Object.entries(overrides)) {
      const parts = py.trim().split(/\s+/);
      let from = 0;
      let at;
      while ((at = text.indexOf(word, from)) !== -1) {
        for (let k = 0; k < word.length && k < parts.length; k++) pys[at + k] = parts[k];
        from = at + word.length;
      }
    }

    const items = [];
    [...text].forEach((ch, k) => {
      if (HANZI_RE.test(ch)) {
        const py = pys[k] || '';
        const { base, tone } = splitNum(symbolToNum(py));
        const t = {
          i: tokens.length,
          ch,
          py,
          base,
          tone,
          sent: sIdx,
          isNew: newSet.has(ch),
        };
        tokens.push(t);
        items.push({ kind: 'hz', t: t.i });
      } else if (ch.trim()) {
        items.push({ kind: 'punct', ch });
      }
    });

    sentences.push({ ...s, items, first: items.find((x) => x.kind === 'hz')?.t ?? null });
  });

  // 每句的最后一个字索引
  sentences.forEach((s) => {
    const hz = s.items.filter((x) => x.kind === 'hz');
    s.last = hz.length ? hz[hz.length - 1].t : null;
  });

  return { sentences, tokens };
}

/* ---------------- 读音比对 ---------------- */

const readingCache = new Map();
/** 一个字所有可能的读音 [{base,tone}] */
export function readingsOf(ch) {
  if (readingCache.has(ch)) return readingCache.get(ch);
  let list = [];
  try {
    list = P.pinyin(ch, { multiple: true, type: 'array', toneType: 'num' }).map(splitNum);
  } catch (e) {
    list = [];
  }
  readingCache.set(ch, list);
  return list;
}

/** 模糊音归一（宽松模式） */
function fuzzy(base) {
  let b = base;
  b = b.replace(/^zh/, 'z').replace(/^ch/, 'c').replace(/^sh/, 's');
  b = b.replace(/^n(?!g)/, 'l');
  b = b.replace(/ing$/, 'in').replace(/eng$/, 'en').replace(/ang$/, 'an');
  return b;
}

/**
 * 识别到的字 heard 是否算读对了目标字 token
 * level: 'loose' | 'normal' | 'strict'
 */
export function isMatch(heard, token, level = 'normal') {
  if (heard === token.ch) return true;
  const rs = readingsOf(heard);
  for (const r of rs) {
    if (level === 'loose') {
      if (fuzzy(r.base) === fuzzy(token.base)) return true;
    } else if (level === 'normal') {
      if (r.base === token.base) return true;
    } else {
      if (r.base === token.base && (r.tone === token.tone || r.tone === 0 || token.tone === 0)) return true;
    }
  }
  return false;
}
