const ACCESS_CONTROL = window.TeacherWorkspaceAccess;
let CLASS_DB_NAME = 'shangjiehaoke-teacher-workspace-v07';
const CLASS_DB_VERSION = 5;
const DEFAULT_CLASS_ID = 'class-local';
const DEFAULT_CLASS_NAME = '四年级1班';
const CLASS_STORES = [
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
const CLASS_SCOPED_STORES = [
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

function openClassManagerDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CLASS_DB_NAME, CLASS_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      CLASS_STORES.forEach((store) => {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: 'id' });
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function storeAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function storePut(db, storeName, value) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readwrite').objectStore(storeName).put(value);
    request.onsuccess = () => resolve(value);
    request.onerror = () => reject(request.error);
  });
}

async function ensureClassStructure() {
  const db = await openClassManagerDb();
  let classes = await storeAll(db, 'classes');
  const meta = await storeAll(db, 'meta');
  let defaultClass = classes.find((item) => item.id === DEFAULT_CLASS_ID);
  if (!defaultClass) {
    const timestamp = Date.now();
    defaultClass = {
      id: DEFAULT_CLASS_ID,
      name: DEFAULT_CLASS_NAME,
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await storePut(db, 'classes', defaultClass);
    classes.push(defaultClass);
  }
  const activeClasses = classes.filter((item) => item.status !== 'archived');
  const requestedActiveId = meta.find((item) => item.id === 'active-class-id')?.value;
  const activeClassId = activeClasses.some((item) => item.id === requestedActiveId)
    ? requestedActiveId
    : (activeClasses[0]?.id || DEFAULT_CLASS_ID);
  await storePut(db, 'meta', { id: 'active-class-id', value: activeClassId });

  for (const storeName of CLASS_SCOPED_STORES) {
    const values = await storeAll(db, storeName);
    const legacy = values.filter((item) => !item.classId);
    if (legacy.length) {
      await Promise.all(legacy.map((item) => storePut(db, storeName, { ...item, classId: DEFAULT_CLASS_ID })));
    }
  }

  const legacyConfig = meta.find((item) => item.id === 'seat-config');
  const legacyAssignments = meta.find((item) => item.id === 'seat-assignments');
  const legacyInitialized = meta.find((item) => item.id === 'initialized');
  const activeMetaIds = new Set((await storeAll(db, 'meta')).map((item) => item.id));
  if (!activeMetaIds.has(`seat-config:${DEFAULT_CLASS_ID}`) && legacyConfig) {
    await storePut(db, 'meta', { id: `seat-config:${DEFAULT_CLASS_ID}`, value: legacyConfig.value });
  }
  if (!activeMetaIds.has(`seat-assignments:${DEFAULT_CLASS_ID}`) && legacyAssignments) {
    await storePut(db, 'meta', { id: `seat-assignments:${DEFAULT_CLASS_ID}`, value: legacyAssignments.value });
  }
  if (!activeMetaIds.has(`initialized:${DEFAULT_CLASS_ID}`) && legacyInitialized) {
    await storePut(db, 'meta', { id: `initialized:${DEFAULT_CLASS_ID}`, value: legacyInitialized.value });
  }
  classes = await storeAll(db, 'classes');
  return { db, classes, activeClassId };
}

const managerReady = Promise.resolve(ACCESS_CONTROL?.ready).then(() => {
  CLASS_DB_NAME = ACCESS_CONTROL?.databaseName || CLASS_DB_NAME;
  return ensureClassStructure();
});
window.TeacherClassManager = {
  get DB_NAME() { return CLASS_DB_NAME; },
  DB_VERSION: CLASS_DB_VERSION,
  DEFAULT_CLASS_ID,
  ready: managerReady,
  async getContext() {
    const context = await managerReady;
    context.classes = await storeAll(context.db, 'classes');
    const meta = await storeAll(context.db, 'meta');
    context.activeClassId = meta.find((item) => item.id === 'active-class-id')?.value || DEFAULT_CLASS_ID;
    return context;
  },
};

function updateShellDate() {
  const current = new Date();
  const dateText = `${current.getMonth() + 1}月${current.getDate()}日`;
  const weekText = `星期${'日一二三四五六'.charAt(current.getDay())}`;
  ['dateTxt', 'dT', 'shellDateText'].forEach((id) => {
    const node = document.getElementById(id);
    if (node) node.textContent = dateText;
  });
  ['dW', 'shellWeekText'].forEach((id) => {
    const node = document.getElementById(id);
    if (node) node.textContent = weekText;
  });
}

let classContext;
let classPopover;
let classModal;
let globalSearchRecords = [];
let globalSearchSelection = 0;

function escapeClassText(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[character]);
}

function activeClass() {
  return classContext.classes.find((item) => item.id === classContext.activeClassId)
    || classContext.classes.find((item) => item.status !== 'archived');
}

function updatePickerLabels() {
  const name = activeClass()?.name || DEFAULT_CLASS_NAME;
  document.querySelectorAll('.picker,.shell-picker').forEach((button) => {
    button.dataset.classPicker = 'true';
    const textNode = [...button.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    if (textNode) textNode.textContent = `${name} `;
    else {
      let label = button.querySelector('[data-class-label]');
      if (!label) {
        label = document.createElement('span');
        label.dataset.classLabel = 'true';
        button.prepend(label);
      }
      label.textContent = name;
    }
  });
}

function shellEscape(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[character]);
}

async function loadGlobalSearchRecords() {
  const [students, kps, tasks, notes] = await Promise.all([
    storeAll(classContext.db, 'students'),
    storeAll(classContext.db, 'kps'),
    storeAll(classContext.db, 'followupTasks'),
    storeAll(classContext.db, 'notes'),
  ]);
  const classId = classContext.activeClassId;
  const scoped = (item) => (item.classId || DEFAULT_CLASS_ID) === classId;
  const prefix = location.pathname.includes('/v07/') ? '../' : '';
  globalSearchRecords = [
    ...students.filter(scoped).map((student) => ({
      group: '学生',
      title: student.name,
      subtitle: `学号 ${student.seatNo || student.sortOrder + 1 || '—'} · ${activeClass()?.name || DEFAULT_CLASS_NAME}`,
      icon: student.name.trim().charAt(0) || '生',
      color: '#7aa5dd',
      url: `${prefix}class.html?student=${encodeURIComponent(student.id)}`,
    })),
    ...kps.filter(scoped).filter((kp) => !kp.archivedAt).map((kp) => ({
      group: '知识点',
      title: kp.name,
      subtitle: kp.unitName || '知识清单',
      icon: '知',
      color: '#8bbf94',
      url: `${prefix}v07/index.html?kp=${encodeURIComponent(kp.id)}#matrix`,
    })),
    ...tasks.filter(scoped).map((task) => ({
      group: '任务',
      title: task.title || task.homeworkTitle || '未命名任务',
      subtitle: task.status === 'completed' ? '已完成' : '待处理',
      icon: '✓',
      color: '#d3a86a',
      url: `${prefix}tasks.html?task=${encodeURIComponent(task.id)}`,
    })),
    ...notes.filter(scoped).map((note) => ({
      group: '班级记录',
      title: note.body || note.title || '班级记录',
      subtitle: note.studentNames?.length ? `关联学生：${note.studentNames.join('、')}` : (activeClass()?.name || DEFAULT_CLASS_NAME),
      icon: '记',
      color: '#c99ad0',
      url: `${prefix}class.html?note=${encodeURIComponent(note.id)}`,
    })),
  ];
}

function globalSearchElements() {
  return {
    bar: document.querySelector('#kbar'),
    scrim: document.querySelector('#kscrim'),
    input: document.querySelector('#kq'),
    results: document.querySelector('#kres'),
  };
}

function ensureGlobalSearchUi() {
  const dataScopeLabel = ACCESS_CONTROL?.isAuthorized ? '当前账号本机数据' : '体验版虚拟数据';
  if (!document.querySelector('#kscrim')) {
    const scrim = document.createElement('div');
    scrim.id = 'kscrim';
    scrim.className = 'kscrim workspace-global-search-scrim';
    document.body.append(scrim);
  }
  if (!document.querySelector('#kbar')) {
    const bar = document.createElement('div');
    bar.id = 'kbar';
    bar.className = 'kbar workspace-global-search';
    bar.innerHTML = `<div class="kin">
      <span aria-hidden="true">⌕</span>
      <input id="kq" placeholder="搜学生、班级记录、知识点和任务…" autocomplete="off">
    </div>
    <div class="kres" id="kres"></div>
    <div class="kf"><span>↑↓ 选择</span><span>Enter 打开</span><span>Esc 关闭</span><span style="margin-left:auto">${dataScopeLabel}</span></div>`;
    document.body.append(bar);
  }
}

function renderGlobalSearch(query = '') {
  const { results } = globalSearchElements();
  if (!results) return;
  const normalized = query.trim().toLowerCase();
  const matches = globalSearchRecords
    .filter((item) => `${item.group} ${item.title} ${item.subtitle}`.toLowerCase().includes(normalized))
    .slice(0, 40);
  globalSearchSelection = Math.min(globalSearchSelection, Math.max(0, matches.length - 1));
  if (!matches.length) {
    results.innerHTML = `<div class="kempty">没有找到“${shellEscape(query)}”相关内容</div>`;
    return;
  }
  let lastGroup = '';
  results.innerHTML = matches.map((item, index) => {
    const heading = item.group !== lastGroup ? `<div class="kg">${shellEscape(item.group)}</div>` : '';
    lastGroup = item.group;
    return `${heading}<a class="kr${index === globalSearchSelection ? ' sel' : ''}" data-real-search-result="${index}" href="${shellEscape(item.url)}">
      <span class="ki" style="background:${item.color};color:#fff">${shellEscape(item.icon)}</span>
      <span class="kb"><b>${shellEscape(item.title)}</b><i>${shellEscape(item.subtitle)}</i></span>
      <span class="kt">${shellEscape(item.group)}</span>
    </a>`;
  }).join('');
}

async function openGlobalSearch(initialValue = '') {
  const { bar, scrim, input } = globalSearchElements();
  if (!bar || !scrim || !input) return;
  await loadGlobalSearchRecords();
  globalSearchSelection = 0;
  input.value = initialValue;
  renderGlobalSearch(initialValue);
  bar.classList.add('on');
  scrim.classList.add('on');
  setTimeout(() => input.focus(), 20);
}

function closeGlobalSearch() {
  const { bar, scrim } = globalSearchElements();
  bar?.classList.remove('on');
  scrim?.classList.remove('on');
}

function bindGlobalSearch() {
  ensureGlobalSearchUi();
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-kopen]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openGlobalSearch();
      return;
    }
    if (event.target.id === 'kscrim') {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeGlobalSearch();
    }
  }, true);
  document.addEventListener('input', (event) => {
    if (event.target.id !== 'kq') return;
    event.stopImmediatePropagation();
    globalSearchSelection = 0;
    renderGlobalSearch(event.target.value);
  }, true);
  document.addEventListener('keydown', (event) => {
    const { bar, results } = globalSearchElements();
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (bar?.classList.contains('on')) closeGlobalSearch();
      else openGlobalSearch();
      return;
    }
    if (!bar?.classList.contains('on')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeGlobalSearch();
      return;
    }
    const rows = [...(results?.querySelectorAll('[data-real-search-result]') || [])];
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && rows.length) {
      event.preventDefault();
      event.stopImmediatePropagation();
      globalSearchSelection = (globalSearchSelection + (event.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
      renderGlobalSearch(document.querySelector('#kq')?.value || '');
      results.querySelector('.kr.sel')?.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (event.key === 'Enter' && rows.length) {
      event.preventDefault();
      event.stopImmediatePropagation();
      location.href = rows[globalSearchSelection].href;
    }
  }, true);
}

function closeClassPopover() {
  classPopover?.remove();
  classPopover = null;
}

async function switchClass(classId) {
  if (classId === classContext.activeClassId) {
    closeClassPopover();
    return;
  }
  await storePut(classContext.db, 'meta', { id: 'active-class-id', value: classId });
  location.reload();
}

function renderClassPopover(anchor) {
  closeClassPopover();
  const rect = anchor.getBoundingClientRect();
  const activeClasses = classContext.classes.filter((item) => item.status !== 'archived');
  classPopover = document.createElement('div');
  classPopover.className = 'class-switch-popover';
  classPopover.style.top = `${Math.min(window.innerHeight - 280, rect.bottom + 8)}px`;
  classPopover.style.left = `${Math.max(12, Math.min(window.innerWidth - 250, rect.right - 238))}px`;
  classPopover.innerHTML = `<div class="class-switch-title">切换班级</div>
    <div class="class-switch-list">${activeClasses.map((item) => `
      <button type="button" class="${item.id === classContext.activeClassId ? 'active' : ''}" data-switch-class="${item.id}">
        <span>${escapeClassText(item.name)}</span>${item.id === classContext.activeClassId ? '<i>当前</i>' : ''}
      </button>`).join('')}</div>
    <div class="class-switch-actions">
      <button type="button" data-create-class>＋ 新建班级</button>
      <button type="button" data-manage-classes>管理班级</button>
    </div>`;
  document.body.append(classPopover);
}

function closeClassModal() {
  classModal?.remove();
  classModal = null;
}

function openClassEditor(record = null) {
  closeClassPopover();
  closeClassModal();
  classModal = document.createElement('div');
  classModal.className = 'class-modal-backdrop';
  classModal.innerHTML = `<form class="class-modal-card" data-class-editor>
    <div><h2>${record ? '重命名班级' : '新建班级'}</h2><p>${record ? '修改后，原班级中的所有数据都会保留。' : '新班级会拥有独立的学生、座位、作业和学情数据。'}</p></div>
    <label>班级名称<input name="className" maxlength="24" required value="${escapeClassText(record?.name || '')}" placeholder="例如：四年级2班"></label>
    <div class="class-modal-actions"><button type="button" data-close-class-modal>取消</button><button class="primary" type="submit">${record ? '保存名称' : '创建班级'}</button></div>
  </form>`;
  classModal.dataset.editClassId = record?.id || '';
  document.body.append(classModal);
  setTimeout(() => classModal.querySelector('input')?.focus(), 20);
}

function openClassManager() {
  closeClassPopover();
  closeClassModal();
  classModal = document.createElement('div');
  classModal.className = 'class-modal-backdrop';
  classModal.innerHTML = `<section class="class-modal-card class-manager-card">
    <div class="class-manager-head"><div><h2>管理班级</h2><p>归档班级不会删除数据，之后可以随时恢复。</p></div><button type="button" data-close-class-modal>关闭</button></div>
    <div class="class-manager-list">${classContext.classes
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
      .map((item) => `<div class="${item.status === 'archived' ? 'archived' : ''}">
        <span><b>${escapeClassText(item.name)}</b><i>${item.id === classContext.activeClassId ? '当前班级' : item.status === 'archived' ? '已归档' : '正常使用'}</i></span>
        <button type="button" data-rename-class="${item.id}">重命名</button>
        <button type="button" data-toggle-archive="${item.id}" ${item.id === classContext.activeClassId ? 'disabled' : ''}>${item.status === 'archived' ? '恢复' : '归档'}</button>
      </div>`).join('')}</div>
    <button type="button" class="class-manager-create" data-create-class>＋ 新建班级</button>
  </section>`;
  document.body.append(classModal);
}

async function saveClassEditor(form) {
  const name = new FormData(form).get('className')?.trim();
  if (!name) return;
  const duplicate = classContext.classes.some((item) => item.name === name && item.id !== classModal.dataset.editClassId);
  if (duplicate) {
    form.querySelector('input').setCustomValidity('已经有同名班级');
    form.querySelector('input').reportValidity();
    return;
  }
  const editId = classModal.dataset.editClassId;
  if (editId) {
    const current = classContext.classes.find((item) => item.id === editId);
    await storePut(classContext.db, 'classes', { ...current, name, updatedAt: Date.now() });
  } else {
    const timestamp = Date.now();
    const record = {
      id: `class-${crypto.randomUUID?.() || timestamp}`,
      name,
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await storePut(classContext.db, 'classes', record);
    await storePut(classContext.db, 'meta', { id: 'active-class-id', value: record.id });
    location.reload();
    return;
  }
  classContext.classes = await storeAll(classContext.db, 'classes');
  updatePickerLabels();
  closeClassModal();
}

async function toggleArchive(classId, button) {
  const record = classContext.classes.find((item) => item.id === classId);
  if (!record || record.id === classContext.activeClassId) return;
  if (record.status !== 'archived' && button.dataset.confirmArchive !== 'true') {
    button.dataset.confirmArchive = 'true';
    button.textContent = '确认归档';
    return;
  }
  await storePut(classContext.db, 'classes', {
    ...record,
    status: record.status === 'archived' ? 'active' : 'archived',
    updatedAt: Date.now(),
  });
  classContext.classes = await storeAll(classContext.db, 'classes');
  openClassManager();
}

async function initializeClassShell() {
  updateShellDate();
  classContext = await managerReady;
  classContext.classes = await storeAll(classContext.db, 'classes');
  updatePickerLabels();
  document.querySelectorAll('.kbtn,.shell-kbtn').forEach((button) => {
    button.dataset.kopen = 'true';
  });
  bindGlobalSearch();

  document.querySelectorAll('.shell-search input,.top .search input:not(#q)').forEach((input) => {
    input.addEventListener('focus', () => {
      openGlobalSearch(input.value);
    });
  });

  document.addEventListener('click', async (event) => {
    const picker = event.target.closest('[data-class-picker]');
    if (picker) {
      event.preventDefault();
      event.stopPropagation();
      renderClassPopover(picker);
      return;
    }
    const switchButton = event.target.closest('[data-switch-class]');
    if (switchButton) {
      await switchClass(switchButton.dataset.switchClass);
      return;
    }
    if (event.target.closest('[data-create-class]')) {
      if (ACCESS_CONTROL && !ACCESS_CONTROL.requireFeature('multiClass')) return;
      openClassEditor();
      return;
    }
    if (event.target.closest('[data-manage-classes]')) {
      openClassManager();
      return;
    }
    const renameButton = event.target.closest('[data-rename-class]');
    if (renameButton) {
      openClassEditor(classContext.classes.find((item) => item.id === renameButton.dataset.renameClass));
      return;
    }
    const archiveButton = event.target.closest('[data-toggle-archive]');
    if (archiveButton) {
      await toggleArchive(archiveButton.dataset.toggleArchive, archiveButton);
      return;
    }
    if (event.target.closest('[data-close-class-modal]') || event.target === classModal) {
      closeClassModal();
      return;
    }
    if (classPopover && !event.target.closest('.class-switch-popover')) closeClassPopover();
  });
  document.addEventListener('submit', async (event) => {
    const form = event.target.closest('[data-class-editor]');
    if (!form) return;
    event.preventDefault();
    await saveClassEditor(form);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeClassShell, { once: true });
} else {
  initializeClassShell();
}
