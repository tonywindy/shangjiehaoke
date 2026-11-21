/**
 * 家长设置
 */
import { settings, progress } from '../store.js';
import { modal, icon, esc, toast } from '../ui.js';

function seg(name, value, opts) {
  return `<div class="seg" data-name="${name}">${opts
    .map(([v, label]) => `<button type="button" class="${v === value ? 'on' : ''}" data-v="${v}">${label}</button>`)
    .join('')}</div>`;
}
function sw(name, on) {
  return `<button type="button" class="switch ${on ? 'on' : ''}" data-name="${name}" role="switch" aria-checked="${on}"><i></i></button>`;
}

export function openSettings(onChange) {
  const s = settings.get();
  const CFG = window.APP_CONFIG || {};
  const m = modal(
    `<div class="settings">
      <div class="set-head">
        <h3>${icon('gear')} 家长设置</h3>
        <button class="icon-btn sm" data-close aria-label="关闭">${icon('close')}</button>
      </div>

      <div class="set-group">
        <label class="set-row"><span>孩子的名字</span><input class="input" name="childName" value="${esc(s.childName)}" maxlength="8"/></label>
      </div>

      <div class="set-group">
        <div class="set-label">朗读判定</div>
        <div class="set-row col">
          <span>严格程度</span>
          ${seg('level', s.level, [
            ['loose', '宽松'],
            ['normal', '标准'],
            ['strict', '严格'],
          ])}
          <small class="muted" id="level-tip"></small>
        </div>
        <div class="set-row"><span>当前句子聚焦</span>${sw('focus', s.focus)}</div>
        <div class="set-row"><span>带读模式（读一句跟一句）</span>${sw('leadMode', s.leadMode)}</div>
      </div>

      <div class="set-group">
        <div class="set-label">显示与声音</div>
        <div class="set-row"><span>默认显示拼音</span>${sw('showPinyin', s.showPinyin)}</div>
        <div class="set-row"><span>字号</span>${seg('fontSize', s.fontSize, [
          ['s', '小'],
          ['m', '中'],
          ['l', '大'],
          ['xl', '超大'],
        ])}</div>
        <div class="set-row"><span>音效</span>${sw('sound', s.sound)}</div>
        <div class="set-row"><span>朗读时录音</span>${sw('record', s.record)}</div>
      </div>

      <div class="set-group">
        <div class="set-label">语音识别</div>
        <div class="set-row"><span>识别方式</span>${seg('asr', s.asr, [
          ['aliyun', '阿里云'],
          ['demo', '演示模式'],
        ])}</div>
        <label class="set-row col"><span>Token 接口地址</span><input class="input" name="tokenUrl" placeholder="${esc(CFG.tokenUrl || '/api/aliyun-token')}" value="${esc(s.tokenUrl)}"/></label>
        <label class="set-row col"><span>访问口令（后端设置了才需要填）</span><input class="input" name="accessCode" value="${esc(s.accessCode)}" autocomplete="off"/></label>
      </div>

      <div class="set-group">
        <button class="btn danger-ghost" id="reset-progress">${icon('trash')} 清空星星和进度</button>
      </div>
    </div>`,
    { cls: 'sheet', onClose: () => onChange && onChange() }
  );

  const card = m.card;
  const tips = {
    loose: '声母韵母相近就算对（如 z/zh、n/l、in/ing），适合刚开始练习。',
    normal: '拼音对就算对，不看声调。推荐。',
    strict: '拼音和声调都要对。识别服务对声调判断有限，可能误判。',
  };
  const tip = card.querySelector('#level-tip');
  const showTip = () => (tip.textContent = tips[settings.get().level]);
  showTip();

  card.querySelectorAll('.seg').forEach((el) =>
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      el.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      settings.set({ [el.dataset.name]: b.dataset.v });
      showTip();
    })
  );
  card.querySelectorAll('.switch').forEach((el) =>
    el.addEventListener('click', () => {
      const on = !el.classList.contains('on');
      el.classList.toggle('on', on);
      el.setAttribute('aria-checked', on);
      settings.set({ [el.dataset.name]: on });
    })
  );
  card.querySelectorAll('input[name]').forEach((el) =>
    el.addEventListener('change', () => settings.set({ [el.name]: el.value.trim() || (el.name === 'childName' ? '宝贝' : '') }))
  );
  card.querySelector('#reset-progress').addEventListener('click', () => {
    if (confirm('确定要清空所有星星、贴纸和阅读记录吗？')) {
      progress.reset();
      toast('已清空');
    }
  });
  return m;
}
