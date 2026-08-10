let DB_NAME = 'shangjiehaoke-teacher-workspace-v07';
const DB_VERSION = 5;
const STORES = [
  'meta', 'classes', 'students', 'kps', 'judgements', 'questionSets',
  'questionSetUses', 'reasonTemplates', 'homeworks', 'homeworkEntries',
  'followupTasks', 'notes',
];

const state = {
  db: null,
  classId: 'class-local',
  className: '四年级1班',
  students: [],
  kps: [],
  judgements: [],
  questionSets: [],
  uses: [],
  tasks: [],
  notes: [],
  selectedNoteStudentIds: new Set(),
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
  if (!state.students.length) {
    setAction(rows[0], '导入学生名单', 0, 'v07/index.html?view=class&focus=students#class');
    setAction(rows[1], '导入知识点清单', state.kps.length, 'v07/index.html?view=class&focus=kps#class');
    setAction(rows[2], '开始第一条学情判断', 0, 'v07/index.html#matrix');
    return;
  }
  if (!state.kps.length) {
    setAction(rows[0], '学生名单已导入', state.students.length, 'class.html');
    setAction(rows[1], '导入知识点清单', 0, 'v07/index.html?view=class&focus=kps#class');
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
    plan.innerHTML = '<div style="padding:28px 12px;text-align:center;color:var(--text-3)">当前班级今天还没有计划</div>';
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
    feed.innerHTML = '<div style="padding:32px 12px;text-align:center;color:var(--text-3)">当前班级还没有动态记录</div>';
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
  if (summary) summary.innerHTML = `当前班级已完成<b>${completed}</b>项任务，今天记录<b>${notesToday}</b>件班级事务，还有<b>${pending}</b>项需要继续跟进。`;
  const done = $('#sDone');
  if (done) done.textContent = completed;
}

async function saveComposerNote() {
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
  });
  $('#studentSearch')?.addEventListener('input', renderStudentPicker);
  document.addEventListener('click', (event) => {
    if (event.target.closest('#saveNoteBtn')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveComposerNote().catch(() => notify('记录保存失败，请重试'));
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

async function init() {
  await window.TeacherWorkspaceAccess?.ready;
  DB_NAME = window.TeacherWorkspaceAccess?.databaseName || DB_NAME;
  await window.TeacherClassManager?.ready;
  state.db = await openDatabase();
  const [meta, classes, students, kps, judgements, questionSets, uses, tasks, notes] = await Promise.all([
    getAll('meta'), getAll('classes'), getAll('students'), getAll('kps'), getAll('judgements'),
    getAll('questionSets'), getAll('questionSetUses'), getAll('followupTasks'), getAll('notes'),
  ]);
  state.classId = meta.find((item) => item.id === 'active-class-id')?.value || 'class-local';
  state.className = classes.find((item) => item.id === state.classId)?.name || '四年级1班';
  const scoped = (item) => (item.classId || 'class-local') === state.classId;
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
