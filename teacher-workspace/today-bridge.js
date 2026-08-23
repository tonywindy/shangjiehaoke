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
  kps: [],
  judgements: [],
  questionSets: [],
  uses: [],
  tasks: [],
  notes: [],
  selectedNoteStudentIds: new Set(),
  aiDraft: null,
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

function getAll(store) {
  return new Promise((resolve, reject) => {
    const request = state.db.transaction(store, 'readonly').objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function putRecord(store, value) {
  return new Promise((resolve, reject) => {
    const request = state.db.transaction(store, 'readwrite').objectStore(store).put(value);
    request.onsuccess = () => resolve(value);
    request.onerror = () => reject(request.error);
  });
}

function localDate(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatTime(timestamp) {
  const date = new Date(timestamp || Date.now());
  const today = new Date();
  const prefix = date.toDateString() === today.toDateString()
    ? '今天'
    : `${date.getMonth() + 1}月${date.getDate()}日`;
  return `${prefix} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function notify(message) {
  const toast = $('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('on');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => toast.classList.remove('on'), 2200);
}

function latestJudgement(studentId, kpId) {
  for (let index = state.judgements.length - 1; index >= 0; index -= 1) {
    const item = state.judgements[index];
    if (item.studentId === studentId && item.kpId === kpId) return item;
  }
  return null;
}

function currentStatus(studentId, kpId) {
  const item = latestJudgement(studentId, kpId);
  return !item || item.status === 'cleared' ? 'unassessed' : item.status;
}

function currentNote(studentId, kpId) {
  return latestJudgement(studentId, kpId)?.note || '';
}

function setAction(row, label, count, link) {
  if (!row) return;
  row.removeAttribute('data-sheet');
  row.dataset.realLink = link;
  $('.tx', row).textContent = label;
  $('.n', row).textContent = count;
}

function renderPending() {
  const rows = $$('.conf .crow');
  const pendingHomework = state.tasks.filter((task) => task.status !== 'completed' && task.type === 'homework_followup').length;
  if (!state.classId) {
    setAction(rows[0], '创建班级并导入学生', 0, 'class.html?onboarding=students');
    setAction(rows[1], '导入知识点清单', 0, 'profile.html#onboardingCard');
    setAction(rows[2], '开始第一条学情判断', 0, 'profile.html#onboardingCard');
    return;
  }
  if (!state.students.length) {
    setAction(rows[0], '导入学生名单', 0, 'class.html?onboarding=students');
    setAction(rows[1], '导入知识点清单', state.kps.length, 'v07/index.html?focus=kps#class');
    setAction(rows[2], '开始第一条学情判断', 0, 'v07/index.html#matrix');
    return;
  }
  if (!state.kps.length) {
    setAction(rows[0], '学生名单已导入', state.students.length, 'class.html');
    setAction(rows[1], '导入知识点清单', 0, 'v07/index.html?focus=kps#class');
    setAction(rows[2], '开始第一条学情判断', 0, 'v07/index.html#matrix');
    return;
  }
  let missingNotes = 0;
  state.students.forEach((student) => state.kps.forEach((kp) => {
    if (currentStatus(student.id, kp.id) === 'needs_support' && !currentNote(student.id, kp.id)) missingNotes += 1;
  }));
  const pendingUses = state.uses.filter((use) => {
    const set = state.questionSets.find((item) => item.id === use.setId);
    if (!set) return false;
    const latest = latestJudgement(use.studentId, set.kpId);
    return !latest || latest.judgedAt <= use.usedAt;
  }).length;
  setAction(rows[0], '待跟进作业', pendingHomework, 'tasks.html');
  setAction(rows[1], '待补充错因', missingNotes, 'v07/index.html#matrix');
  setAction(rows[2], '题组使用后待回评', pendingUses, 'v07/index.html#library');
}

function renderLearningTable() {
  const tbody = $('.tbl tbody');
  if (!tbody) return;
  if (!state.students.length || !state.kps.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="padding:32px;text-align:center;color:var(--text-3)">导入学生和知识点后，这里会显示真实学情关注。</td></tr>';
    return;
  }
  const stats = state.kps.map((kp) => {
    const supportStudents = state.students.filter((student) => currentStatus(student.id, kp.id) === 'needs_support');
    const unassessedStudents = state.students.filter((student) => currentStatus(student.id, kp.id) === 'unassessed');
    return { kp, supportStudents, unassessedStudents };
  }).sort((a, b) => (
    b.supportStudents.length - a.supportStudents.length
    || b.unassessedStudents.length - a.unassessedStudents.length
  )).slice(0, 3);
  tbody.innerHTML = stats.map(({ kp, supportStudents, unassessedStudents }) => {
    const involved = supportStudents.length ? supportStudents : unassessedStudents;
    const label = supportStudents.length ? '待提升' : '未判断';
    const count = involved.length;
    return `<tr>
      <td>${escapeHTML(kp.name)} &nbsp;<span style="color:var(--text-2)">${count}人${label}</span></td>
      <td><span class="stat"><span class="b" style="background:${supportStudents.length ? 'var(--red)' : '#aeb4b8'}">!</span>${label}</span></td>
      <td><span class="stack">${involved.slice(0, 3).map((student, index) => `<span class="av" style="background:${['#e7a15c', '#7aa5dd', '#8bbf94'][index]}">${escapeHTML(student.name.trim().charAt(0))}</span>`).join('')}<span class="cnt">共${count}人</span></span></td>
      <td><a href="v07/index.html?kp=${encodeURIComponent(kp.id)}&unit=${encodeURIComponent(kp.unitName || '')}#matrix" class="golink">去查看</a></td>
    </tr>`;
  }).join('');
}

function taskTime(task) {
  return task.dueTime || '今天';
}

function renderPlan() {
  const plan = $('#plan');
  if (!plan) return;
  const today = localDate();
  const tasks = state.tasks
    .filter((task) => (task.dueDate || task.homeworkDate || today) <= today)
    .sort((a, b) => String(a.dueTime || '').localeCompare(String(b.dueTime || '')));
  if (!tasks.length) {
    plan.innerHTML = `<div style="padding:28px 12px;text-align:center;color:var(--text-3)">${state.classId ? '当前班级今天还没有计划' : '创建班级后，这里会显示今天的计划'}</div>`;
    return;
  }
  plan.innerHTML = tasks.slice(0, 8).map((task, index) => {
    const locked = task.type === 'homework_followup';
    return `<div class="pl${task.status === 'completed' ? ' done' : ''}${index > 2 ? ' later' : ''}" data-plan-task="${task.id}">
      <span class="rail"></span><span class="node"></span><span class="tm">${escapeHTML(taskTime(task))}</span>
      <span class="nm">${escapeHTML(task.title || task.homeworkTitle || '未命名任务')}</span>
      <span class="tags"><span class="tag">${escapeHTML(state.className)}</span><span class="tag ${locked ? 'g' : ''}">${escapeHTML(task.source || (locked ? '作业登记' : '任务'))}</span></span>
      <button class="cbox" type="button" ${locked ? 'disabled title="完成状态由作业记录同步"' : ''} aria-label="${task.status === 'completed' ? '恢复任务' : '完成任务'}"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="m4 12 5.5 5.5L20 7"/></svg></button>
    </div>`;
  }).join('');
}

function renderFeed() {
  const feed = $('#feed');
  if (!feed) return;
  const colors = {
    表扬: ['var(--amber-l)', 'var(--amber)'],
    提醒: ['var(--red-l)', 'var(--red)'],
    沟通: ['#f3eefb', '#8b67aa'],
    通知: ['var(--blue-l)', 'var(--blue)'],
    活动: ['var(--green-l)', 'var(--green)'],
  };
  if (!state.notes.length) {
    feed.innerHTML = `<div style="padding:32px 12px;text-align:center;color:var(--text-3)">${state.classId ? '当前班级还没有动态记录' : '创建班级后，这里会显示班级动态'}</div>`;
    return;
  }
  feed.innerHTML = state.notes.slice(0, 12).map((note) => {
    const pair = colors[note.category] || colors.活动;
    return `<div class="fi">
      <span class="dot"></span><span class="tm">${escapeHTML(formatTime(note.createdAt))}</span>
      <span class="sq" style="background:${pair[0]};color:${pair[1]}">记</span>
      <span class="bd"><span class="t">${escapeHTML(note.body || note.title || '班级记录')}</span>
      <span class="s">${note.studentNames?.length ? `相关学生：${escapeHTML(note.studentNames.join('、'))}` : '班级记录'}</span></span>
    </div>`;
  }).join('');
}

function renderSummary() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const completed = state.tasks.filter((task) => task.status === 'completed').length;
  const notesToday = state.notes.filter((note) => (note.createdAt || 0) >= todayStart.getTime()).length;
  const pending = state.tasks.filter((task) => task.status !== 'completed').length;
  const summary = $('.summary .txt');
  if (summary) summary.innerHTML = state.classId
    ? `当前班级已完成<b>${completed}</b>项任务，今天记录<b>${notesToday}</b>件班级事务，还有<b>${pending}</b>项需要继续跟进。`
    : '先创建班级并导入学生，工作台会在这里汇总每天的教学进展。';
  const done = $('#sDone');
  if (done) done.textContent = completed;
}

function mountAdminAi() {
  if (!isAdminAiUser()) return;
  $('#aiOrganizeBtn')?.classList.add('on');
  $('#aiSummaryBtn')?.classList.add('on');
}

function closeAiDraft() {
  state.aiDraft = null;
  const panel = $('#aiDraft');
  if (panel) {
    panel.hidden = true;
    panel.innerHTML = '';
  }
}

function aiStudentNames(tokens = []) {
  return state.aiDraft?.mask.studentsForTokens(tokens).map((item) => item.name) || [];
}

function renderAiDraft() {
  const panel = $('#aiDraft');
  const draft = state.aiDraft;
  if (!panel || !draft) return closeAiDraft();
  const categoryOptions = ['活动', '表扬', '提醒', '沟通', '通知'];
  const listOptions = ['收件箱', '班级管理', '学情评价', '家校沟通'];
  const records = draft.records.map((record, index) => {
    const names = aiStudentNames(record.studentTokens);
    return `<label class="ai-draft-item">
      <input type="checkbox" data-ai-record="${index}" checked aria-label="保存这条记录">
      <span class="ai-draft-fields">
        <input data-ai-record-body="${index}" maxlength="500" value="${escapeHTML(draft.mask.unmaskText(record.body))}" aria-label="记录内容">
        <select data-ai-record-category="${index}" aria-label="记录类别">${categoryOptions.map((category) => `<option ${category === record.category ? 'selected' : ''}>${category}</option>`).join('')}</select>
        <span class="ai-draft-meta">记录${names.length ? ` · 关联 ${escapeHTML(names.join('、'))}` : ' · 班级公共记录'}</span>
      </span>
    </label>`;
  }).join('');
  const tasks = draft.tasks.map((task, index) => {
    const names = aiStudentNames(task.studentTokens);
    return `<label class="ai-draft-item">
      <input type="checkbox" data-ai-task="${index}" checked aria-label="保存这条任务">
      <span class="ai-draft-fields">
        <input data-ai-task-title="${index}" maxlength="160" value="${escapeHTML(draft.mask.unmaskText(task.title))}" aria-label="任务内容">
        <input data-ai-task-date="${index}" type="date" value="${escapeHTML(task.dueDate)}" aria-label="任务日期">
        <select data-ai-task-list="${index}" aria-label="任务清单">${listOptions.map((list) => `<option ${list === task.list ? 'selected' : ''}>${list}</option>`).join('')}</select>
        <span class="ai-draft-meta">待办${task.dueTime ? ` · ${escapeHTML(task.dueTime)}` : ''}${names.length ? ` · 关联 ${escapeHTML(names.join('、'))}` : ''}</span>
      </span>
    </label>`;
  }).join('');
  const warnings = draft.uncertainties.length
    ? `<div class="ai-draft-warn">请确认：${draft.uncertainties.map((item) => escapeHTML(draft.mask.unmaskText(item))).join('；')}</div>`
    : '';
  panel.innerHTML = `<div class="ai-draft-head"><span class="mark">✦</span><div><h3>MiMo 整理草稿</h3><p>${escapeHTML(draft.mask.unmaskText(draft.summary))} · 确认后才会保存</p></div><span class="grow"></span></div>
    <div class="ai-draft-list">${records || ''}${tasks || ''}${!records && !tasks ? '<div style="padding:12px;color:var(--text-3)">没有识别到可保存的记录或任务。</div>' : ''}</div>
    ${warnings}<div class="ai-draft-actions"><button type="button" data-ai-cancel>放弃草稿</button><button type="button" class="confirm" data-ai-confirm>确认并保存</button></div>`;
  panel.hidden = false;
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function organizeComposerWithAi() {
  const button = $('#aiOrganizeBtn');
  const rawInput = $('#inp')?.value.trim() || '';
  if (!state.classId) return notify('请先创建班级并导入学生');
  if (!rawInput) return notify('请先输入要整理的内容');
  const mask = createStudentMask(state.students);
  button.disabled = true;
  button.innerHTML = '<span class="spark">✦</span>正在整理…';
  try {
    const result = await runAdminAi('organize', {
      text: mask.maskText(rawInput),
      currentDate: localDate(),
      currentCategory: $('#noteCategory')?.value || '活动',
      studentTokens: mask.studentTokens,
      selectedStudentTokens: mask.tokensForIds([...state.selectedNoteStudentIds]),
    });
    state.aiDraft = { ...result, mask, rawInput };
    renderAiDraft();
  } catch (error) {
    notify(error.message || 'AI整理失败，请稍后重试');
  } finally {
    button.disabled = false;
    button.innerHTML = '<span class="spark">✦</span>AI 智能整理';
  }
}

async function confirmAiDraft() {
  const draft = state.aiDraft;
  if (!draft) return;
  const timestamp = Date.now();
  const newNotes = draft.records.flatMap((record, index) => {
    if (!$(`[data-ai-record="${index}"]`)?.checked) return [];
    const body = $(`[data-ai-record-body="${index}"]`)?.value.trim();
    if (!body) return [];
    const students = draft.mask.studentsForTokens(record.studentTokens);
    return [{
      id: uid('note'), classId: state.classId,
      type: students.length ? 'student_note' : 'class_note',
      category: $(`[data-ai-record-category="${index}"]`)?.value || '活动',
      body, studentIds: students.map((item) => item.id), studentNames: students.map((item) => item.name),
      source: 'MiMo AI整理（教师确认）',
      aiSource: { model: draft._meta.model, rawInput: draft.rawInput, suggestedText: draft.mask.unmaskText(record.body), confirmedAt: timestamp },
      createdAt: timestamp + index, updatedAt: timestamp + index,
    }];
  });
  const newTasks = draft.tasks.flatMap((task, index) => {
    if (!$(`[data-ai-task="${index}"]`)?.checked) return [];
    const title = $(`[data-ai-task-title="${index}"]`)?.value.trim();
    if (!title) return [];
    const students = draft.mask.studentsForTokens(task.studentTokens);
    return [{
      id: uid('task'), classId: state.classId, type: 'manual', status: 'pending',
      title, dueDate: $(`[data-ai-task-date="${index}"]`)?.value || localDate(),
      dueTime: task.dueTime || '', list: $(`[data-ai-task-list="${index}"]`)?.value || '收件箱',
      studentIds: students.map((item) => item.id), studentNames: students.map((item) => item.name),
      fragment: Boolean(task.fragment), source: 'MiMo AI整理（教师确认）',
      aiSource: { model: draft._meta.model, rawInput: draft.rawInput, suggestedText: draft.mask.unmaskText(task.title), confirmedAt: timestamp },
      createdAt: timestamp + draft.records.length + index, updatedAt: timestamp + draft.records.length + index,
    }];
  });
  if (!newNotes.length && !newTasks.length) return notify('请至少保留一条记录或任务');
  await Promise.all([
    ...newNotes.map((note) => putRecord('notes', note)),
    ...newTasks.map((task) => putRecord('followupTasks', task)),
  ]);
  state.notes.unshift(...newNotes);
  state.tasks.unshift(...newTasks);
  $('#inp').value = '';
  $('#inp').style.height = '62px';
  $('#saveNoteBtn')?.classList.add('off');
  state.selectedNoteStudentIds.clear();
  closeAiDraft();
  renderStudentPicker();
  renderPending();
  renderPlan();
  renderFeed();
  renderSummary();
  notify(`已确认保存 ${newNotes.length} 条记录、${newTasks.length} 项任务`);
}

async function generateAiDailySummary() {
  const button = $('#aiSummaryBtn');
  const mask = createStudentMask(state.students);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const notes = state.notes.filter((note) => (note.createdAt || 0) >= todayStart.getTime()).slice(0, 24);
  const tasks = state.tasks.filter((task) => task.dueDate <= localDate() || task.status === 'completed').slice(0, 24);
  if (!notes.length && !tasks.length) return notify('今天还没有足够的记录可以总结');
  button.disabled = true;
  button.textContent = '✦ 正在生成…';
  try {
    const result = await runAdminAi('daily-summary', {
      currentDate: localDate(),
      records: notes.map((note) => ({
        category: note.category,
        body: mask.maskText(note.body),
        studentTokens: mask.tokensForIds(note.studentIds || []),
      })),
      tasks: tasks.map((task) => ({
        title: mask.maskText(task.title || ''), status: task.status, dueDate: task.dueDate,
        studentTokens: mask.tokensForIds(task.studentIds || []),
      })),
    });
    const summary = $('.summary .txt');
    if (summary) summary.innerHTML = `${escapeHTML(mask.unmaskText(result.summary))}${result.priorities.length ? `<span class="ai-priorities">下一步：${result.priorities.map((item) => escapeHTML(mask.unmaskText(item))).join('；')}</span>` : ''}`;
    notify('AI今日小结已生成');
  } catch (error) {
    notify(error.message || 'AI今日小结生成失败');
  } finally {
    button.disabled = false;
    button.textContent = '✦ AI 今日小结';
  }
}

async function saveComposerNote() {
  if (!state.classId) {
    notify('请先创建班级并导入学生');
    location.href = 'class.html?onboarding=students';
    return;
  }
  const input = $('#inp');
  const body = input?.value.trim();
  if (!body) return;
  const mentioned = [...body.matchAll(/@([^\s@，。,.、]{1,12})/g)].map((match) => match[1]);
  const students = state.students.filter((student) => state.selectedNoteStudentIds.has(student.id)
    || mentioned.some((name) => student.name.replace(/\s/g, '').includes(name.replace(/\s/g, ''))));
  const timestamp = Date.now();
  const note = {
    id: uid('note'),
    classId: state.classId,
    type: students.length ? 'student_note' : 'class_note',
    category: $('#noteCategory')?.value || '活动',
    body: body.replace(/@[^\s@，。,.、]{1,12}/g, '').replace(/\s+/g, ' ').trim() || body.replace(/@/g, ''),
    studentIds: students.map((student) => student.id),
    studentNames: students.map((student) => student.name),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await putRecord('notes', note);
  state.notes.unshift(note);
  input.value = '';
  input.style.height = '62px';
  state.selectedNoteStudentIds.clear();
  $('#saveNoteBtn')?.classList.add('off');
  renderStudentPicker();
  renderFeed();
  renderSummary();
  notify(students.length ? `已保存到${students.map((student) => student.name).join('、')}的档案` : '班级记录已保存');
}

function renderStudentPicker() {
  const query = ($('#studentSearch')?.value || '').trim().replace(/\s/g, '');
  const visible = state.students.filter((student) => !query || student.name.replace(/\s/g, '').includes(query));
  const options = $('#studentOptions');
  if (options) {
    options.innerHTML = visible.length
      ? visible.map((student) => `<button type="button" class="student-option ${state.selectedNoteStudentIds.has(student.id) ? 'on' : ''}" data-note-student="${student.id}" role="option" aria-selected="${state.selectedNoteStudentIds.has(student.id)}"><span class="check">✓</span><span class="name">${escapeHTML(student.name)}</span></button>`).join('')
      : '<div style="grid-column:1/-1;padding:18px;text-align:center;color:var(--text-3)">没有匹配的学生</div>';
  }
  const selected = state.students.filter((student) => state.selectedNoteStudentIds.has(student.id));
  const summary = $('#studentPickerSummary');
  if (summary) summary.textContent = selected.length ? `已选择 ${selected.length} 人` : '未选择学生';
  const chips = $('#selectedStudents');
  if (chips) {
    chips.hidden = !selected.length;
    chips.innerHTML = selected.map((student) => `<button type="button" class="chip" data-remove-note-student="${student.id}">@${escapeHTML(student.name)} ×</button>`).join('');
  }
}

function setStudentPicker(open) {
  const picker = $('#studentPicker');
  const trigger = $('#openStudentPicker');
  if (!picker || !trigger) return;
  picker.hidden = !open;
  trigger.setAttribute('aria-expanded', String(open));
  if (open) {
    renderStudentPicker();
    setTimeout(() => $('#studentSearch')?.focus(), 20);
  }
}

async function togglePlanTask(taskId) {
  const index = state.tasks.findIndex((task) => task.id === taskId);
  if (index < 0 || state.tasks[index].type === 'homework_followup') return;
  const completed = state.tasks[index].status !== 'completed';
  const task = {
    ...state.tasks[index],
    status: completed ? 'completed' : 'pending',
    completedAt: completed ? Date.now() : null,
    updatedAt: Date.now(),
  };
  await putRecord('followupTasks', task);
  state.tasks[index] = task;
  renderPlan();
  renderSummary();
  notify(completed ? '任务已完成' : '任务已恢复');
}

function bindEvents() {
  $('#inp')?.addEventListener('input', (event) => {
    $('#saveNoteBtn')?.classList.toggle('off', !event.target.value.trim());
    event.target.style.height = 'auto';
    event.target.style.height = `${Math.max(62, event.target.scrollHeight)}px`;
    if (state.aiDraft) closeAiDraft();
  });
  $('#studentSearch')?.addEventListener('input', renderStudentPicker);
  document.addEventListener('click', (event) => {
    if (event.target.closest('#saveNoteBtn')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveComposerNote().catch(() => notify('记录保存失败，请重试'));
      return;
    }
    if (event.target.closest('#aiOrganizeBtn')) {
      event.preventDefault();
      organizeComposerWithAi();
      return;
    }
    if (event.target.closest('#aiSummaryBtn')) {
      event.preventDefault();
      generateAiDailySummary();
      return;
    }
    if (event.target.closest('[data-ai-cancel]')) {
      closeAiDraft();
      return;
    }
    if (event.target.closest('[data-ai-confirm]')) {
      event.preventDefault();
      confirmAiDraft().catch(() => notify('AI草稿保存失败，请重试'));
      return;
    }
    if (event.target.closest('#openStudentPicker')) {
      event.preventDefault();
      setStudentPicker($('#studentPicker')?.hidden !== false);
      return;
    }
    if (event.target.closest('#closeStudentPicker')) {
      event.preventDefault();
      setStudentPicker(false);
      return;
    }
    if (event.target.closest('#clearSelectedStudents')) {
      state.selectedNoteStudentIds.clear();
      renderStudentPicker();
      return;
    }
    const studentChoice = event.target.closest('[data-note-student]');
    if (studentChoice) {
      const id = studentChoice.dataset.noteStudent;
      if (state.selectedNoteStudentIds.has(id)) state.selectedNoteStudentIds.delete(id);
      else state.selectedNoteStudentIds.add(id);
      renderStudentPicker();
      return;
    }
    const removeStudent = event.target.closest('[data-remove-note-student]');
    if (removeStudent) {
      state.selectedNoteStudentIds.delete(removeStudent.dataset.removeNoteStudent);
      renderStudentPicker();
      return;
    }
    const pending = event.target.closest('[data-real-link]');
    if (pending) {
      event.preventDefault();
      event.stopImmediatePropagation();
      location.href = pending.dataset.realLink;
      return;
    }
    const planTask = event.target.closest('[data-plan-task]');
    if (planTask && event.target.closest('.cbox')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      togglePlanTask(planTask.dataset.planTask).catch(() => notify('任务状态保存失败'));
      return;
    }
    if (event.target.closest('.more')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      location.href = 'class.html';
    }
  }, true);
  document.addEventListener('keydown', (event) => {
    if (event.target.id === 'inp' && event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveComposerNote().catch(() => notify('记录保存失败，请重试'));
    }
  }, true);
}

function simplifyComposer() {
  const action = $('#saveNoteBtn');
  if (action) {
    action.textContent = '记下来';
    action.setAttribute('aria-label', '保存班级记录');
  }
  $$('.composer .icobtn').forEach((button) => button.remove());
  const classButton = $('.composer .mini-sel:not([data-ins])');
  if (classButton) {
    classButton.dataset.classPicker = 'true';
    classButton.innerHTML = `${escapeHTML(state.className)} <span aria-hidden="true">⌄</span>`;
  }
}

function updateTeacherGreeting() {
  const session = window.TeacherWorkspaceAccess?.session;
  const savedName = session?.user?.displayName?.trim();
  const cachedName = (session?.user?.id && localStorage.getItem(`sjhk-workspace-display-name:${session.user.id}`))
    || localStorage.getItem('sjhk-workspace-display-name');
  const username = session?.user?.username?.trim();
  const teacherName = savedName
    || cachedName?.trim()
    || (username ? (username.endsWith('老师') ? username : `${username}老师`) : (window.TeacherWorkspaceAccess?.isExperience ? '甘老师' : '老师'));
  const hour = new Date().getHours();
  const greeting = hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
  const greetingNode = document.getElementById('hi');
  if (greetingNode) greetingNode.textContent = `${greeting}，${teacherName}`;
}

async function init() {
  await window.TeacherWorkspaceAccess?.ready;
  updateTeacherGreeting();
  DB_NAME = window.TeacherWorkspaceAccess?.databaseName || DB_NAME;
  await window.TeacherClassManager?.ready;
  state.db = await openDatabase();
  const [meta, classes, students, kps, judgements, questionSets, uses, tasks, notes] = await Promise.all([
    getAll('meta'), getAll('classes'), getAll('students'), getAll('kps'), getAll('judgements'),
    getAll('questionSets'), getAll('questionSetUses'), getAll('followupTasks'), getAll('notes'),
  ]);
  state.classId = meta.find((item) => item.id === 'active-class-id')?.value || '';
  state.className = classes.find((item) => item.id === state.classId)?.name || '尚未创建班级';
  const scoped = (item) => Boolean(state.classId) && (item.classId || 'class-local') === state.classId;
  state.students = students.filter(scoped).sort((a, b) => a.sortOrder - b.sortOrder);
  state.kps = kps.filter(scoped).filter((kp) => !kp.archivedAt).sort((a, b) => a.sortOrder - b.sortOrder);
  state.judgements = judgements.filter(scoped).sort((a, b) => a.judgedAt - b.judgedAt);
  state.questionSets = questionSets.filter(scoped);
  state.uses = uses.filter(scoped);
  state.tasks = tasks.filter(scoped).map((task) => ({
    ...task,
    dueDate: task.dueDate || task.homeworkDate || localDate(),
    source: task.source || (task.type === 'homework_followup' ? '作业登记' : '任务'),
  }));
  state.notes = notes.filter(scoped).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  mountAdminAi();
  simplifyComposer();
  renderStudentPicker();
  bindEvents();
  renderPending();
  renderLearningTable();
  renderPlan();
  renderFeed();
  renderSummary();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => init().catch((error) => {
    console.error(error);
    notify('首页数据暂时无法读取');
  }), { once: true });
} else {
  init().catch((error) => {
    console.error(error);
    notify('首页数据暂时无法读取');
  });
}
