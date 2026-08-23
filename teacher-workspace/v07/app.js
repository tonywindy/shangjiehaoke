import { readSheet } from 'read-excel-file/browser';
import { pinyin } from 'pinyin-pro';
import { BNUP_G4S1_KPS, BNUP_G4S1_TEMPLATE_META } from './bnup-grade4-sem1-kps.js';
import bnuKnowledgeTemplateUrl from '../assets/北师大版四年级上册数学知识点清单.xlsx?url';
import { isAdminAiUser, runAdminAi } from '../ai-client.js';

let DB_NAME = 'shangjiehaoke-teacher-workspace-v07';
const DB_VERSION = 5;
const STORES = [
  'meta',
  'classes',
  'students',
  'kps',
  'judgements',
  'questionSets',
  'questionSetUses',
  'reasonTemplates',
  'homeworks',
  'homeworkEntries',
  'followupTasks',
  'notes',
];
const CLASS_SCOPED_STORES = STORES.filter((store) => !['meta', 'classes'].includes(store));

const state = {
  db: null,
  students: [],
  kps: [],
  judgements: [],
  questionSets: [],
  uses: [],
  reasonTemplates: [],
  homeworks: [],
  homeworkEntries: [],
  followupTasks: [],
  activeClassId: '',
  activeView: 'matrix',
  activeUnit: '',
  selectedStudentId: null,
  selectedKpId: null,
  seatConfig: { rows: 6, desks: 3, seatsPerDesk: 2 },
  seatAssignments: {},
  seatEdit: false,
  seatRosterQuery: '',
  seatRosterLetter: '全部',
  selectedRosterStudentId: null,
  seatHistory: [],
  editingQuestionSetId: null,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const templateDownload = $('#downloadKpTemplate');
if (templateDownload) templateDownload.href = bnuKnowledgeTemplateUrl;
const uid = (prefix) => `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
const now = () => Date.now();
const formatDate = (timestamp) => new Intl.DateTimeFormat('zh-CN', {
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date(timestamp));

function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[char]);
}

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

function dbGetAll(storeName) {
  return new Promise((resolve, reject) => {
    const request = state.db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbPut(storeName, value) {
  return new Promise((resolve, reject) => {
    const request = state.db.transaction(storeName, 'readwrite').objectStore(storeName).put(value);
    request.onsuccess = () => resolve(value);
    request.onerror = () => reject(request.error);
  });
}

function dbDelete(storeName, id) {
  return new Promise((resolve, reject) => {
    const request = state.db.transaction(storeName, 'readwrite').objectStore(storeName).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function belongsToActiveClass(item) {
  return Boolean(state.activeClassId) && (item.classId || 'class-local') === state.activeClassId;
}

function dbReplaceForActiveClass(storeName, values) {
  return new Promise((resolve, reject) => {
    const tx = state.db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        if (belongsToActiveClass(cursor.value)) cursor.delete();
        cursor.continue();
        return;
      }
      values.forEach((value) => store.put({ ...value, classId: state.activeClassId }));
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function dbClearForActiveClass(storeName) {
  return dbReplaceForActiveClass(storeName, []);
}

async function saveSeatState() {
  await Promise.all([
    dbPut('meta', { id: `seat-config:${state.activeClassId}`, value: state.seatConfig }),
    dbPut('meta', { id: `seat-assignments:${state.activeClassId}`, value: state.seatAssignments }),
  ]);
}

async function refreshState() {
  const allData = await Promise.all([
    dbGetAll('students'),
    dbGetAll('kps'),
    dbGetAll('judgements'),
    dbGetAll('questionSets'),
    dbGetAll('questionSetUses'),
    dbGetAll('reasonTemplates'),
    dbGetAll('homeworks'),
    dbGetAll('homeworkEntries'),
    dbGetAll('followupTasks'),
  ]);

  const meta = await dbGetAll('meta');
  state.activeClassId = meta.find((item) => item.id === 'active-class-id')?.value || '';
  [
    state.students,
    state.kps,
    state.judgements,
    state.questionSets,
    state.uses,
    state.reasonTemplates,
    state.homeworks,
    state.homeworkEntries,
    state.followupTasks,
  ] = allData.map((items) => items.filter(belongsToActiveClass));
  state.seatConfig = meta.find((item) => item.id === `seat-config:${state.activeClassId}`)?.value
    || (state.activeClassId === 'class-local' ? meta.find((item) => item.id === 'seat-config')?.value : null)
    || { rows: 6, desks: 3, seatsPerDesk: 2 };
  state.seatAssignments = meta.find((item) => item.id === `seat-assignments:${state.activeClassId}`)?.value
    || (state.activeClassId === 'class-local' ? meta.find((item) => item.id === 'seat-assignments')?.value : null)
    || {};
  state.students.sort((a, b) => a.sortOrder - b.sortOrder);
  state.kps.sort((a, b) => a.sortOrder - b.sortOrder);
  state.judgements.sort((a, b) => a.judgedAt - b.judgedAt);
  state.questionSets.sort((a, b) => b.createdAt - a.createdAt);
  state.uses.sort((a, b) => b.usedAt - a.usedAt);
  state.reasonTemplates.sort((a, b) => (b.usageCount - a.usageCount) || (b.updatedAt - a.updatedAt));
  state.homeworks.sort((a, b) => b.createdAt - a.createdAt);
  state.homeworkEntries.sort((a, b) => b.createdAt - a.createdAt);
  state.followupTasks.sort((a, b) => b.createdAt - a.createdAt);

  const units = getUnits();
  if (!units.includes(state.activeUnit)) state.activeUnit = units[0] || '';
}

function getUnits() {
  return [...new Set(state.kps.filter((kp) => !kp.archivedAt).map((kp) => kp.unitName))];
}

function latestJudgement(studentId, kpId) {
  for (let i = state.judgements.length - 1; i >= 0; i -= 1) {
    const item = state.judgements[i];
    if (item.studentId === studentId && item.kpId === kpId) return item;
  }
  return null;
}

function currentStatus(studentId, kpId) {
  const item = latestJudgement(studentId, kpId);
  if (!item || item.status === 'cleared') return 'unassessed';
  return item.status;
}

function currentNote(studentId, kpId) {
  return latestJudgement(studentId, kpId)?.note || '';
}

function statusLabel(status) {
  return {
    unassessed: '未判断',
    mastered: '已掌握',
    needs_support: '待提升',
    cleared: '清除判断',
  }[status] || status;
}

let toastTimer;
function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('show'), 2200);
}

async function setInitialized(value = true) {
  await dbPut('meta', { id: `initialized:${state.activeClassId}`, value });
}

async function isInitialized() {
  const meta = await dbGetAll('meta');
  return meta.find((item) => item.id === `initialized:${state.activeClassId}`)?.value === true
    || (state.activeClassId === 'class-local' && meta.find((item) => item.id === 'initialized')?.value === true);
}

function renderAll() {
  renderUnits();
  renderMatrix();
  renderDetail();
  renderLibrary();
  renderClass();
  renderDataStats();
  $('#libraryCount').textContent = state.questionSets.length;
}

function renderUnits() {
  const select = $('#unitSelect');
  const units = getUnits();
  select.innerHTML = units.map((unit) => `<option value="${escapeHTML(unit)}">${escapeHTML(unit)}</option>`).join('');
  select.value = state.activeUnit;
  $('#unitPickerWrap').classList.toggle('hidden', state.activeView !== 'matrix' || !units.length);
}

function renderMatrix() {
  const kps = state.kps.filter((kp) => !kp.archivedAt && kp.unitName === state.activeUnit);
  const hasData = state.students.length > 0 && kps.length > 0;
  $('#matrixScroll').classList.toggle('hidden', !hasData);
  $('#matrixEmpty').classList.toggle('hidden', hasData);
  $('#matrixTitle').textContent = state.activeUnit || '本单元知识判断';

  const latestMap = new Map();
  state.students.forEach((student) => {
    kps.forEach((kp) => latestMap.set(`${student.id}:${kp.id}`, currentStatus(student.id, kp.id)));
  });
  const statuses = [...latestMap.values()];
  $('#masteredCount').textContent = statuses.filter((status) => status === 'mastered').length;
  $('#supportCount').textContent = statuses.filter((status) => status === 'needs_support').length;
  $('#unassessedCount').textContent = statuses.filter((status) => status === 'unassessed').length;
  $('#noteCount').textContent = state.students.reduce((total, student) => total + kps.filter((kp) => currentNote(student.id, kp.id)).length, 0);

  if (!hasData) {
    $('#matrixHead').innerHTML = '';
    $('#matrixBody').innerHTML = '';
    return;
  }

  $('#matrixHead').innerHTML = `<tr>
    <th scope="col">学生</th>
    ${kps.map((kp, index) => `<th scope="col"><span class="kp-head"><b>${escapeHTML(kp.name)}</b><span>知识点 ${index + 1}</span></span></th>`).join('')}
  </tr>`;

  $('#matrixBody').innerHTML = state.students.map((student) => `<tr>
    <td>${escapeHTML(student.name)}</td>
    ${kps.map((kp) => {
      const status = currentStatus(student.id, kp.id);
      const symbol = status === 'mastered' ? '✓' : status === 'needs_support' ? '×' : '·';
      const note = currentNote(student.id, kp.id);
      return `<td class="state-cell">
        <span class="state-wrap">
          <button
            class="state-button ${status === 'unassessed' ? '' : status}"
            data-cycle-status
            data-student-id="${student.id}"
            data-kp-id="${kp.id}"
            aria-label="${escapeHTML(student.name)}，${escapeHTML(kp.name)}，当前${statusLabel(status)}，点击切换状态"
            title="点击切换：未判断 → 已掌握 → 待提升"
          >${symbol}</button>
          ${status === 'needs_support' ? `<button class="detail-trigger" data-open-detail data-student-id="${student.id}" data-kp-id="${kp.id}" aria-label="查看${escapeHTML(student.name)}在${escapeHTML(kp.name)}的错因与补差出题">${note ? '✎' : '…'}</button>` : ''}
        </span>
      </td>`;
    }).join('')}
  </tr>`).join('');
}

function selectCell(studentId, kpId, focusNote = false) {
  state.selectedStudentId = studentId;
  state.selectedKpId = kpId;
  renderDetail();
  if (focusNote) requestAnimationFrame(() => $('#noteInput')?.focus());
}

function clearSelection() {
  state.selectedStudentId = null;
  state.selectedKpId = null;
  renderDetail();
}

function renderDetail() {
  const student = state.students.find((item) => item.id === state.selectedStudentId);
  const kp = state.kps.find((item) => item.id === state.selectedKpId);
  const visible = Boolean(student && kp);
  $('#detailEmpty').classList.toggle('hidden', visible);
  $('#detailContent').classList.toggle('hidden', !visible);
  if (!visible) return;

  const status = currentStatus(student.id, kp.id);
  const note = currentNote(student.id, kp.id);
  $('#detailStudent').textContent = student.name;
  $('#detailKp').textContent = `${kp.unitName} · ${kp.name}`;
  $$('.status-control button').forEach((button) => button.classList.toggle('active', button.dataset.status === status));
  $('#noteInput').value = note;
  $('#setTitle').value = `${kp.name}${note ? ` · ${note}` : ''} · ${new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(new Date())}`;
  $('#setContent').value = '';
  renderReasonChips(kp.unitName);

  const history = state.judgements
    .filter((item) => item.studentId === student.id && item.kpId === kp.id)
    .sort((a, b) => b.judgedAt - a.judgedAt);
  $('#historyCount').textContent = `${history.length} 条`;
  $('#judgementHistory').innerHTML = history.length
    ? history.map((item) => `<div class="history-item">
        <i></i>
        <div><b>${formatDate(item.judgedAt)} · ${statusLabel(item.status)}</b>${item.note ? `<p>${escapeHTML(item.note)}</p>` : ''}</div>
      </div>`).join('')
    : '<p class="use-list">还没有判断记录。</p>';
}

function renderReasonChips(unitName) {
  const items = state.reasonTemplates.filter((item) => item.unitName === unitName).slice(0, 8);
  $('#reasonChips').innerHTML = items.length
    ? items.map((item) => `<span class="reason-chip">
        <button class="reason-use" type="button" data-reason="${escapeHTML(item.text)}">${escapeHTML(item.text)}</button>
        <button class="reason-delete" type="button" data-delete-reason="${item.id}" aria-label="删除错因模板：${escapeHTML(item.text)}">×</button>
      </span>`).join('')
    : '<span class="reason-empty">本单元还没有积累错因</span>';
}

async function saveReasonTemplate(unitName, text) {
  if (!text) return;
  const existing = state.reasonTemplates.find((item) => item.unitName === unitName && item.text === text);
  const record = existing
    ? { ...existing, usageCount: existing.usageCount + 1, updatedAt: now() }
    : { id: uid('reason'), classId: state.activeClassId, unitName, text, usageCount: 1, updatedAt: now() };
  await dbPut('reasonTemplates', record);
  if (existing) Object.assign(existing, record);
  else state.reasonTemplates.push(record);
  state.reasonTemplates.sort((a, b) => (b.usageCount - a.usageCount) || (b.updatedAt - a.updatedAt));
}

async function deleteReasonTemplate(reasonId) {
  const item = state.reasonTemplates.find((reason) => reason.id === reasonId);
  if (!item || !confirm(`确定删除常用错因“${item.text}”吗？已有学生判断中的错因文字会保留。`)) return;
  await dbDelete('reasonTemplates', reasonId);
  state.reasonTemplates = state.reasonTemplates.filter((reason) => reason.id !== reasonId);
  renderReasonChips(item.unitName);
  renderDataStats();
  toast('常用错因已删除');
}

async function appendJudgement(studentId, kpId, displayStatus, note = '') {
  const record = {
    id: uid('judgement'),
    classId: state.activeClassId,
    studentId,
    kpId,
    status: displayStatus === 'unassessed' ? 'cleared' : displayStatus,
    note: note.trim(),
    judgedAt: now(),
  };
  await dbPut('judgements', record);
  state.judgements.push(record);
}

async function changeStatus(studentId, kpId, status, { focusNote = false } = {}) {
  const previousNote = currentNote(studentId, kpId);
  await appendJudgement(studentId, kpId, status, status === 'needs_support' ? previousNote : '');
  selectCell(studentId, kpId, focusNote || (status === 'needs_support' && !previousNote));
  renderMatrix();
  renderDetail();
  renderDataStats();
  toast(`已记为“${statusLabel(status)}”`);
}

async function cycleStatus(button) {
  const { studentId, kpId } = button.dataset;
  const sequence = ['unassessed', 'mastered', 'needs_support'];
  const current = currentStatus(studentId, kpId);
  const next = sequence[(sequence.indexOf(current) + 1) % sequence.length];
  await changeStatus(studentId, kpId, next, { focusNote: next === 'needs_support' });
}

let noteSaveTimer;
async function saveCurrentNote() {
  const student = state.students.find((item) => item.id === state.selectedStudentId);
  const kp = state.kps.find((item) => item.id === state.selectedKpId);
  if (!student || !kp) return;
  const note = $('#noteInput').value.trim();
  if (note === currentNote(student.id, kp.id)) {
    $('#noteSaved').textContent = '已自动保存';
    return;
  }
  const status = currentStatus(student.id, kp.id);
  await appendJudgement(student.id, kp.id, status === 'unassessed' ? 'needs_support' : status, note);
  await saveReasonTemplate(kp.unitName, note);
  $('#noteSaved').textContent = '已自动保存';
  setTimeout(() => { $('#noteSaved').textContent = ''; }, 1600);
  renderMatrix();
  renderReasonChips(kp.unitName);
  renderDataStats();
}

async function saveQuestionSet() {
  const kp = state.kps.find((item) => item.id === state.selectedKpId);
  const student = state.students.find((item) => item.id === state.selectedStudentId);
  const content = $('#setContent').value.trim();
  if (!kp || !student) return;
  if (!content) {
    toast('请先粘贴生成的题目');
    $('#setContent').focus();
    return;
  }
  const record = {
    id: uid('question-set'),
    classId: state.activeClassId,
    kpId: kp.id,
    title: $('#setTitle').value.trim() || `${kp.name} · 练习题`,
    errorTag: currentNote(student.id, kp.id),
    content,
    createdAt: now(),
  };
  await dbPut('questionSets', record);
  state.questionSets.unshift(record);
  $('#setContent').value = '';
  $('#libraryCount').textContent = state.questionSets.length;
  renderLibrary();
  renderDataStats();
  toast('已保存到题库');
}

function renderLibrary() {
  const query = $('#librarySearch')?.value.trim().toLowerCase() || '';
  const items = state.questionSets.filter((set) => {
    const kp = state.kps.find((item) => item.id === set.kpId);
    return `${set.title} ${set.errorTag} ${set.content} ${kp?.name || ''}`.toLowerCase().includes(query);
  });
  $('#libraryEmpty').classList.toggle('hidden', state.questionSets.length > 0);
  $('#libraryList').classList.toggle('hidden', state.questionSets.length === 0);

  $('#libraryList').innerHTML = items.length ? items.map((set) => {
    const kp = state.kps.find((item) => item.id === set.kpId);
    const uses = state.uses.filter((item) => item.setId === set.id);
    const usedStudentIds = new Set(uses.map((use) => use.studentId));
    const useNames = uses.map((use) => state.students.find((student) => student.id === use.studentId)?.name).filter(Boolean);
    if (state.editingQuestionSetId === set.id) {
      return `<article class="library-card editing" data-set-card="${set.id}">
        <div class="library-edit">
          <label class="field"><span>题组标题</span><input data-edit-set-title maxlength="80" value="${escapeHTML(set.title)}"></label>
          <label class="field"><span>对应知识点</span><select data-edit-set-kp>
            ${state.kps.filter((item) => !item.archivedAt).map((item) => `<option value="${item.id}" ${item.id === set.kpId ? 'selected' : ''}>${escapeHTML(item.unitName)} · ${escapeHTML(item.name)}</option>`).join('')}
          </select></label>
          <label class="field"><span>错因标签</span><input data-edit-set-tag maxlength="80" value="${escapeHTML(set.errorTag || '')}"></label>
          <label class="field"><span>题组内容</span><textarea data-edit-set-content rows="10">${escapeHTML(set.content)}</textarea></label>
        </div>
        <div class="library-actions">
          <button class="button primary" type="button" data-save-set-edit="${set.id}">保存修改</button>
          <button class="button secondary" type="button" data-cancel-set-edit>取消</button>
        </div>
      </article>`;
    }
    return `<article class="library-card">
      <div>
        <h3>${escapeHTML(set.title)}</h3>
        <div class="library-meta">
          <span>${escapeHTML(kp?.unitName || '已归档单元')}</span>
          <span>${escapeHTML(kp?.name || '已归档知识点')}</span>
          ${set.errorTag ? `<span>错因：${escapeHTML(set.errorTag)}</span>` : ''}
          <span>${formatDate(set.createdAt)}</span>
        </div>
        <div class="library-content">${escapeHTML(set.content)}</div>
        <div class="use-list">${useNames.length ? `已使用：${escapeHTML(useNames.join('、'))}` : '尚未记录使用学生'}</div>
      </div>
      <div class="library-actions">
        <select data-use-student="${set.id}" aria-label="选择使用这套题的学生">
          <option value="">选择学生</option>
          ${state.students.map((student) => `<option value="${student.id}">${usedStudentIds.has(student.id) ? '✓ ' : ''}${escapeHTML(student.name)}</option>`).join('')}
        </select>
        <button class="button secondary" data-mark-used="${set.id}">标记已使用</button>
        <button class="button secondary" data-jump-kp="${set.kpId}">回到对应矩阵</button>
        <button class="button secondary" data-edit-set="${set.id}">编辑题组</button>
        <button class="button danger" data-delete-set="${set.id}">删除题组</button>
      </div>
    </article>`;
  }).join('') : '<div class="empty-state"><span>⌕</span><h3>没有匹配的题组</h3><p>换一个关键词试试。</p></div>';
}

function updateUseToggle(setId) {
  const select = $(`[data-use-student="${setId}"]`);
  const button = $(`[data-mark-used="${setId}"]`);
  const studentId = select?.value;
  if (!button) return;
  const exists = studentId && state.uses.some((item) => item.setId === setId && item.studentId === studentId);
  button.textContent = exists ? '撤销使用记录' : '标记已使用';
  button.classList.toggle('danger', Boolean(exists));
}

async function toggleSetUsed(setId) {
  const select = $(`[data-use-student="${setId}"]`);
  const studentId = select?.value;
  if (!studentId) {
    toast('请先选择学生');
    select?.focus();
    return;
  }
  const existing = state.uses.filter((item) => item.setId === setId && item.studentId === studentId);
  if (existing.length) {
    await Promise.all(existing.map((item) => dbDelete('questionSetUses', item.id)));
    state.uses = state.uses.filter((item) => !(item.setId === setId && item.studentId === studentId));
    renderLibrary();
    renderDataStats();
    toast('已撤销这名学生的使用记录');
    return;
  }
  const record = {
    id: `question-use-${setId}-${studentId}`,
    classId: state.activeClassId,
    setId,
    studentId,
    usedAt: now(),
  };
  await dbPut('questionSetUses', record);
  state.uses.unshift(record);
  renderLibrary();
  renderDataStats();
  toast('已记录使用，完成后记得回矩阵更新状态');
}

async function saveQuestionSetEdit(setId) {
  const card = $(`[data-set-card="${setId}"]`);
  const existing = state.questionSets.find((set) => set.id === setId);
  if (!card || !existing) return;
  const title = $('[data-edit-set-title]', card).value.trim();
  const content = $('[data-edit-set-content]', card).value.trim();
  const kpId = $('[data-edit-set-kp]', card).value;
  if (!title || !content || !kpId) {
    toast('题组标题、知识点和内容不能为空');
    return;
  }
  const record = {
    ...existing,
    title,
    kpId,
    errorTag: $('[data-edit-set-tag]', card).value.trim(),
    content,
    updatedAt: now(),
  };
  await dbPut('questionSets', record);
  Object.assign(existing, record);
  state.editingQuestionSetId = null;
  renderLibrary();
  toast('题组修改已保存');
}

async function deleteQuestionSet(setId) {
  const item = state.questionSets.find((set) => set.id === setId);
  if (!item || !confirm(`确定删除题组“${item.title}”吗？相关学生使用记录也会一并删除，且无法恢复。`)) return;
  const relatedUses = state.uses.filter((use) => use.setId === setId);
  await Promise.all([
    dbDelete('questionSets', setId),
    ...relatedUses.map((use) => dbDelete('questionSetUses', use.id)),
  ]);
  state.questionSets = state.questionSets.filter((set) => set.id !== setId);
  state.uses = state.uses.filter((use) => use.setId !== setId);
  if (state.editingQuestionSetId === setId) state.editingQuestionSetId = null;
  $('#libraryCount').textContent = state.questionSets.length;
  renderLibrary();
  renderDataStats();
  toast('题组已删除');
}

function extractStudentRows(rows) {
  const normalized = rows
    .map((row) => (Array.isArray(row) ? row : [row]).map((cell) => String(cell ?? '').trim()))
    .filter((row) => row.some(Boolean));
  if (!normalized.length) return [];

  const headerIndex = normalized.findIndex((row) => row.some((cell) => /^(姓名|学生姓名|name)$/i.test(cell)));
  const header = headerIndex >= 0 ? normalized[headerIndex] : [];
  const nameIndex = header.findIndex((cell) => /^(姓名|学生姓名|name)$/i.test(cell));
  const numberIndex = header.findIndex((cell) => /^(学号|序号|编号|学生编号|student\s*id)$/i.test(cell));
  const dataRows = headerIndex >= 0 ? normalized.slice(headerIndex + 1) : normalized;

  return dataRows.map((row, index) => {
    const nonEmpty = row.filter(Boolean);
    const name = (nameIndex >= 0 ? row[nameIndex] : nonEmpty[nonEmpty.length - 1]) || '';
    const rawNumber = numberIndex >= 0 ? row[numberIndex] : (row.length > 1 ? row[0] : '');
    const parsedNumber = Number.parseInt(rawNumber, 10);
    return {
      name: name.trim(),
      seatNo: Number.isFinite(parsedNumber) && parsedNumber > 0 ? parsedNumber : index + 1,
    };
  }).filter((student) => student.name && !/^(姓名|学生姓名|name)$/i.test(student.name));
}

function createStudents(rows) {
  return extractStudentRows(rows).map((student, index) => ({
    id: uid('student'),
    classId: state.activeClassId,
    name: student.name,
    seatNo: student.seatNo,
    sortOrder: index,
  }));
}

function reconcileStudents(importedStudents) {
  const available = new Set(state.students.map((student) => student.id));
  const normalizeName = (value) => String(value || '').replace(/\s/g, '');
  return importedStudents.map((student, index) => {
    const exact = state.students.find((existing) => available.has(existing.id)
      && existing.seatNo === student.seatNo
      && normalizeName(existing.name) === normalizeName(student.name));
    const sameName = state.students.filter((existing) => available.has(existing.id)
      && normalizeName(existing.name) === normalizeName(student.name));
    const matched = exact || (sameName.length === 1 ? sameName[0] : null);
    if (matched) available.delete(matched.id);
    return {
      ...student,
      id: matched?.id || student.id,
      classId: state.activeClassId,
      sortOrder: index,
    };
  });
}

function parseStudents(text) {
  const rows = text.split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/[,，\t]/).map((item) => item.trim()));
  return createStudents(rows);
}

function studentInitial(name) {
  const first = pinyin(String(name || '').slice(0, 1), {
    pattern: 'first',
    toneType: 'none',
    separator: '',
  }).replace(/\s/g, '').slice(0, 1).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : '#';
}

function studentSearchKey(student) {
  const py = pinyin(student.name, { toneType: 'none', separator: '' }).toLowerCase();
  const initials = pinyin(student.name, { pattern: 'first', toneType: 'none', separator: '' }).toLowerCase();
  return `${student.name} ${py} ${initials}`;
}

function parseDelimitedText(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const source = String(text || '').replace(/^\uFEFF/, '');
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && [',', '，', '\t'].includes(char)) {
      row.push(cell);
      cell = '';
      continue;
    }
    if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => String(value).trim())) rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += char;
  }
  row.push(cell);
  if (row.some((value) => String(value).trim())) rows.push(row);
  return rows;
}

function normalizedHeader(value) {
  return String(value ?? '').replace(/^\uFEFF/, '').replace(/[\s_·：:]/g, '').toLowerCase();
}

function extractKpRows(rows) {
  const normalized = rows
    .map((row) => (Array.isArray(row) ? row : [row]).map((cell) => String(cell ?? '').trim()))
    .filter((row) => row.some(Boolean));
  if (!normalized.length) return [];

  const unitAliases = new Set(['单元', '单元名称', '章节', '章', 'unit', 'unitname'].map(normalizedHeader));
  const kpAliases = new Set(['知识点', '知识点名称', '学习内容', '内容', 'knowledgepoint', 'name'].map(normalizedHeader));
  const headerIndex = normalized.findIndex((row) => {
    const headers = row.map(normalizedHeader);
    return headers.some((value) => unitAliases.has(value)) && headers.some((value) => kpAliases.has(value));
  });
  const header = headerIndex >= 0 ? normalized[headerIndex].map(normalizedHeader) : [];
  const unitIndex = header.findIndex((value) => unitAliases.has(value));
  const kpIndex = header.findIndex((value) => kpAliases.has(value));
  const dataRows = headerIndex >= 0 ? normalized.slice(headerIndex + 1) : normalized;
  const seen = new Set();

  return dataRows.map((row) => {
    const nonEmpty = row.filter(Boolean);
    const unitName = (unitIndex >= 0 ? row[unitIndex] : (nonEmpty.length > 1 ? nonEmpty[0] : '未分单元')) || '未分单元';
    const name = (kpIndex >= 0 ? row[kpIndex] : (nonEmpty.length > 1 ? nonEmpty[1] : nonEmpty[0])) || '';
    return { unitName: unitName.trim(), name: name.trim() };
  }).filter((item) => {
    if (!item.name || kpAliases.has(normalizedHeader(item.name))) return false;
    const key = `${item.unitName}\u0000${item.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function createKps(rows) {
  return rows.map((item, index) => ({
    id: uid('kp'),
    classId: state.activeClassId,
    unitName: item.unitName,
    name: item.name,
    sortOrder: index,
    createdAt: now(),
    archivedAt: null,
  }));
}

function reconcileKps(importedKps) {
  const keyOf = (kp) => `${String(kp.unitName || '').trim()}\u0000${String(kp.name || '').trim()}`;
  const existingByKey = new Map(state.kps.map((kp) => [keyOf(kp), kp]));
  const activeKeys = new Set();
  const active = importedKps.map((kp, index) => {
    const key = keyOf(kp);
    activeKeys.add(key);
    const existing = existingByKey.get(key);
    return {
      ...kp,
      id: existing?.id || kp.id,
      classId: state.activeClassId,
      sortOrder: index,
      createdAt: existing?.createdAt || kp.createdAt,
      archivedAt: null,
    };
  });
  const archived = state.kps
    .filter((kp) => !activeKeys.has(keyOf(kp)))
    .map((kp) => ({ ...kp, archivedAt: kp.archivedAt || now() }));
  return [...active, ...archived];
}

function parseKps(text) {
  return createKps(extractKpRows(parseDelimitedText(text)));
}

function kpsToPasteText(rows) {
  return ['单元\t知识点', ...rows.map((item) => `${item.unitName}\t${item.name}`)].join('\n');
}

async function readKpFile(file) {
  try {
    const isExcel = /\.xlsx$/i.test(file.name);
    const rows = isExcel ? await readSheet(file) : parseDelimitedText(await file.text());
    const items = extractKpRows(rows);
    if (!items.length) {
      $('#kpFileName').textContent = '未识别到知识点';
      toast('没有识别到知识点，请检查“单元”和“知识点”表头');
      return;
    }
    $('#kpPaste').value = kpsToPasteText(items);
    $('#kpFileName').textContent = `${file.name} · ${items.length} 项`;
    toast(`已读取 ${items.length} 个知识点，请核对后点击“导入知识点”`);
  } catch (error) {
    console.error(error);
    $('#kpFileName').textContent = '文件读取失败';
    toast('文件读取失败，请确认文件为有效的 .xlsx 或 UTF-8 CSV');
  }
}

function applyBnupTemplate() {
  if (window.TeacherWorkspaceAccess && !window.TeacherWorkspaceAccess.requireFeature('knowledgeImport')) return;
  const items = BNUP_G4S1_KPS.map(([unitName, name]) => ({ unitName, name }));
  $('#kpPaste').value = kpsToPasteText(items);
  $('#kpFileName').textContent = `${BNUP_G4S1_TEMPLATE_META.title} · ${items.length} 项`;
  toast(`已填入北师大四年级上册 ${items.length} 个知识点，请核对后导入`);
}

async function readStudentExcel(file) {
  if (window.TeacherWorkspaceAccess && !window.TeacherWorkspaceAccess.requireFeature('studentImport')) return;
  try {
    const rows = await readSheet(file);
    const students = extractStudentRows(rows);
    if (!students.length) {
      $('#studentExcelName').textContent = '未识别到学生';
      toast('Excel 中没有识别到学生姓名，请检查“姓名”列');
      return;
    }
    $('#studentPaste').value = students.map((student) => `${student.seatNo}\t${student.name}`).join('\n');
    $('#studentExcelName').textContent = `${file.name} · ${students.length} 人`;
    toast(`已读取 ${students.length} 名学生，请核对后点击“导入学生”`);
  } catch (error) {
    console.error(error);
    $('#studentExcelName').textContent = '文件读取失败';
    toast('Excel 读取失败，请确认文件为有效的 .xlsx 格式');
  }
}

async function importStudents() {
  if (window.TeacherWorkspaceAccess && !window.TeacherWorkspaceAccess.requireFeature('studentImport')) return;
  const parsedStudents = parseStudents($('#studentPaste').value);
  if (!parsedStudents.length) {
    toast('没有识别到学生姓名');
    return;
  }
  if (state.students.length && !confirm('重新导入会替换当前在册名单。同名学生会保留原有学情、作业和任务；移出名单的学生历史记录仍保留在备份中。继续吗？')) return;
  const students = reconcileStudents(parsedStudents);
  await dbReplaceForActiveClass('students', students);
  const activeIds = new Set(students.map((student) => student.id));
  state.seatAssignments = Object.fromEntries(Object.entries(state.seatAssignments)
    .filter(([, studentId]) => activeIds.has(studentId)));
  state.seatRosterQuery = '';
  state.seatRosterLetter = '全部';
  state.selectedRosterStudentId = null;
  const assigned = new Set(Object.values(state.seatAssignments));
  const emptyKeys = seatKeys().filter((key) => !state.seatAssignments[key]);
  students.filter((student) => !assigned.has(student.id)).forEach((student, index) => {
    if (emptyKeys[index]) state.seatAssignments[emptyKeys[index]] = student.id;
  });
  await saveSeatState();
  await setInitialized(true);
  clearSelection();
  await refreshState();
  renderAll();
  toast(`已导入 ${students.length} 名学生`);
}

async function importKps() {
  if (window.TeacherWorkspaceAccess && !window.TeacherWorkspaceAccess.requireFeature('knowledgeImport')) return;
  const parsedKps = parseKps($('#kpPaste').value);
  if (!parsedKps.length) {
    toast('没有识别到知识点');
    return;
  }
  if (state.kps.some((kp) => !kp.archivedAt) && !confirm('重新导入会替换当前知识清单。同名单元和知识点会保留原有判断与题组；清单中不再出现的知识点会归档，历史记录不会删除。继续吗？')) return;
  const kps = reconcileKps(parsedKps);
  await dbReplaceForActiveClass('kps', kps);
  await setInitialized(true);
  clearSelection();
  await refreshState();
  renderAll();
  toast(`已导入 ${parsedKps.length} 个知识点`);
}

function seatKeys(config = state.seatConfig) {
  const keys = [];
  for (let row = 0; row < config.rows; row += 1) {
    for (let desk = 0; desk < config.desks; desk += 1) {
      for (let seat = 0; seat < config.seatsPerDesk; seat += 1) keys.push(`${row}:${desk}:${seat}`);
    }
  }
  return keys;
}

function renderClass() {
  const { rows, desks, seatsPerDesk } = state.seatConfig;
  $('#seatRows').value = rows;
  $('#seatDesks').value = desks;
  $('#seatPerDesk').value = seatsPerDesk;
  updateSeatLimitPreview();
  $('#toggleSeatEdit').textContent = state.seatEdit ? '完成并返回班级' : '进入编辑模式';
  $('#toggleSeatEdit').classList.toggle('secondary', state.seatEdit);
  $('#toggleSeatEdit').classList.toggle('primary', !state.seatEdit);
  const undoButton = $('#undoSeatChange');
  undoButton.disabled = state.seatHistory.length === 0;
  undoButton.title = state.seatHistory.length
    ? `撤销：${state.seatHistory[state.seatHistory.length - 1].label}`
    : '还没有可以撤销的座位操作';

  const studentById = new Map(state.students.map((student) => [student.id, student]));
  let board = '';
  for (let row = 0; row < rows; row += 1) {
    board += `<div class="seat-row" style="--desk-count:${desks}"><span class="row-label">${row + 1} 排</span>`;
    for (let desk = 0; desk < desks; desk += 1) {
      board += `<div class="seat-desk" style="--seat-count:${seatsPerDesk}">`;
      for (let seat = 0; seat < seatsPerDesk; seat += 1) {
        const key = `${row}:${desk}:${seat}`;
        const studentId = state.seatAssignments[key] || '';
        const student = studentById.get(studentId);
        if (state.seatEdit) {
          board += `<div class="seat-slot edit ${student ? 'occupied' : 'empty'} ${studentId && studentId === state.selectedRosterStudentId ? 'selected' : ''}"
            data-seat-key="${key}" role="button" tabindex="0"
            aria-label="${row + 1}排${desk + 1}桌${seat + 1}座，${student ? student.name : '空位'}">
            <span class="seat-position">${desk + 1}桌${seat + 1}座</span>
            ${student ? `<div class="seat-nameplate" data-student-drag="${student.id}">
              <b>${escapeHTML(student.name)}</b><small>${student.seatNo}号</small>
            </div>
            <button class="seat-remove" type="button" data-unassign-seat="${key}" aria-label="将${escapeHTML(student.name)}移回待安排">×</button>`
            : '<b class="seat-empty-label">拖入学生</b>'}
          </div>`;
        } else {
          board += `<div class="seat-slot ${student ? '' : 'empty'}">
            <span>${desk + 1}桌${seat + 1}座</span>
            <b>${student ? escapeHTML(student.name) : '空位'}</b>
          </div>`;
        }
      }
      board += '</div>';
    }
    board += '</div>';
  }
  $('#seatBoard').innerHTML = board;
  renderSeatRoster();
}

function renderSeatRoster() {
  const assignedIds = new Set(Object.values(state.seatAssignments));
  const unassigned = state.students.filter((student) => !assignedIds.has(student.id));
  const availableLetters = new Set(unassigned.map((student) => studentInitial(student.name)));
  if (state.seatRosterLetter !== '全部' && !availableLetters.has(state.seatRosterLetter)) {
    state.seatRosterLetter = '全部';
  }

  const query = state.seatRosterQuery.trim().toLowerCase();
  const filtered = unassigned.filter((student) => {
    const matchesQuery = !query || studentSearchKey(student).toLowerCase().includes(query);
    const matchesLetter = state.seatRosterLetter === '全部' || studentInitial(student.name) === state.seatRosterLetter;
    return matchesQuery && matchesLetter;
  });

  $('#unassignedCount').textContent = unassigned.length;
  $('#seatRosterSearch').value = state.seatRosterQuery;
  $('#clearSeatSelection').hidden = !state.selectedRosterStudentId;

  const groups = new Map();
  filtered.forEach((student) => {
    const letter = studentInitial(student.name);
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter).push(student);
  });

  $('#unassignedStudents').innerHTML = filtered.length
    ? [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([letter, students]) => `
      <section class="roster-group" data-roster-group="${letter}">
        <h3>${letter}</h3>
        <div>
          ${students.map((student) => `<button type="button"
            class="roster-student ${student.id === state.selectedRosterStudentId ? 'selected' : ''}"
            data-student-drag="${student.id}" aria-pressed="${student.id === state.selectedRosterStudentId}">
            <span class="roster-avatar">${escapeHTML(student.name.slice(0, 1))}</span>
            <span class="roster-student-copy"><b>${escapeHTML(student.name)}</b><small>${student.seatNo}号 · 拖动安排</small></span>
            <i aria-hidden="true">⋮⋮</i>
          </button>`).join('')}
        </div>
      </section>`).join('')
    : `<div class="roster-empty">
        <span>${unassigned.length ? '没有符合条件的学生' : '✓'}</span>
        <b>${unassigned.length ? '换个姓名或首字母试试' : '全部学生已安排座位'}</b>
      </div>`;

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('');
  $('#seatAlphabet').innerHTML = [
    `<button type="button" data-roster-letter="全部" class="${state.seatRosterLetter === '全部' ? 'active' : ''}" aria-label="显示全部学生">全</button>`,
    ...alphabet.filter((letter) => availableLetters.has(letter)).map((letter) => `<button type="button" data-roster-letter="${letter}"
      class="${state.seatRosterLetter === letter ? 'active' : ''}">${letter}</button>`),
  ].join('');
}

function updateSeatLimitPreview() {
  const columns = (Number($('#seatDesks').value) || 1) * (Number($('#seatPerDesk').value) || 1);
  $('#seatLimit').textContent = columns <= 9 ? `每排 ${columns} / 9 座` : `每排 ${columns} 座，最多 9 座`;
  $('#seatLimit').classList.toggle('invalid', columns > 9);
}

function rememberSeatState(label) {
  state.seatHistory.push({
    label,
    config: { ...state.seatConfig },
    assignments: { ...state.seatAssignments },
  });
  if (state.seatHistory.length > 20) state.seatHistory.shift();
}

async function undoSeatChange() {
  const previous = state.seatHistory.pop();
  if (!previous) {
    toast('还没有可以撤销的座位操作');
    return;
  }
  state.seatConfig = previous.config;
  state.seatAssignments = previous.assignments;
  state.selectedRosterStudentId = null;
  await saveSeatState();
  renderClass();
  toast(`已撤销：${previous.label}`);
}

async function assignSeat(key, studentId) {
  const currentStudentId = state.seatAssignments[key] || '';
  const currentStudentSeat = studentId
    ? Object.entries(state.seatAssignments).find(([, id]) => id === studentId)?.[0]
    : null;
  if (currentStudentId === studentId && (!studentId || currentStudentSeat === key)) return;
  rememberSeatState(studentId ? '安排学生座位' : '移回待安排');
  Object.keys(state.seatAssignments).forEach((seatKey) => {
    if (state.seatAssignments[seatKey] === studentId || seatKey === key) delete state.seatAssignments[seatKey];
  });
  if (studentId) state.seatAssignments[key] = studentId;
  await saveSeatState();
  renderClass();
}

function seatLabel(key) {
  const [row, desk, seat] = key.split(':').map(Number);
  return `${row + 1}排${desk + 1}桌${seat + 1}座`;
}

function clearSeatDropTargets() {
  $$('.seat-slot.drop-target, .seat-slot.swap-target').forEach((seat) => {
    seat.classList.remove('drop-target', 'swap-target');
  });
}

function markSeatDropTarget(target, studentId) {
  const sourceKey = Object.entries(state.seatAssignments).find(([, id]) => id === studentId)?.[0];
  const targetStudentId = target ? state.seatAssignments[target.dataset.seatKey] : null;
  const isSwap = Boolean(sourceKey && targetStudentId && targetStudentId !== studentId);
  $$('.seat-slot[data-seat-key]').forEach((seat) => {
    seat.classList.toggle('drop-target', seat === target);
    seat.classList.toggle('swap-target', seat === target && isSwap);
  });
}

async function moveStudentToSeat(studentId, targetKey) {
  if (!studentId || !targetKey) return;
  const sourceEntry = Object.entries(state.seatAssignments).find(([, id]) => id === studentId);
  const sourceKey = sourceEntry?.[0];
  const targetStudentId = state.seatAssignments[targetKey];
  if (sourceKey === targetKey) return;
  const movingStudent = state.students.find((student) => student.id === studentId);
  const targetStudent = state.students.find((student) => student.id === targetStudentId);
  const isSwap = Boolean(sourceKey && targetStudentId && targetStudentId !== studentId);

  rememberSeatState(isSwap ? '交换学生座位' : '移动学生座位');
  if (sourceKey) delete state.seatAssignments[sourceKey];
  delete state.seatAssignments[targetKey];
  if (sourceKey && targetStudentId && targetStudentId !== studentId) {
    state.seatAssignments[sourceKey] = targetStudentId;
  }
  state.seatAssignments[targetKey] = studentId;
  state.selectedRosterStudentId = null;
  await saveSeatState();
  renderClass();
  if (isSwap) {
    toast(`${movingStudent?.name || '学生'}与${targetStudent?.name || '学生'}已交换座位`);
  } else if (targetStudent) {
    toast(`${movingStudent?.name || '学生'}已入座，${targetStudent.name}回到待安排`);
  } else {
    toast(`${movingStudent?.name || '学生'}已移动到${seatLabel(targetKey)}`);
  }
}

async function applySeatLayout() {
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || min));
  const nextConfig = {
    rows: clamp($('#seatRows').value, 1, 12),
    desks: clamp($('#seatDesks').value, 1, 9),
    seatsPerDesk: clamp($('#seatPerDesk').value, 1, 4),
  };
  if (nextConfig.desks * nextConfig.seatsPerDesk > 9) {
    updateSeatLimitPreview();
    toast('每排最多设置 9 个座位，请减少桌数或每桌座位数');
    return;
  }
  if (
    nextConfig.rows === state.seatConfig.rows
    && nextConfig.desks === state.seatConfig.desks
    && nextConfig.seatsPerDesk === state.seatConfig.seatsPerDesk
  ) {
    toast('座位布局没有变化');
    return;
  }
  rememberSeatState('修改座位布局');
  state.seatConfig = nextConfig;
  const allowed = new Set(seatKeys());
  state.seatAssignments = Object.fromEntries(Object.entries(state.seatAssignments).filter(([key]) => allowed.has(key)));
  await saveSeatState();
  renderClass();
  toast(`座位布局已更新为 ${state.seatConfig.rows} 排 × ${state.seatConfig.desks} 桌 × ${state.seatConfig.seatsPerDesk} 座`);
}

async function autoFillSeats() {
  const keys = seatKeys();
  if (!state.students.length) {
    toast('请先导入学生名单');
    return;
  }
  const arrangedCount = Math.min(keys.length, state.students.length);
  const capacityHint = state.students.length > keys.length
    ? `当前只有 ${keys.length} 个座位，另有 ${state.students.length - keys.length} 人会留在待安排列表。`
    : '';
  if (!confirm(`自动填充会按名单顺序重新安排 ${arrangedCount} 名学生，并覆盖当前座位安排。${capacityHint}继续吗？`)) return;
  rememberSeatState('按名单自动填充');
  state.seatAssignments = {};
  state.seatRosterQuery = '';
  state.seatRosterLetter = '全部';
  state.selectedRosterStudentId = null;
  state.students.slice(0, keys.length).forEach((student, index) => {
    state.seatAssignments[keys[index]] = student.id;
  });
  await saveSeatState();
  renderClass();
  toast(`已自动安排 ${Math.min(keys.length, state.students.length)} 名学生`);
}

async function moveSeats(direction) {
  if (!Object.keys(state.seatAssignments).length) {
    toast('当前没有已安排的座位');
    return;
  }
  const actionLabel = { front: '全班前移一排', back: '全班后移一排', left: '全班左移一桌', right: '全班右移一桌' }[direction];
  rememberSeatState(actionLabel);
  const { rows, desks, seatsPerDesk } = state.seatConfig;
  const moved = {};
  Object.entries(state.seatAssignments).forEach(([key, studentId]) => {
    let [row, desk, seat] = key.split(':').map(Number);
    if (direction === 'front') row = (row - 1 + rows) % rows;
    if (direction === 'back') row = (row + 1) % rows;
    if (direction === 'left') desk = (desk - 1 + desks) % desks;
    if (direction === 'right') desk = (desk + 1) % desks;
    if (seat < seatsPerDesk) moved[`${row}:${desk}:${seat}`] = studentId;
  });
  state.seatAssignments = moved;
  await saveSeatState();
  renderClass();
  toast(`全班座位已${actionLabel.replace('全班', '')}`);
}

async function exportBackup() {
  if (window.TeacherWorkspaceAccess && !window.TeacherWorkspaceAccess.requireFeature('exportBackup')) return;
  const classContext = await window.TeacherClassManager?.getContext();
  const currentClass = classContext?.classes?.find((item) => item.id === state.activeClassId);
  const notes = (await dbGetAll('notes')).filter(belongsToActiveClass);
  const backup = {
    app: '上节好课教师工作台',
    version: 5,
    scope: 'current-class',
    classId: state.activeClassId,
    class: currentClass || { id: state.activeClassId, name: '当前班级', status: 'active' },
    exportedAt: new Date().toISOString(),
    students: state.students,
    kps: state.kps,
    judgements: state.judgements,
    questionSets: state.questionSets,
    questionSetUses: state.uses,
    reasonTemplates: state.reasonTemplates,
    homeworks: state.homeworks,
    homeworkEntries: state.homeworkEntries,
    followupTasks: state.followupTasks,
    notes,
    seatConfig: state.seatConfig,
    seatAssignments: state.seatAssignments,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  const className = (currentClass?.name || '当前班级').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '');
  link.download = `上节好课-${className}-班级备份-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast('备份已导出');
}

async function clearAllData() {
  if (window.TeacherWorkspaceAccess?.isExperience) {
    if (!confirm('确定把体验班恢复到最初状态吗？你在体验班中的操作记录会被清除。')) return;
    await window.TeacherWorkspaceAccess.resetExperience();
    location.reload();
    return;
  }
  if (!confirm('确定清空当前班级的全部数据吗？其他班级不会受影响，请先导出备份。')) return;
  await Promise.all(CLASS_SCOPED_STORES.map((store) => dbClearForActiveClass(store)));
  await Promise.all([
    dbPut('meta', { id: `seat-config:${state.activeClassId}`, value: { rows: 6, desks: 3, seatsPerDesk: 2 } }),
    dbPut('meta', { id: `seat-assignments:${state.activeClassId}`, value: {} }),
    setInitialized(false),
  ]);
  location.reload();
}

function renderDataStats() {
  const stats = [
    ['学生', state.students.length],
    ['知识点', state.kps.length],
    ['判断记录', state.judgements.length],
    ['题组', state.questionSets.length],
    ['使用记录', state.uses.length],
    ['作业登记', state.homeworks.length],
    ['作业跟进', state.followupTasks.filter((task) => task.status !== 'completed').length],
  ];
  $('#dataStats').innerHTML = stats.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('');
}

function switchView(view, updateHash = true) {
  if (!['matrix', 'library', 'class'].includes(view)) view = 'matrix';
  state.activeView = view;
  if (view === 'class') state.seatEdit = true;
  $$('.sub-nav-item').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  $$('.view').forEach((section) => section.classList.remove('active'));
  $(`#${view}View`).classList.add('active');
  const meta = {
    matrix: ['今天只维护一张表', '知识矩阵'],
    library: ['用得越久，越有价值', '我的题库'],
    class: ['从班级主页进入的编辑模式', '座位与名单设置'],
  }[view];
  $('#viewEyebrow').textContent = meta[0];
  $('#viewTitle').textContent = meta[1];
  $('#unitPickerWrap').classList.toggle('hidden', view !== 'matrix' || !getUnits().length);
  $('.sub-nav-wrap').classList.toggle('hidden', view === 'class');
  document.body.classList.toggle('class-mode', view === 'class');
  $$('[data-main-view]').forEach((link) => {
    const active = view === 'class' ? link.dataset.mainView === 'class' : link.dataset.mainView === 'learning';
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  if (view === 'library') renderLibrary();
  if (view === 'class') renderClass();
  if (updateHash && location.hash !== `#${view}`) history.replaceState(null, '', `#${view}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function jumpToKp(kpId) {
  const kp = state.kps.find((item) => item.id === kpId);
  if (!kp) return;
  state.activeUnit = kp.unitName;
  switchView('matrix');
  renderUnits();
  renderMatrix();
  toast(`已回到“${kp.name}”所在单元`);
}

function renderAiInsights(result) {
  const panel = $('#aiInsightsPanel');
  const cards = result.insights.map((item) => `<article class="ai-insight"><h3>${escapeHTML(item.knowledgePoint)}</h3><p><b>发现：</b>${escapeHTML(item.finding)}</p><p><b>依据：</b>${escapeHTML(item.evidence)}</p><p><b>建议：</b>${escapeHTML(item.suggestion)}</p></article>`).join('');
  panel.innerHTML = `<div class="ai-insights-head"><span class="mark">✦</span><div><h2>MiMo 学情建议</h2><p>${escapeHTML(result.overview)} · 仅根据已确认判断生成，不会修改矩阵</p></div></div>
    <div class="ai-insights-grid">${cards || '<article class="ai-insight"><h3>记录不足</h3><p>继续完成知识点判断并补充错因后再试。</p></article>'}</div>
    ${result.cautions.length ? `<div class="ai-cautions">谨慎解读：${result.cautions.map(escapeHTML).join('；')}</div>` : ''}`;
  panel.classList.remove('hidden');
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function generateLearningInsights() {
  const button = $('#aiLearningInsights');
  const kps = state.kps.filter((kp) => !kp.archivedAt && kp.unitName === state.activeUnit);
  if (!kps.length || !state.students.length) return toast('当前单元还没有足够的学情记录');
  const knowledgePoints = kps.map((kp) => {
    const statuses = state.students.map((student) => ({
      status: currentStatus(student.id, kp.id),
      reason: currentNote(student.id, kp.id),
    }));
    const reasonCounts = statuses.reduce((counts, item) => {
      if (item.status === 'needs_support' && item.reason) counts[item.reason] = (counts[item.reason] || 0) + 1;
      return counts;
    }, {});
    return {
      name: kp.name,
      mastered: statuses.filter((item) => item.status === 'mastered').length,
      needsSupport: statuses.filter((item) => item.status === 'needs_support').length,
      unassessed: statuses.filter((item) => item.status === 'unassessed').length,
      commonReasons: Object.entries(reasonCounts).sort((left, right) => right[1] - left[1]).slice(0, 8).map(([reason, count]) => ({ reason, count })),
    };
  });
  if (!knowledgePoints.some((item) => item.mastered || item.needsSupport)) return toast('请先完成一些学情判断再生成建议');
  button.disabled = true;
  button.textContent = '✦ 正在分析…';
  try {
    const result = await runAdminAi('learning-insights', {
      unitName: state.activeUnit,
      studentCount: state.students.length,
      knowledgePoints,
    });
    renderAiInsights(result);
    toast('AI学情建议已生成，请结合课堂判断');
  } catch (error) {
    toast(error.message || 'AI学情建议生成失败');
  } finally {
    button.disabled = false;
    button.textContent = '✦ AI 学情建议';
  }
}

function bindEvents() {
  $('.sub-nav').addEventListener('click', (event) => {
    const button = event.target.closest('[data-view]');
    if (button) switchView(button.dataset.view);
  });
  window.addEventListener('hashchange', () => switchView(location.hash.slice(1) || 'matrix', false));

  $('#unitSelect').addEventListener('change', (event) => {
    state.activeUnit = event.target.value;
    clearSelection();
    $('#aiInsightsPanel').classList.add('hidden');
    renderMatrix();
  });

  $('#aiLearningInsights')?.addEventListener('click', generateLearningInsights);

  $('#matrixBody').addEventListener('click', async (event) => {
    const cycle = event.target.closest('[data-cycle-status]');
    if (cycle) {
      await cycleStatus(cycle);
      return;
    }
    const detail = event.target.closest('[data-open-detail]');
    if (detail) selectCell(detail.dataset.studentId, detail.dataset.kpId, !currentNote(detail.dataset.studentId, detail.dataset.kpId));
  });

  $('.status-control').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-status]');
    if (!button || !state.selectedStudentId || !state.selectedKpId) return;
    await changeStatus(state.selectedStudentId, state.selectedKpId, button.dataset.status, { focusNote: button.dataset.status === 'needs_support' });
  });

  $('#closeDetail').addEventListener('click', clearSelection);
  $('#noteInput').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      clearTimeout(noteSaveTimer);
      saveCurrentNote();
    }
  });
  $('#noteInput').addEventListener('input', () => {
    $('#noteSaved').textContent = '自动保存中…';
    clearTimeout(noteSaveTimer);
    noteSaveTimer = setTimeout(saveCurrentNote, 800);
  });
  $('#noteInput').addEventListener('blur', () => {
    clearTimeout(noteSaveTimer);
    saveCurrentNote();
  });
  $('#reasonChips').addEventListener('click', async (event) => {
    const remove = event.target.closest('[data-delete-reason]');
    if (remove) {
      await deleteReasonTemplate(remove.dataset.deleteReason);
      return;
    }
    const button = event.target.closest('[data-reason]');
    if (!button) return;
    $('#noteInput').value = button.dataset.reason;
    clearTimeout(noteSaveTimer);
    saveCurrentNote();
  });
  $('#saveSet').addEventListener('click', saveQuestionSet);

  $('#librarySearch').addEventListener('input', renderLibrary);
  $('#libraryList').addEventListener('click', async (event) => {
    const used = event.target.closest('[data-mark-used]');
    if (used) {
      await toggleSetUsed(used.dataset.markUsed);
      return;
    }
    const jump = event.target.closest('[data-jump-kp]');
    if (jump) {
      jumpToKp(jump.dataset.jumpKp);
      return;
    }
    const edit = event.target.closest('[data-edit-set]');
    if (edit) {
      state.editingQuestionSetId = edit.dataset.editSet;
      renderLibrary();
      return;
    }
    if (event.target.closest('[data-cancel-set-edit]')) {
      state.editingQuestionSetId = null;
      renderLibrary();
      return;
    }
    const saveEdit = event.target.closest('[data-save-set-edit]');
    if (saveEdit) {
      await saveQuestionSetEdit(saveEdit.dataset.saveSetEdit);
      return;
    }
    const remove = event.target.closest('[data-delete-set]');
    if (remove) await deleteQuestionSet(remove.dataset.deleteSet);
  });
  $('#libraryList').addEventListener('change', (event) => {
    const select = event.target.closest('[data-use-student]');
    if (select) updateUseToggle(select.dataset.useStudent);
  });

  $$('[data-go-data]').forEach((button) => button.addEventListener('click', () => switchView('class')));
  $$('[data-go-matrix]').forEach((button) => button.addEventListener('click', () => switchView('matrix')));

  $('#toggleSeatEdit').addEventListener('click', () => {
    if (state.activeView === 'class' && state.seatEdit) {
      location.href = '../class.html';
      return;
    }
    state.seatEdit = true;
    renderClass();
  });
  $('#applySeatLayout').addEventListener('click', applySeatLayout);
  [$('#seatDesks'), $('#seatPerDesk')].forEach((input) => input.addEventListener('input', updateSeatLimitPreview));
  $('#autoFillSeats').addEventListener('click', autoFillSeats);
  $('#undoSeatChange').addEventListener('click', undoSeatChange);
  $('.seat-toolbar').addEventListener('click', (event) => {
    const button = event.target.closest('[data-move-seats]');
    if (button) moveSeats(button.dataset.moveSeats);
  });
  $('#seatRosterSearch').addEventListener('input', (event) => {
    state.seatRosterQuery = event.target.value;
    state.seatRosterLetter = '全部';
    renderSeatRoster();
  });
  $('#seatAlphabet').addEventListener('click', (event) => {
    const button = event.target.closest('[data-roster-letter]');
    if (!button || button.disabled) return;
    state.seatRosterLetter = button.dataset.rosterLetter;
    renderSeatRoster();
    $('#unassignedStudents').scrollTop = 0;
  });
  $('#clearSeatSelection').addEventListener('click', () => {
    state.selectedRosterStudentId = null;
    renderClass();
  });
  let pointerSeatDrag = null;
  let ignoreSeatClickUntil = 0;
  $('#unassignedStudents').addEventListener('click', (event) => {
    if (Date.now() < ignoreSeatClickUntil) return;
    const student = event.target.closest('[data-student-drag]');
    if (!student) return;
    state.selectedRosterStudentId = state.selectedRosterStudentId === student.dataset.studentDrag
      ? null
      : student.dataset.studentDrag;
    renderClass();
  });

  const startStudentDrag = (event) => {
    const student = event.target.closest('[data-student-drag]');
    if (!student) return;
    state.selectedRosterStudentId = student.dataset.studentDrag;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', student.dataset.studentDrag);
    student.classList.add('dragging');
  };
  const finishStudentDrag = (event) => {
    event.target.closest('[data-student-drag]')?.classList.remove('dragging');
    clearSeatDropTargets();
  };
  [$('#unassignedStudents'), $('#seatBoard')].forEach((container) => {
    container.addEventListener('dragstart', startStudentDrag);
    container.addEventListener('dragend', finishStudentDrag);
    container.addEventListener('pointerdown', (event) => {
      const student = event.target.closest('[data-student-drag]');
      if (!student || event.button !== 0) return;
      pointerSeatDrag = {
        studentId: student.dataset.studentDrag,
        source: student,
        startX: event.clientX,
        startY: event.clientY,
        active: false,
        ghost: null,
      };
    });
  });
  document.addEventListener('pointermove', (event) => {
    if (!pointerSeatDrag) return;
    const distance = Math.hypot(event.clientX - pointerSeatDrag.startX, event.clientY - pointerSeatDrag.startY);
    if (!pointerSeatDrag.active && distance < 7) return;
    event.preventDefault();
    if (!pointerSeatDrag.active) {
      pointerSeatDrag.active = true;
      pointerSeatDrag.source.classList.add('dragging');
      const student = state.students.find((item) => item.id === pointerSeatDrag.studentId);
      const ghost = document.createElement('div');
      ghost.className = 'seat-drag-ghost';
      const sourceKey = Object.entries(state.seatAssignments).find(([, id]) => id === pointerSeatDrag.studentId)?.[0];
      ghost.innerHTML = `<b>${escapeHTML(student?.name || '学生')}</b><small>${sourceKey ? '拖到另一位学生上交换' : '拖到座位完成安排'}</small>`;
      document.body.appendChild(ghost);
      pointerSeatDrag.ghost = ghost;
    }
    pointerSeatDrag.ghost.style.transform = `translate(${event.clientX + 12}px, ${event.clientY + 12}px)`;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-seat-key]');
    markSeatDropTarget(target, pointerSeatDrag.studentId);
  }, { passive: false });
  const finishPointerSeatDrag = (event) => {
    if (!pointerSeatDrag) return;
    const drag = pointerSeatDrag;
    pointerSeatDrag = null;
    drag.source.classList.remove('dragging');
    drag.ghost?.remove();
    const target = drag.active
      ? document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-seat-key]')
      : null;
    clearSeatDropTargets();
    if (!drag.active) return;
    event.preventDefault();
    ignoreSeatClickUntil = Date.now() + 400;
    if (target) moveStudentToSeat(drag.studentId, target.dataset.seatKey);
  };
  document.addEventListener('pointerup', finishPointerSeatDrag);
  document.addEventListener('pointercancel', finishPointerSeatDrag);
  $('#seatBoard').addEventListener('dragover', (event) => {
    const seat = event.target.closest('[data-seat-key]');
    if (!seat) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    markSeatDropTarget(seat, event.dataTransfer.getData('text/plain') || state.selectedRosterStudentId);
  });
  $('#seatBoard').addEventListener('dragleave', (event) => {
    const seat = event.target.closest('[data-seat-key]');
    if (seat && !seat.contains(event.relatedTarget)) clearSeatDropTargets();
  });
  $('#seatBoard').addEventListener('drop', (event) => {
    const seat = event.target.closest('[data-seat-key]');
    if (!seat) return;
    event.preventDefault();
    const studentId = event.dataTransfer.getData('text/plain') || state.selectedRosterStudentId;
    clearSeatDropTargets();
    moveStudentToSeat(studentId, seat.dataset.seatKey);
  });
  $('#seatBoard').addEventListener('click', (event) => {
    if (Date.now() < ignoreSeatClickUntil) return;
    const remove = event.target.closest('[data-unassign-seat]');
    if (remove) {
      state.selectedRosterStudentId = null;
      assignSeat(remove.dataset.unassignSeat, '');
      return;
    }
    const seat = event.target.closest('[data-seat-key]');
    if (!seat) return;
    if (state.selectedRosterStudentId) {
      moveStudentToSeat(state.selectedRosterStudentId, seat.dataset.seatKey);
      return;
    }
    const studentId = state.seatAssignments[seat.dataset.seatKey];
    if (studentId) {
      state.selectedRosterStudentId = studentId;
      renderClass();
    }
  });
  $('#seatBoard').addEventListener('keydown', (event) => {
    if (!['Enter', ' '].includes(event.key)) return;
    const seat = event.target.closest('[data-seat-key]');
    if (!seat) return;
    event.preventDefault();
    seat.click();
  });

  $('#applyBnupTemplate').addEventListener('click', applyBnupTemplate);
  $('#importStudents').addEventListener('click', importStudents);
  $('#studentExcelFile').addEventListener('change', (event) => {
    const [file] = event.target.files;
    if (file) readStudentExcel(file);
  });
  $('#importKps').addEventListener('click', importKps);
  $('#kpFile').addEventListener('change', async (event) => {
    const [file] = event.target.files;
    if (file) await readKpFile(file);
  });

  $('#exportBackup').addEventListener('click', exportBackup);
  $('#exportQuick').addEventListener('click', exportBackup);
  $('#clearAll').addEventListener('click', clearAllData);

  $('#startImport').addEventListener('click', async (event) => {
    event.preventDefault();
    await setInitialized(true);
    $('#setupDialog').close();
    switchView('class');
  });

  document.addEventListener('keydown', async (event) => {
    if (!state.selectedStudentId || !state.selectedKpId) return;
    if (event.target.matches('input, textarea, select')) return;
    const shortcuts = { '0': 'unassessed', '1': 'mastered', '2': 'needs_support' };
    if (shortcuts[event.key]) await changeStatus(state.selectedStudentId, state.selectedKpId, shortcuts[event.key]);
    if (event.key === 'Escape') clearSelection();
  });
}

async function init() {
  try {
    await window.TeacherWorkspaceAccess?.ready;
    if (isAdminAiUser()) $('#aiLearningInsights')?.classList.add('on');
    DB_NAME = window.TeacherWorkspaceAccess?.databaseName || DB_NAME;
    await window.TeacherClassManager?.ready;
    state.db = await openDatabase();
    bindEvents();
    await refreshState();
    const params = new URLSearchParams(location.search);
    if (!state.activeClassId) {
      location.replace('../class.html?onboarding=students');
      return;
    }
    const requestedUnit = params.get('unit');
    if (requestedUnit && getUnits().includes(requestedUnit)) state.activeUnit = requestedUnit;
    const requestedKpId = params.get('kp');
    const requestedKp = state.kps.find((item) => item.id === requestedKpId);
    if (requestedKp) state.activeUnit = requestedKp.unitName;
    renderAll();
    const requestedView = params.get('view') || location.hash.slice(1) || 'matrix';
    switchView(requestedView, location.hash !== `#${requestedView}`);
    const requestedFocus = params.get('focus');
    if (requestedView === 'class' && requestedFocus) {
      requestAnimationFrame(() => {
        const target = requestedFocus === 'students'
          ? $('#studentImportSection')
          : requestedFocus === 'kps'
            ? $('#studentImportSection')?.nextElementSibling
            : $('#seatEditorSection');
        target?.scrollIntoView({ block: 'start' });
        if (params.get('onboarding') === '1') {
          toast(requestedFocus === 'seats'
            ? '第2步：拖动名牌安排座位；没想好可点“按名单自动填充”'
            : '第3步：导入知识点清单，完成后即可开始学情记录');
        }
      });
    }
    const requestedStudentId = params.get('student');
    if (requestedView === 'matrix' && requestedKp && state.students.some((item) => item.id === requestedStudentId)) {
      selectCell(requestedStudentId, requestedKp.id, !currentNote(requestedStudentId, requestedKp.id));
    }
    if (!(await isInitialized())) $('#setupDialog').showModal();
  } catch (error) {
    console.error(error);
    document.body.innerHTML = '<main class="empty-state"><h1>无法打开本机数据库</h1><p>请确认浏览器允许此页面保存本地数据，然后刷新重试。</p></main>';
  }
}

init();
