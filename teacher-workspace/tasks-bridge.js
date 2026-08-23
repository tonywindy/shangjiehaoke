import { createStudentMask, isAdminAiUser, runAdminAi } from './ai-client.js';

let DB_NAME = 'shangjiehaoke-teacher-workspace-v07';
const DB_VERSION = 5;
const STORES = [
  'meta', 'classes', 'students', 'kps', 'judgements', 'questionSets',
  'questionSetUses', 'reasonTemplates', 'homeworks', 'homeworkEntries',
  'followupTasks', 'notes',
];

const state = {
  db: null,
  classId: '',
  className: '尚未创建班级',
  students: [],
  tasks: [],
  filter: '今天',
  activeTaskId: '',
  aiParsedTask: null,
  aiParsedInput: '',
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
})[char]);
const uid = (prefix) => `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      STORES.forEach((store) => {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: 'id' });
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAll(storeName) {
  return new Promise((resolve, reject) => {
    const request = state.db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function putTask(task) {
  return new Promise((resolve, reject) => {
    const request = state.db.transaction('followupTasks', 'readwrite').objectStore('followupTasks').put(task);
    request.onsuccess = () => resolve(task);
    request.onerror = () => reject(request.error);
  });
}

function deleteTaskRecord(id) {
  return new Promise((resolve, reject) => {
    const request = state.db.transaction('followupTasks', 'readwrite').objectStore('followupTasks').delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function localDate(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateOffset(days) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return localDate(date);
}

function shortDate(value) {
  if (!value) return '无日期';
  const today = localDate();
  if (value === today) return '今天';
  if (value === dateOffset(1)) return '明天';
  const parts = value.split('-');
  return parts.length === 3 ? `${Number(parts[1])}月${Number(parts[2])}日` : value;
}

function notify(message) {
  const toast = $('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('on');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => toast.classList.remove('on'), 2200);
}

function isHomeworkTask(task) {
  return task.type === 'homework_followup';
}

function normalizeTask(task) {
  return {
    ...task,
    classId: task.classId || 'class-local',
    status: task.status === 'completed' ? 'completed' : 'pending',
    dueDate: task.dueDate || task.homeworkDate || localDate(),
    list: task.list || (isHomeworkTask(task) ? '班级管理' : '收件箱'),
    source: task.source || (isHomeworkTask(task) ? '作业登记' : '我添加'),
    studentIds: task.studentIds || [],
    studentNames: task.studentNames || [],
  };
}

function matchesFilter(task) {
  const today = localDate();
  const weekLater = dateOffset(7);
  if (state.filter === '收件箱') return task.status !== 'completed';
  if (state.filter === '今天') return task.status !== 'completed' && task.dueDate <= today && !task.fragment;
  if (state.filter === '即将到来') return task.status !== 'completed' && task.dueDate > today && task.dueDate <= weekLater && !task.fragment;
  if (state.filter === '以后') return task.status !== 'completed' && task.dueDate > weekLater && !task.fragment;
  if (state.filter === '已完成') return task.status === 'completed';
  if (state.filter === '碎片清单') return task.status !== 'completed' && task.fragment;
  if (['班级管理', '学情评价', '家校沟通'].includes(state.filter)) {
    return task.status !== 'completed' && task.list === state.filter;
  }
  return task.status !== 'completed';
}

function taskRow(task, overdue = false) {
  const students = task.studentNames?.length
    ? `<span class="chip stu">学生：${escapeHTML(task.studentNames.slice(0, 3).join('、'))}${task.studentNames.length > 3 ? `等${task.studentNames.length}人` : ''}</span>`
    : '';
  const statusLocked = isHomeworkTask(task);
  const outcome = isHomeworkTask(task)
    ? `${task.partialCount ? `<span class="chip" style="color:#a86713;background:#fff5df">部分 ${task.partialCount}</span>` : ''}
       ${task.incompleteCount ? `<span class="chip" style="color:var(--red);background:var(--red-l)">未完成 ${task.incompleteCount}</span>` : ''}`
    : '';
  return `<div class="tk persist-task${task.status === 'completed' ? ' done' : ''}" data-task-id="${task.id}" data-src="${escapeHTML(task.source)}">
    <button class="tbox" type="button" ${statusLocked ? 'disabled title="完成状态由作业记录同步"' : `aria-label="${task.status === 'completed' ? '恢复任务' : '完成任务'}"`}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="m4 12 5.5 5.5L20 7"/></svg>
    </button>
    <span class="tt">${escapeHTML(task.title || task.homeworkTitle || '未命名任务')}</span>
    ${students}<span class="grow"></span>
    <span class="due${overdue ? ' od' : ''}">${overdue ? '原定' : ''}${escapeHTML(shortDate(task.dueDate))}${task.dueTime ? ` ${escapeHTML(task.dueTime)}` : ''}</span>
    ${outcome}
    <span class="chip src">来源：${escapeHTML(task.source)}</span>
    <span class="chip">${escapeHTML(state.className)}</span>
    <button class="dots" type="button" aria-label="打开任务操作"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="5" r=".6"/><circle cx="12" cy="12" r=".6"/><circle cx="12" cy="19" r=".6"/></svg></button>
  </div>`;
}

function renderCounts() {
  const pending = state.tasks.filter((task) => task.status !== 'completed');
  const today = localDate();
  const counts = {
    收件箱: pending.length,
    今天: pending.filter((task) => task.dueDate <= today && !task.fragment).length,
    已完成: state.tasks.filter((task) => task.status === 'completed').length,
  };
  $$('.vi').forEach((button) => {
    const count = counts[button.dataset.v];
    const badge = $('.ct', button);
    if (badge && count !== undefined) badge.textContent = count;
  });
}

function renderTasks() {
  const today = localDate();
  const visible = state.tasks.filter(matchesFilter).sort((a, b) => (
    a.status.localeCompare(b.status)
    || String(a.dueDate).localeCompare(String(b.dueDate))
    || (b.createdAt || 0) - (a.createdAt || 0)
  ));
  const overdue = state.filter === '今天' ? visible.filter((task) => task.dueDate < today) : [];
  const current = state.filter === '今天' ? visible.filter((task) => task.dueDate === today) : visible;
  $('#odRows').innerHTML = overdue.map((task) => taskRow(task, true)).join('');
  $('#odSec').style.display = overdue.length ? '' : 'none';
  $('#odN').textContent = overdue.length;
  $('#todayRows').innerHTML = current.map((task) => taskRow(task)).join('');
  const emptyTarget = $('#todayRows');
  if (!overdue.length && !current.length) {
    emptyTarget.innerHTML = `<div style="padding:46px 18px;text-align:center;color:var(--text-3);line-height:1.8">“${escapeHTML(state.filter)}”中还没有任务<br><span style="font-size:12px">可以在上方快速添加</span></div>`;
  }
  $('#listT').textContent = state.filter;
  $('#dn').textContent = state.tasks.filter((task) => task.status === 'completed').length;
  $('#tt').textContent = state.tasks.length;
  renderCounts();
  $$('.vi').forEach((button) => button.classList.toggle('on', button.dataset.v === state.filter));
}

function parseQuickTask(value) {
  let text = value.trim();
  let dueDate = localDate();
  if (/明天/.test(text)) dueDate = dateOffset(1);
  else if (/后天/.test(text)) dueDate = dateOffset(2);
  const cnDate = text.match(/(\d{1,2})月(\d{1,2})日/);
  if (cnDate) dueDate = `${new Date().getFullYear()}-${String(cnDate[1]).padStart(2, '0')}-${String(cnDate[2]).padStart(2, '0')}`;
  const time = text.match(/([01]?\d|2[0-3]):([0-5]\d)/);
  const names = [...text.matchAll(/@([^\s@，。,.、!#~]{1,12})/g)].map((match) => match[1]);
  const matchedStudents = state.students.filter((student) => names.some((name) => student.name.replace(/\s/g, '').includes(name.replace(/\s/g, ''))));
  const fragmentMinutes = text.match(/~\s*(\d+)\s*分钟?/);
  text = text
    .replace(/明天|后天/g, '')
    .replace(/\d{1,2}月\d{1,2}日/g, '')
    .replace(/([01]?\d|2[0-3]):([0-5]\d)/g, ' ')
    .replace(/@[^\s@，。,.、!#~]{1,12}/g, '')
    .replace(/~\s*\d+\s*分钟?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    title: text || value.trim(),
    dueDate,
    dueTime: time ? `${String(time[1]).padStart(2, '0')}:${time[2]}` : '',
    studentIds: matchedStudents.map((student) => student.id),
    studentNames: matchedStudents.map((student) => student.name),
    fragment: fragmentMinutes ? Number(fragmentMinutes[1]) <= 3 : false,
  };
}

function renderQuickInputState() {
  const input = $('#qi');
  const row = $('#qrow2');
  const addButton = $('#qadd');
  const aiButton = $('#qai');
  const wrapper = $('#qa');
  if (!input || !row || !addButton || !wrapper) return;
  const value = input.value.trim();
  wrapper.classList.toggle('idle', !value);
  addButton.classList.toggle('off', !value);
  if (!value) {
    row.innerHTML = '<span class="pc" style="opacity:.55">输入内容后会在这里显示识别结果</span>';
    if (aiButton) row.append(aiButton);
    row.append(addButton);
    return;
  }
  const usingAi = state.aiParsedTask && state.aiParsedInput === value;
  const parsed = usingAi ? state.aiParsedTask : parseQuickTask(value);
  const chips = [];
  if (usingAi) chips.push('<span class="pc d">✦ MiMo 已解析</span>');
  if (usingAi || /明天|后天|\d{1,2}月\d{1,2}日/.test(value) || /([01]?\d|2[0-3]):([0-5]\d)/.test(value)) {
    chips.push(`<span class="pc d">${escapeHTML(shortDate(parsed.dueDate))}${parsed.dueTime ? ` ${escapeHTML(parsed.dueTime)}` : ''}</span>`);
  }
  parsed.studentNames.forEach((name) => chips.push(`<span class="pc s">@${escapeHTML(name)}</span>`));
  if (parsed.fragment) chips.push('<span class="pc s">≤ 3 分钟</span>');
  row.innerHTML = chips.join('') || '<span class="pc s">仅标题 · 会进收件箱</span>';
  if (aiButton) row.append(aiButton);
  row.append(addButton);
}

async function parseTaskWithAi() {
  const input = $('#qi');
  const value = input?.value.trim() || '';
  if (!value) return notify('请先输入任务内容');
  if (!state.classId) return notify('请先创建班级并导入学生');
  const button = $('#qai');
  const mask = createStudentMask(state.students);
  button.disabled = true;
  button.textContent = '✦ 正在解析…';
  try {
    const result = await runAdminAi('organize', {
      text: mask.maskText(value),
      currentDate: localDate(),
      studentTokens: mask.studentTokens,
      selectedStudentTokens: [],
      taskOnly: true,
    });
    const task = result.tasks?.[0];
    if (!task) throw new Error('没有识别到明确的待办，请换一种说法');
    const students = mask.studentsForTokens(task.studentTokens);
    state.aiParsedInput = value;
    state.aiParsedTask = {
      title: mask.unmaskText(task.title),
      dueDate: task.dueDate || localDate(),
      dueTime: task.dueTime || '',
      list: task.list || '收件箱',
      studentIds: students.map((item) => item.id),
      studentNames: students.map((item) => item.name),
      fragment: Boolean(task.fragment),
      aiSource: { model: result._meta.model, rawInput: value, suggestedText: mask.unmaskText(task.title) },
    };
    renderQuickInputState();
    notify('AI解析完成，请确认后添加');
  } catch (error) {
    notify(error.message || 'AI任务解析失败');
  } finally {
    button.disabled = false;
    button.textContent = '✦ AI 解析';
  }
}

async function addTaskFromQuickInput() {
  const input = $('#qi');
  const value = input?.value.trim();
  if (!value) return;
  if (!state.classId) {
    notify('请先创建班级并导入学生');
    location.href = 'class.html?onboarding=students';
    return;
  }
  const access = window.TeacherWorkspaceAccess;
  const manualTaskCount = state.tasks.filter((task) => task.type !== 'homework_followup' && task.type !== 'demo').length;
  if (access?.isExperience && manualTaskCount >= access.limits.manualTasks) {
    access.requireFeature('unlimitedTasks');
    return;
  }
  const usingAi = state.aiParsedTask && state.aiParsedInput === value;
  const parsed = usingAi ? state.aiParsedTask : parseQuickTask(value);
  const timestamp = Date.now();
  const record = normalizeTask({
    id: uid('task'),
    classId: state.classId,
    type: 'manual',
    status: 'pending',
    source: usingAi ? 'MiMo AI解析（教师确认）' : '我添加',
    list: parsed.list || '收件箱',
    createdAt: timestamp,
    updatedAt: timestamp,
    ...parsed,
  });
  await putTask(record);
  state.tasks.unshift(record);
  input.value = '';
  state.aiParsedTask = null;
  state.aiParsedInput = '';
  renderQuickInputState();
  state.filter = record.fragment ? '碎片清单' : (record.dueDate <= localDate() ? '今天' : '即将到来');
  renderTasks();
  notify('任务已保存');
}

function openSheet() {
  $('#sheet').classList.add('on');
  $('#scrim').classList.add('on');
}

function closeSheet() {
  $('#sheet').classList.remove('on');
  $('#scrim').classList.remove('on');
  state.activeTaskId = '';
}

function renderTaskDetail(confirmDelete = false) {
  const task = state.tasks.find((item) => item.id === state.activeTaskId);
  if (!task) return closeSheet();
  $('#shT').textContent = task.title;
  const locked = isHomeworkTask(task);
  $('#shB').innerHTML = `<form id="persistTaskForm">
    <div class="pnl">
      <div class="pt">任务信息</div>
      <label style="display:block;margin-bottom:10px">任务名称<input name="title" ${locked ? 'disabled' : ''} value="${escapeHTML(task.title)}" required maxlength="80" style="display:block;width:100%;height:40px;margin-top:6px;border:1px solid var(--line);border-radius:10px;padding:0 10px"></label>
      <label style="display:block;margin-bottom:10px">到期日期<input name="dueDate" ${locked ? 'disabled' : ''} type="date" value="${escapeHTML(task.dueDate)}" required style="display:block;width:100%;height:40px;margin-top:6px;border:1px solid var(--line);border-radius:10px;padding:0 10px"></label>
      <label style="display:block">清单<select name="list" ${locked ? 'disabled' : ''} style="display:block;width:100%;height:40px;margin-top:6px;border:1px solid var(--line);border-radius:10px;padding:0 10px;background:#fff">
        ${['收件箱', '班级管理', '学情评价', '家校沟通'].map((name) => `<option ${task.list === name ? 'selected' : ''}>${name}</option>`).join('')}
      </select></label>
      ${task.studentNames.length ? `<p style="margin-top:12px;color:var(--text-2)">关联学生：${escapeHTML(task.studentNames.join('、'))}</p>` : ''}
      ${locked ? '<p style="margin-top:12px;color:var(--text-3)">这条任务由作业登记自动同步，请在作业记录中更新完成情况。</p>' : ''}
    </div>
    ${confirmDelete ? `<div class="pnl" style="border-color:var(--red)"><div class="pt" style="color:var(--red)">确定删除这条任务吗？</div><p style="color:var(--text-2)">删除后无法恢复。</p></div>` : ''}
    <div class="acts">
      ${locked ? `<button type="button" class="act pri2" data-task-action="view-homework">查看作业记录</button>` : `
        <button type="submit" class="act pri2">保存修改</button>
        <button type="button" class="act" data-task-action="toggle">${task.status === 'completed' ? '恢复为待办' : '标记完成'}</button>
        <button type="button" class="act" data-task-action="tomorrow">改到明天</button>
        <button type="button" class="act" data-task-action="fragment">${task.fragment ? '移出碎片清单' : '加入碎片清单'}</button>
        ${confirmDelete
          ? '<button type="button" class="act" data-task-action="cancel-delete">取消</button><button type="button" class="act danger" data-task-action="confirm-delete">确定删除</button>'
          : '<button type="button" class="act danger" data-task-action="delete">删除</button>'}
      `}
    </div>
  </form>`;
  openSheet();
}

async function updateActiveTask(changes, message) {
  const index = state.tasks.findIndex((item) => item.id === state.activeTaskId);
  if (index < 0) return;
  const updated = { ...state.tasks[index], ...changes, updatedAt: Date.now() };
  await putTask(updated);
  state.tasks[index] = updated;
  renderTasks();
  renderTaskDetail();
  notify(message);
}

async function handleTaskAction(action) {
  const task = state.tasks.find((item) => item.id === state.activeTaskId);
  if (!task) return;
  if (action === 'toggle') {
    const completed = task.status !== 'completed';
    await updateActiveTask({ status: completed ? 'completed' : 'pending', completedAt: completed ? Date.now() : null }, completed ? '任务已完成' : '任务已恢复');
  } else if (action === 'tomorrow') {
    await updateActiveTask({ dueDate: dateOffset(1), status: 'pending' }, '已改到明天');
  } else if (action === 'fragment') {
    await updateActiveTask({ fragment: !task.fragment }, task.fragment ? '已移出碎片清单' : '已加入碎片清单');
  } else if (action === 'delete') {
    renderTaskDetail(true);
  } else if (action === 'cancel-delete') {
    renderTaskDetail(false);
  } else if (action === 'confirm-delete') {
    await deleteTaskRecord(task.id);
    state.tasks = state.tasks.filter((item) => item.id !== task.id);
    closeSheet();
    renderTasks();
    notify('任务已删除');
  } else if (action === 'view-homework') {
    location.href = `class.html?homework=${encodeURIComponent(task.homeworkId)}`;
  }
}

function bindEvents() {
  $('#qi')?.addEventListener('input', () => {
    state.aiParsedTask = null;
    state.aiParsedInput = '';
    renderQuickInputState();
  });
  $('#qclr')?.addEventListener('click', (event) => {
    event.preventDefault();
    const input = $('#qi');
    if (!input) return;
    input.value = '';
    state.aiParsedTask = null;
    state.aiParsedInput = '';
    renderQuickInputState();
    input.focus();
  });
  document.addEventListener('click', (event) => {
    const view = event.target.closest('.vi[data-v]');
    if (view) {
      event.preventDefault();
      event.stopImmediatePropagation();
      state.filter = view.dataset.v;
      renderTasks();
      return;
    }
    if (event.target.closest('#qadd')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      addTaskFromQuickInput().catch(() => notify('任务保存失败'));
      return;
    }
    if (event.target.closest('#qai')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      parseTaskWithAi();
      return;
    }
    const row = event.target.closest('.persist-task');
    if (row) {
      event.preventDefault();
      event.stopImmediatePropagation();
      state.activeTaskId = row.dataset.taskId;
      if (event.target.closest('.tbox') && !event.target.closest('.tbox').disabled) {
        handleTaskAction('toggle');
      } else {
        renderTaskDetail();
      }
      return;
    }
    const action = event.target.closest('[data-task-action]');
    if (action) {
      event.preventDefault();
      event.stopImmediatePropagation();
      handleTaskAction(action.dataset.taskAction).catch(() => notify('操作失败，请重试'));
      return;
    }
    if (event.target.closest('#shX') || event.target.id === 'scrim') {
      event.stopImmediatePropagation();
      closeSheet();
    }
  }, true);
  document.addEventListener('keydown', (event) => {
    if (event.target.id === 'qi' && event.key === 'Enter') {
      event.preventDefault();
      event.stopImmediatePropagation();
      addTaskFromQuickInput().catch(() => notify('任务保存失败'));
    }
  }, true);
  document.addEventListener('submit', (event) => {
    if (event.target.id !== 'persistTaskForm') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const task = state.tasks.find((item) => item.id === state.activeTaskId);
    if (!task || isHomeworkTask(task)) return;
    const formData = new FormData(event.target);
    updateActiveTask({
      title: String(formData.get('title') || '').trim(),
      dueDate: String(formData.get('dueDate') || localDate()),
      list: String(formData.get('list') || '收件箱'),
    }, '任务修改已保存').catch(() => notify('保存失败，请重试'));
  }, true);
}

async function init() {
  await window.TeacherWorkspaceAccess?.ready;
  DB_NAME = window.TeacherWorkspaceAccess?.databaseName || DB_NAME;
  await window.TeacherClassManager?.ready;
  state.db = await openDatabase();
  const [meta, classes, students, tasks] = await Promise.all([
    getAll('meta'), getAll('classes'), getAll('students'), getAll('followupTasks'),
  ]);
  state.classId = meta.find((item) => item.id === 'active-class-id')?.value || '';
  state.className = classes.find((item) => item.id === state.classId)?.name || '尚未创建班级';
  const scoped = (item) => Boolean(state.classId) && (item.classId || 'class-local') === state.classId;
  state.students = students.filter(scoped).sort((a, b) => a.sortOrder - b.sortOrder);
  state.tasks = tasks.filter(scoped).map(normalizeTask);
  if (isAdminAiUser()) $('#qai')?.classList.add('on');
  bindEvents();
  renderTasks();
  renderQuickInputState();
  const requestedTask = new URLSearchParams(location.search).get('task');
  if (requestedTask && state.tasks.some((task) => task.id === requestedTask)) {
    state.activeTaskId = requestedTask;
    renderTaskDetail();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => init().catch((error) => {
    console.error(error);
    notify('任务数据暂时无法读取');
  }), { once: true });
} else {
  init().catch((error) => {
    console.error(error);
    notify('任务数据暂时无法读取');
  });
}
