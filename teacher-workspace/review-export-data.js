import { createStudentMask, isAdminAiUser, runAdminAi } from './ai-client.js';

let BACKUP_DB_NAME = 'shangjiehaoke-teacher-workspace-v07';
const BACKUP_DB_VERSION = 5;
const DEFAULT_CLASS_ID = 'class-local';
const BACKUP_STORES = [
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
const SCOPED_STORES = [
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

const $ = (selector) => document.querySelector(selector);
let backupScope = 'current';
let pendingRestore = null;
let backupDb = null;
let workspaceContext = null;

function escapeText(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character]);
}

function localDateStamp() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function safeFilename(value) {
  return String(value || '班级').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '');
}

function notify(message) {
  const toast = $('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('on');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => toast.classList.remove('on'), 2600);
}

function openBackupDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(BACKUP_DB_NAME, BACKUP_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      BACKUP_STORES.forEach((store) => {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: 'id' });
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readStore(storeName) {
  return new Promise((resolve, reject) => {
    const request = backupDb.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function putRecord(storeName, value) {
  return new Promise((resolve, reject) => {
    const request = backupDb.transaction(storeName, 'readwrite').objectStore(storeName).put(value);
    request.onsuccess = () => resolve(value);
    request.onerror = () => reject(request.error);
  });
}

async function readWorkspace() {
  const [classes, meta, ...records] = await Promise.all([
    readStore('classes'),
    readStore('meta'),
    ...SCOPED_STORES.map((store) => readStore(store)),
  ]);
  const activeClassId = meta.find((item) => item.id === 'active-class-id')?.value
    || workspaceContext?.activeClassId
    || '';
  return {
    classes,
    meta,
    activeClassId,
    records: Object.fromEntries(SCOPED_STORES.map((store, index) => [store, records[index]])),
  };
}

function recordsForClass(records, classId) {
  return Object.fromEntries(SCOPED_STORES.map((store) => [
    store,
    (records[store] || []).filter((item) => (item.classId || DEFAULT_CLASS_ID) === classId),
  ]));
}

function classMeta(meta, classId) {
  return {
    classId,
    seatConfig: meta.find((item) => item.id === `seat-config:${classId}`)?.value
      || { rows: 6, desks: 3, seatsPerDesk: 2 },
    seatAssignments: meta.find((item) => item.id === `seat-assignments:${classId}`)?.value || {},
    initialized: meta.find((item) => item.id === `initialized:${classId}`)?.value ?? true,
  };
}

function backupCounts(records, classCount) {
  return {
    classes: classCount,
    students: records.students?.length || 0,
    judgements: records.judgements?.length || 0,
    homeworks: records.homeworks?.length || 0,
    homeworkEntries: records.homeworkEntries?.length || 0,
  };
}

function renderCounts(counts) {
  $('#backupCounts').innerHTML = `
    <div class="backup-count"><b>${counts.classes}</b><span>班级</span></div>
    <div class="backup-count"><b>${counts.students}</b><span>学生</span></div>
    <div class="backup-count"><b>${counts.judgements}</b><span>学情判断</span></div>
    <div class="backup-count"><b>${counts.homeworks}</b><span>作业登记</span></div>`;
}

async function renderBackupPanel() {
  const workspace = await readWorkspace();
  const currentClass = workspace.classes.find((item) => item.id === workspace.activeClassId);
  const currentRecords = recordsForClass(workspace.records, workspace.activeClassId);
  const allCounts = backupCounts(workspace.records, workspace.classes.length);
  const currentCounts = backupCounts(currentRecords, currentClass ? 1 : 0);
  $('#backupCurrentClass').textContent = currentClass?.name || '尚未创建班级';
  if (backupScope === 'current') {
    $('#backupScopeCopy').innerHTML = currentClass
      ? `备份 <b>${escapeText(currentClass.name)}</b> 的学生、座位、学情、作业和任务记录。`
      : '创建班级后，才会有可以导出的班级数据。';
    $('#exportWorkspaceLabel').textContent = currentClass ? '导出当前班级备份' : '暂无班级可导出';
    $('#exportWorkspaceBackup').disabled = !currentClass;
    renderCounts(currentCounts);
  } else {
    $('#exportWorkspaceBackup').disabled = !workspace.classes.length;
    const archived = workspace.classes.filter((item) => item.status === 'archived').length;
    $('#backupScopeCopy').innerHTML = `备份全部 <b>${workspace.classes.length}</b> 个班级${archived ? `（含 ${archived} 个已归档班级）` : ''}及各自的完整数据。`;
    $('#exportWorkspaceLabel').textContent = '导出全部班级备份';
    renderCounts(allCounts);
  }
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 500);
}

async function exportWorkspaceBackup() {
  const workspace = await readWorkspace();
  const activeClass = workspace.classes.find((item) => item.id === workspace.activeClassId);
  if (backupScope === 'current') {
    if (!activeClass) {
      notify('请先创建班级');
      return;
    }
    const records = recordsForClass(workspace.records, workspace.activeClassId);
    const meta = classMeta(workspace.meta, workspace.activeClassId);
    const backup = {
      app: '上节好课教师工作台',
      version: 5,
      scope: 'current-class',
      exportedAt: new Date().toISOString(),
      class: { ...activeClass },
      classId: workspace.activeClassId,
      ...records,
      seatConfig: meta.seatConfig,
      seatAssignments: meta.seatAssignments,
      initialized: meta.initialized,
    };
    downloadJson(
      backup,
      `上节好课-${safeFilename(activeClass.name)}-班级备份-${localDateStamp()}.json`,
    );
    notify(`${activeClass.name}备份已导出`);
    return;
  }
  const backup = {
    app: '上节好课教师工作台',
    version: 5,
    scope: 'all-classes',
    exportedAt: new Date().toISOString(),
    activeClassId: workspace.activeClassId,
    classes: workspace.classes,
    records: workspace.records,
    classMeta: workspace.classes.map((item) => classMeta(workspace.meta, item.id)),
  };
  downloadJson(backup, `上节好课-全部班级备份-${localDateStamp()}.json`);
  notify(`全部 ${workspace.classes.length} 个班级已备份`);
}

function normalizeBackup(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('这不是有效的教师工作台备份');
  if (raw.app && raw.app !== '上节好课教师工作台') throw new Error('该文件不是上节好课教师工作台备份');
  if (raw.version != null && (!Number.isInteger(raw.version) || raw.version < 1 || raw.version > BACKUP_DB_VERSION)) {
    throw new Error('备份版本不受支持，请先升级工作台');
  }
  const validId = (value) => (
    (typeof value === 'string' && value.trim().length > 0)
    || (typeof value === 'number' && Number.isFinite(value))
  );
  const validateRecords = (records) => {
    SCOPED_STORES.forEach((store) => {
      const values = records[store] || [];
      if (!Array.isArray(values) || values.length > 200000) {
        throw new Error(`备份中的${store}记录不完整`);
      }
      const recordIds = new Set();
      values.forEach((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item) || !validId(item.id)) {
          throw new Error(`备份中的${store}记录缺少有效ID`);
        }
        const recordId = `${typeof item.id}:${item.id}`;
        if (recordIds.has(recordId)) throw new Error(`备份中的${store}存在重复记录`);
        recordIds.add(recordId);
        if (item.classId != null && !validId(item.classId)) {
          throw new Error(`备份中的${store}班级关联无效`);
        }
      });
    });
  };
  if (raw?.scope === 'all-classes' && Array.isArray(raw.classes) && raw.records) {
    if (raw.classes.length === 0 || raw.classes.length > 500 || raw.classes.some((item) => (
      !item
      || typeof item !== 'object'
      || Array.isArray(item)
      || !validId(item.id)
      || !String(item.name || '').trim()
    ))) {
      throw new Error('备份中的班级记录不完整');
    }
    const classIds = new Set();
    const classNames = new Set();
    raw.classes.forEach((item) => {
      const classId = `${typeof item.id}:${item.id}`;
      const className = String(item.name).trim();
      if (classIds.has(classId)) throw new Error('备份中存在重复班级ID');
      if (classNames.has(className)) throw new Error('备份中存在重复班级名称');
      classIds.add(classId);
      classNames.add(className);
    });
    const validStores = SCOPED_STORES.every((store) => Array.isArray(raw.records[store] || []));
    if (!validStores) throw new Error('备份记录结构不完整');
    validateRecords(raw.records);
    if (raw.classMeta != null && !Array.isArray(raw.classMeta)) throw new Error('备份中的班级设置不完整');
    SCOPED_STORES.forEach((store) => {
      (raw.records[store] || []).forEach((item) => {
        const classId = item.classId || DEFAULT_CLASS_ID;
        if (!classIds.has(`${typeof classId}:${classId}`)) {
          throw new Error(`备份中的${store}包含未知班级数据`);
        }
      });
    });
    (raw.classMeta || []).forEach((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item) || !validId(item.classId)) {
        throw new Error('备份中的班级设置不完整');
      }
      if (!classIds.has(`${typeof item.classId}:${item.classId}`)) {
        throw new Error('备份中的班级设置关联了未知班级');
      }
    });
    return {
      scope: 'all-classes',
      classes: raw.classes,
      records: Object.fromEntries(SCOPED_STORES.map((store) => [store, raw.records[store] || []])),
      classMeta: Array.isArray(raw.classMeta) ? raw.classMeta : [],
      exportedAt: raw.exportedAt,
    };
  }
  if (Array.isArray(raw?.students) && Array.isArray(raw?.kps) && Array.isArray(raw?.judgements)) {
    const records = Object.fromEntries(SCOPED_STORES.map((store) => [store, raw[store] || []]));
    validateRecords(records);
    const classRecord = raw.class || {
      id: raw.classId || DEFAULT_CLASS_ID,
      name: raw.className || '备份班级',
      status: 'active',
    };
    if (!classRecord || typeof classRecord !== 'object' || Array.isArray(classRecord) || !String(classRecord.name || '').trim()) {
      throw new Error('备份中的班级记录不完整');
    }
    return {
      scope: 'current-class',
      class: classRecord,
      records,
      seatConfig: raw.seatConfig || { rows: 6, desks: 3, seatsPerDesk: 2 },
      seatAssignments: raw.seatAssignments || {},
      initialized: raw.initialized ?? true,
      exportedAt: raw.exportedAt,
    };
  }
  throw new Error('这不是有效的教师工作台备份');
}

function summarizeRestore(backup) {
  if (backup.scope === 'current-class') {
    return {
      title: backup.class?.name || '备份班级',
      counts: backupCounts(backup.records, 1),
    };
  }
  return {
    title: `${backup.classes.length} 个班级`,
    counts: backupCounts(backup.records, backup.classes.length),
  };
}

function renderRestoreDialog() {
  const summary = summarizeRestore(pendingRestore);
  const counts = summary.counts;
  const date = pendingRestore.exportedAt
    ? new Date(pendingRestore.exportedAt).toLocaleString('zh-CN', { hour12: false })
    : '日期未知';
  $('#workspaceRestoreSummary').innerHTML = `
    <b>${escapeText(summary.title)}</b>
    <span>${escapeText(date)}备份 · ${counts.students} 名学生 · ${counts.judgements} 条学情判断 · ${counts.homeworks} 次作业登记 · ${counts.homeworkEntries} 条学生作业状态</span>`;
  if (pendingRestore.scope === 'current-class') {
    const activeClass = workspaceContext.classes.find((item) => item.id === workspaceContext.activeClassId);
    $('#workspaceRestoreOptions').innerHTML = `
      <label class="restore-option">
        <input type="radio" name="restoreMode" value="create" checked>
        <span><b>创建为新班级（推荐）</b><i>生成“${escapeText(pendingRestore.class?.name || '备份班级')}（恢复）”，现有班级不会改变。</i></span>
      </label>${activeClass ? `
        <label class="restore-option">
          <input type="radio" name="restoreMode" value="overwrite">
          <span><b>覆盖当前班级</b><i>用备份替换“${escapeText(activeClass.name)}”中的学生、座位、学情、作业和任务。</i></span>
        </label>` : ''}`;
  } else {
    $('#workspaceRestoreOptions').innerHTML = `
      <label class="restore-option">
        <input type="radio" name="restoreMode" value="create-all" checked>
        <span><b>全部创建为新班级（推荐）</b><i>每个备份班级都生成一个恢复副本，现有班级不会改变。</i></span>
      </label>
      <label class="restore-option">
        <input type="radio" name="restoreMode" value="merge">
        <span><b>覆盖同名班级并补充其他班级</b><i>同名班级会被备份替换；没有同名班级的会自动新建。</i></span>
      </label>`;
  }
  updateRestoreWarning();
  $('#workspaceRestoreDialog').showModal();
}

function updateRestoreWarning() {
  const mode = $('input[name="restoreMode"]:checked')?.value;
  const warning = $('#workspaceRestoreWarning');
  if (mode === 'overwrite') {
    warning.textContent = '注意：当前班级的数据将被替换。其他班级不受影响。';
    return;
  }
  if (mode === 'merge') {
    warning.textContent = '注意：与备份同名的班级会被替换；不会删除其他班级。';
    return;
  }
  warning.textContent = '安全恢复：只创建新的班级副本，不修改现有班级。';
}

function uniqueClassName(baseName, classes) {
  const names = new Set(classes.map((item) => item.name));
  if (!names.has(baseName)) return baseName;
  let index = 2;
  while (names.has(`${baseName}${index}`)) index += 1;
  return `${baseName}${index}`;
}

function newClassId() {
  return `class-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function newRecordId(classId, storeName) {
  return `${classId}:${storeName}:${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function remapClassDataset(records, seatAssignments, targetClassId) {
  const maps = Object.fromEntries(SCOPED_STORES.map((store) => [store, new Map()]));
  SCOPED_STORES.forEach((store) => {
    (records[store] || []).forEach((item) => {
      if (item.id != null) maps[store].set(item.id, newRecordId(targetClassId, store));
    });
  });
  const mapOne = (store, value) => (value == null ? value : (maps[store].get(value) || value));
  const remapped = {};
  SCOPED_STORES.forEach((store) => {
    remapped[store] = (records[store] || []).map((item) => {
      const copy = {
        ...item,
        id: mapOne(store, item.id),
        classId: targetClassId,
      };
      if ('studentId' in copy) copy.studentId = mapOne('students', copy.studentId);
      if ('studentIds' in copy) copy.studentIds = (copy.studentIds || []).map((id) => mapOne('students', id));
      if ('kpId' in copy) copy.kpId = mapOne('kps', copy.kpId);
      if ('kpIds' in copy) copy.kpIds = (copy.kpIds || []).map((id) => mapOne('kps', id));
      if ('setId' in copy) copy.setId = mapOne('questionSets', copy.setId);
      if ('questionSetId' in copy) copy.questionSetId = mapOne('questionSets', copy.questionSetId);
      if ('reasonTemplateId' in copy) copy.reasonTemplateId = mapOne('reasonTemplates', copy.reasonTemplateId);
      if ('homeworkId' in copy) copy.homeworkId = mapOne('homeworks', copy.homeworkId);
      return copy;
    });
  });
  const remappedSeats = Object.fromEntries(
    Object.entries(seatAssignments || {}).map(([seat, studentId]) => [
      seat,
      mapOne('students', studentId),
    ]),
  );
  return { records: remapped, seatAssignments: remappedSeats };
}

async function restoreDatasetToClass(source, targetClassId, classRecord = null) {
  const remapped = remapClassDataset(source.records, source.seatAssignments, targetClassId);
  await new Promise((resolve, reject) => {
    const stores = [...SCOPED_STORES, 'meta'];
    if (classRecord) stores.push('classes');
    const transaction = backupDb.transaction(stores, 'readwrite');
    let pendingDeletes = SCOPED_STORES.length;
    const queueWrites = () => {
      SCOPED_STORES.forEach((storeName) => {
        const store = transaction.objectStore(storeName);
        (remapped.records[storeName] || []).forEach((record) => store.put(record));
      });
      const meta = transaction.objectStore('meta');
      meta.put({
        id: `seat-config:${targetClassId}`,
        value: source.seatConfig || { rows: 6, desks: 3, seatsPerDesk: 2 },
      });
      meta.put({ id: `seat-assignments:${targetClassId}`, value: remapped.seatAssignments });
      meta.put({ id: `initialized:${targetClassId}`, value: source.initialized ?? true });
      if (classRecord) transaction.objectStore('classes').put(classRecord);
    };
    SCOPED_STORES.forEach((storeName) => {
      const cursor = transaction.objectStore(storeName).openCursor();
      cursor.onsuccess = () => {
        const item = cursor.result;
        if (item) {
          if ((item.value.classId || DEFAULT_CLASS_ID) === targetClassId) item.delete();
          item.continue();
          return;
        }
        pendingDeletes -= 1;
        if (pendingDeletes === 0) queueWrites();
      };
    });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('恢复事务已取消'));
  });
}

async function restoreDatasetsToClasses(plans, database = backupDb) {
  const preparedPlans = plans.map((plan) => ({
    ...plan,
    remapped: remapClassDataset(plan.source.records, plan.source.seatAssignments, plan.targetClassId),
  }));
  const targetClassIds = new Set(preparedPlans.map((plan) => String(plan.targetClassId)));

  await new Promise((resolve, reject) => {
    const transaction = database.transaction([...SCOPED_STORES, 'meta', 'classes'], 'readwrite');
    let pendingDeletes = SCOPED_STORES.length;
    const queueWrites = () => {
      try {
        preparedPlans.forEach((plan) => {
          SCOPED_STORES.forEach((storeName) => {
            const store = transaction.objectStore(storeName);
            (plan.remapped.records[storeName] || []).forEach((record) => store.put(record));
          });
          const meta = transaction.objectStore('meta');
          meta.put({
            id: `seat-config:${plan.targetClassId}`,
            value: plan.source.seatConfig || { rows: 6, desks: 3, seatsPerDesk: 2 },
          });
          meta.put({
            id: `seat-assignments:${plan.targetClassId}`,
            value: plan.remapped.seatAssignments,
          });
          meta.put({
            id: `initialized:${plan.targetClassId}`,
            value: plan.source.initialized ?? true,
          });
          if (plan.classRecord) transaction.objectStore('classes').put(plan.classRecord);
        });
      } catch (error) {
        transaction.abort();
        reject(error);
      }
    };

    SCOPED_STORES.forEach((storeName) => {
      const cursor = transaction.objectStore(storeName).openCursor();
      cursor.onsuccess = () => {
        const item = cursor.result;
        if (item) {
          const classId = item.value.classId || DEFAULT_CLASS_ID;
          if (targetClassIds.has(String(classId))) item.delete();
          item.continue();
          return;
        }
        pendingDeletes -= 1;
        if (pendingDeletes === 0) queueWrites();
      };
    });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('批量恢复事务已取消'));
  });
}

function createRestoredClass(sourceClass, classes, suffix = '（恢复）') {
  const name = uniqueClassName(`${sourceClass?.name || '备份班级'}${suffix}`, classes);
  const timestamp = Date.now();
  const classRecord = {
    id: newClassId(),
    name,
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return classRecord;
}

function sourceForAllClass(backup, sourceClass) {
  const sourceId = sourceClass.id || DEFAULT_CLASS_ID;
  const records = Object.fromEntries(SCOPED_STORES.map((store) => [
    store,
    (backup.records[store] || []).filter((item) => (item.classId || DEFAULT_CLASS_ID) === sourceId),
  ]));
  const meta = backup.classMeta.find((item) => item.classId === sourceId) || {};
  return {
    records,
    seatConfig: meta.seatConfig,
    seatAssignments: meta.seatAssignments,
    initialized: meta.initialized,
  };
}

async function restoreCurrentClassBackup(mode, workspace) {
  if (mode === 'overwrite') {
    if (!workspace.activeClassId || !workspace.classes.some((item) => item.id === workspace.activeClassId)) {
      throw new Error('当前没有可覆盖的班级');
    }
    await restoreDatasetToClass(pendingRestore, workspace.activeClassId);
    return { activeClassId: workspace.activeClassId, message: '当前班级已从备份恢复' };
  }
  const sourceClass = createRestoredClass(pendingRestore.class, workspace.classes);
  await restoreDatasetToClass(pendingRestore, sourceClass.id, sourceClass);
  workspace.classes.push(sourceClass);
  return { activeClassId: sourceClass.id, message: `${sourceClass.name}已创建并恢复` };
}

async function restoreAllClassBackup(mode, workspace) {
  let firstRestoredId = null;
  const candidateClasses = [...workspace.classes];
  const plans = [];
  for (const sourceClass of pendingRestore.classes) {
    const source = sourceForAllClass(pendingRestore, sourceClass);
    let targetClass;
    let classRecord = null;
    if (mode === 'merge') {
      targetClass = candidateClasses.find((item) => item.name === sourceClass.name);
      if (!targetClass) {
        const timestamp = Date.now();
        targetClass = {
          id: newClassId(),
          name: uniqueClassName(sourceClass.name || '备份班级', candidateClasses),
          status: sourceClass.status === 'archived' ? 'archived' : 'active',
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        classRecord = targetClass;
        candidateClasses.push(targetClass);
      }
    } else {
      targetClass = createRestoredClass(sourceClass, candidateClasses);
      classRecord = targetClass;
      candidateClasses.push(targetClass);
    }
    plans.push({ source, targetClassId: targetClass.id, classRecord });
    firstRestoredId ||= targetClass.id;
  }
  await restoreDatasetsToClasses(plans);
  workspace.classes = candidateClasses;
  return {
    activeClassId: mode === 'create-all' ? firstRestoredId : workspace.activeClassId,
    message: `已恢复 ${pendingRestore.classes.length} 个班级`,
  };
}

async function confirmRestore() {
  const button = $('#confirmWorkspaceRestore');
  const mode = $('input[name="restoreMode"]:checked')?.value;
  if (!pendingRestore || !mode) return;
  button.disabled = true;
  button.textContent = '正在恢复…';
  try {
    const workspace = await readWorkspace();
    const result = pendingRestore.scope === 'current-class'
      ? await restoreCurrentClassBackup(mode, workspace)
      : await restoreAllClassBackup(mode, workspace);
    if (result.activeClassId) {
      await putRecord('meta', { id: 'active-class-id', value: result.activeClassId });
    }
    notify(result.message);
    $('#workspaceRestoreDialog').close();
    setTimeout(() => {
      window.location.href = 'class.html';
    }, 450);
  } catch (error) {
    console.error(error);
    notify('恢复未完成，原有数据已自动回滚');
    button.disabled = false;
    button.textContent = '确认恢复';
  }
}

async function loadRestoreFile(file) {
  try {
    if (file.size > 50 * 1024 * 1024) throw new Error('备份文件超过50MB，无法安全恢复');
    const raw = JSON.parse(await file.text());
    pendingRestore = normalizeBackup(raw);
    workspaceContext = await window.TeacherClassManager.getContext();
    renderRestoreDialog();
  } catch (error) {
    notify(error.message || '备份文件无法读取');
  } finally {
    $('#workspaceRestoreFile').value = '';
  }
}

async function initializeBackupPanel() {
  await window.TeacherWorkspaceAccess?.ready;
  BACKUP_DB_NAME = window.TeacherWorkspaceAccess?.databaseName || BACKUP_DB_NAME;
  await window.TeacherClassManager?.ready;
  workspaceContext = await window.TeacherClassManager.getContext();
  backupDb = workspaceContext.db || await openBackupDatabase();
  await renderBackupPanel();
  window.TeacherWorkspaceBackup = {
    async preview(rawBackup) {
      pendingRestore = normalizeBackup(rawBackup);
      workspaceContext = await window.TeacherClassManager.getContext();
      renderRestoreDialog();
    },
  };
  window.addEventListener('teacher-workspace-preview-backup', (event) => {
    window.TeacherWorkspaceBackup.preview(event.detail).catch((error) => notify(error.message));
  });

  document.querySelectorAll('[data-backup-scope]').forEach((button) => {
    button.addEventListener('click', async () => {
      backupScope = button.dataset.backupScope;
      document.querySelectorAll('[data-backup-scope]').forEach((item) => {
        item.classList.toggle('on', item === button);
      });
      await renderBackupPanel();
    });
  });
  $('#exportWorkspaceBackup').addEventListener('click', exportWorkspaceBackup);
  $('#workspaceRestoreFile').addEventListener('change', (event) => {
    const [file] = event.target.files;
    if (file) loadRestoreFile(file);
  });
  $('#workspaceRestoreOptions').addEventListener('change', updateRestoreWarning);
  $('#closeWorkspaceRestore').addEventListener('click', () => $('#workspaceRestoreDialog').close());
  $('#cancelWorkspaceRestore').addEventListener('click', () => $('#workspaceRestoreDialog').close());
  $('#confirmWorkspaceRestore').addEventListener('click', confirmRestore);
  $('#workspaceRestoreDialog').addEventListener('close', () => {
    $('#confirmWorkspaceRestore').disabled = false;
    $('#confirmWorkspaceRestore').textContent = '确认恢复';
  });
}

function latestStatuses(judgements) {
  const latest = new Map();
  [...judgements].sort((a, b) => (a.judgedAt || 0) - (b.judgedAt || 0)).forEach((item) => {
    latest.set(`${item.studentId}:${item.kpId}`, item);
  });
  return [...latest.values()].filter((item) => item.status !== 'cleared');
}

function hidePrototypeOnlySections() {
  document.querySelectorAll('.pane').forEach((section) => {
    const title = section.querySelector('.ph h2')?.textContent.trim();
    if (title === '数据导出' || title === '删除与匿名化') section.remove();
  });
  const introButton = [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === '了解');
  introButton?.remove();
}

function renderRealReview(classRecord, records) {
  const students = records.students || [];
  const notes = records.notes || [];
  const tasks = records.followupTasks || [];
  const homeworks = records.homeworks || [];
  const judgements = latestStatuses(records.judgements || []);
  const mastered = judgements.filter((item) => item.status === 'mastered').length;
  const support = judgements.filter((item) => item.status === 'needs_support').length;
  const completedTasks = tasks.filter((item) => item.status === 'completed').length;
  const paper = $('#reviewDoc .paper');
  paper.innerHTML = `<div class="hd">
      <div class="k">班 级 阶 段 回 顾</div>
      <h3>${escapeText(classRecord.name)} · ${localDateStamp()}</h3>
      <div class="m">根据当前浏览器中已保存的真实记录生成</div>
    </div>
    <div class="bd">
      <div class="sec">
        <h4><span class="d"></span>当前数据概览</h4>
        <div class="stats">
          <div class="stat"><div class="n">${students.length}</div><div class="l">名学生</div></div>
          <div class="stat"><div class="n">${notes.length}</div><div class="l">条班级记录</div></div>
          <div class="stat"><div class="n">${homeworks.length}</div><div class="l">次作业登记</div></div>
          <div class="stat"><div class="n">${completedTasks}<span style="font-size:13px;color:var(--text-3)"> / ${tasks.length}</span></div><div class="l">已完成任务</div></div>
        </div>
      </div>
      <div class="sec">
        <h4><span class="d"></span>学情推进</h4>
        <p>当前共保存 <b>${judgements.length}</b> 个学生—知识点判断，其中已掌握 <b>${mastered}</b> 项，待提升 <b>${support}</b> 项。未判断的数据没有计入掌握情况。</p>
      </div>
      <div class="sec">
        <h4><span class="d"></span>近期班级记录</h4>
        ${notes.length
          ? notes.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 8).map((note) => `<div class="li"><span class="b"></span><span><b>${escapeText(new Date(note.createdAt).toLocaleDateString('zh-CN'))}</b>&emsp;${escapeText(note.body || note.title || '班级记录')}</span></div>`).join('')
          : '<p>当前班级还没有保存班级记录。</p>'}
      </div>
      <div class="sec">
        <h4><span class="d" style="background:var(--text-3)"></span>说明</h4>
        <p>本回顾只使用当前班级已经保存在本机的数据，不再混入演示学生或固定统计数字。</p>
      </div>
    </div>`;
  $('#reviewDoc').classList.remove('hide');
  $('#reviewDoc').scrollIntoView({ behavior: 'smooth', block: 'start' });
  notify(`已根据${students.length}名学生的真实数据生成回顾`);
}

function renderRealStudentEvaluation(student, records) {
  const notes = (records.notes || []).filter((note) => (note.studentIds || []).includes(student.id));
  const statuses = latestStatuses((records.judgements || []).filter((item) => item.studentId === student.id));
  const mastered = statuses.filter((item) => item.status === 'mastered').length;
  const support = statuses.filter((item) => item.status === 'needs_support');
  const kpById = Object.fromEntries((records.kps || []).map((kp) => [kp.id, kp]));
  const entries = (records.homeworkEntries || []).filter((entry) => entry.studentId === student.id);
  const completed = entries.filter((entry) => entry.outcome === 'completed').length;
  $('#stuT').textContent = `${student.name} · 阶段评价`;
  const container = $('#stuDoc > div:last-child');
  container.innerHTML = `<div class="vs">
      <div class="vsc me">
        <div class="t">当前真实记录</div>
        <div class="c">已掌握知识点：<b>${mastered}</b> 项<br>
          待提升知识点：<b>${support.length}</b> 项<br>
          个人档案记录：<b>${notes.length}</b> 条<br>
          已登记作业：<b>${entries.length}</b> 次，其中完成 ${completed} 次
        </div>
      </div>
      <div class="vsc pa">
        <div class="t">给家长看的版本</div>
        <div class="c">${escapeText(student.name)}目前已有 <b>${mastered}</b> 个知识点被确认掌握。
          ${support.length
            ? `接下来会继续关注：<b>${support.slice(0, 3).map((item) => escapeText(kpById[item.kpId]?.name || '相关知识点')).join('、')}</b>。`
            : '当前已评价的知识点中没有待提升项。'}
          ${notes.length ? `<br><br>本阶段还积累了 ${notes.length} 条课堂与班级记录。` : ''}
        </div>
      </div>
    </div>
    <div class="vsnote">评价内容来自当前班级的真实学情、作业和个人档案记录；没有记录的内容不会被自动编造。</div>`;
  $('#stuDoc').classList.remove('hide');
  $('#stuDoc').scrollIntoView({ behavior: 'smooth', block: 'start' });
  notify('真实评价已生成');
}

function bulletList(items = []) {
  return items.length
    ? `<ul class="bullets">${items.map((item) => `<li>${escapeText(item)}</li>`).join('')}</ul>`
    : '<p>当前记录中没有可确认的补充内容。</p>';
}

async function generateAiClassReview(classRecord, records) {
  const button = $('#genAiReview');
  const mask = createStudentMask(records.students || []);
  const statuses = latestStatuses(records.judgements || []);
  const kpById = Object.fromEntries((records.kps || []).map((kp) => [kp.id, kp]));
  const learning = Object.values(statuses.reduce((groups, item) => {
    const name = kpById[item.kpId]?.name || '相关知识点';
    groups[name] ||= { knowledgePoint: name, mastered: 0, needsSupport: 0, reasons: [] };
    if (item.status === 'mastered') groups[name].mastered += 1;
    if (item.status === 'needs_support') {
      groups[name].needsSupport += 1;
      if (item.note) groups[name].reasons.push(mask.maskText(item.note));
    }
    return groups;
  }, {})).slice(0, 30);
  button.disabled = true;
  button.textContent = '✦ 正在生成…';
  try {
    const result = await runAdminAi('review', {
      mode: 'class',
      classFacts: {
        studentCount: records.students?.length || 0,
        noteCount: records.notes?.length || 0,
        homeworkCount: records.homeworks?.length || 0,
        taskCount: records.followupTasks?.length || 0,
        completedTaskCount: (records.followupTasks || []).filter((item) => item.status === 'completed').length,
      },
      learning,
      recentRecords: (records.notes || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 12).map((note) => ({
        category: note.category,
        body: mask.maskText(note.body || note.title || ''),
      })),
    });
    const paper = $('#reviewDoc .paper');
    paper.innerHTML = `<div class="hd"><div class="k">AI 辅 助 · 教 师 已 确 认 记 录</div><h3>${escapeText(classRecord.name)} · ${localDateStamp()}</h3><div class="m">MiMo 生成草稿，打印前请由教师复核</div></div>
      <div class="bd"><div class="sec"><h4><span class="d"></span>阶段概况 <span class="ai-badge">MiMo</span></h4><p>${escapeText(mask.unmaskText(result.overview))}</p></div>
      <div class="sec"><h4><span class="d"></span>学情推进</h4><p>${escapeText(mask.unmaskText(result.learningProgress))}</p></div>
      <div class="sec"><h4><span class="d"></span>客观亮点</h4>${bulletList(result.highlights.map(mask.unmaskText))}</div>
      <div class="sec"><h4><span class="d"></span>下一步建议</h4>${bulletList(result.nextSteps.map(mask.unmaskText))}</div>
      <div class="sec"><h4><span class="d" style="background:var(--text-3)"></span>说明</h4><p>本草稿只使用当前浏览器中的已确认记录；AI没有修改任何学情状态。</p></div></div>`;
    $('#reviewDoc').classList.remove('hide');
    $('#reviewDoc').scrollIntoView({ behavior: 'smooth', block: 'start' });
    notify('AI班级回顾已生成，请教师复核');
  } catch (error) {
    notify(error.message || 'AI班级回顾生成失败');
  } finally {
    button.disabled = false;
    button.textContent = '✦ AI 生成回顾';
  }
}

async function generateAiStudentReview(student, records) {
  const button = $('#genAiStu');
  const mask = createStudentMask(records.students || []);
  const statuses = latestStatuses((records.judgements || []).filter((item) => item.studentId === student.id));
  const kpById = Object.fromEntries((records.kps || []).map((kp) => [kp.id, kp]));
  const entries = (records.homeworkEntries || []).filter((entry) => entry.studentId === student.id);
  button.disabled = true;
  button.textContent = '✦ 正在生成…';
  try {
    const result = await runAdminAi('review', {
      mode: 'student',
      studentToken: mask.tokensForIds([student.id])[0] || '学生本人',
      knowledge: statuses.map((item) => ({
        knowledgePoint: kpById[item.kpId]?.name || '相关知识点',
        status: item.status,
        reason: mask.maskText(item.note || ''),
      })).slice(0, 40),
      homework: {
        total: entries.length,
        completed: entries.filter((entry) => entry.outcome === 'completed').length,
        partial: entries.filter((entry) => entry.outcome === 'partial').length,
        incomplete: entries.filter((entry) => entry.outcome === 'incomplete').length,
      },
      records: (records.notes || []).filter((note) => (note.studentIds || []).includes(student.id)).slice(0, 16).map((note) => ({
        category: note.category,
        body: mask.maskText(note.body || note.title || ''),
      })),
    });
    $('#stuT').textContent = `${student.name} · AI阶段评价`;
    const container = $('#stuDoc > div:last-child');
    container.innerHTML = `<div class="vs"><div class="vsc me"><div class="t">教师内部版 <span class="ai-badge">MiMo</span></div><div class="c">${escapeText(mask.unmaskText(result.teacherSummary))}</div>${result.nextSteps.length ? `<div class="t" style="margin-top:14px">下一步建议</div>${bulletList(result.nextSteps.map(mask.unmaskText))}` : ''}</div>
      <div class="vsc pa"><div class="t">给家长看的版本</div><div class="c">${escapeText(mask.unmaskText(result.parentSummary))}</div></div></div>
      <div class="vsnote">内容来自已确认的学情、作业和个人档案记录；这是AI草稿，使用前请由教师复核。</div>`;
    $('#stuDoc').classList.remove('hide');
    $('#stuDoc').scrollIntoView({ behavior: 'smooth', block: 'start' });
    notify('AI学生评价已生成，请教师复核');
  } catch (error) {
    notify(error.message || 'AI学生评价生成失败');
  } finally {
    button.disabled = false;
    button.textContent = '✦ AI 生成评价';
  }
}

async function initializeRealReports() {
  const workspace = await readWorkspace();
  const classRecord = workspace.classes.find((item) => item.id === workspace.activeClassId);
  const records = recordsForClass(workspace.records, workspace.activeClassId);
  const select = $('#stuSel');
  select.innerHTML = records.students.length
    ? records.students.sort((a, b) => a.sortOrder - b.sortOrder).map((student) => `<option value="${escapeText(student.id)}">${escapeText(student.name)}</option>`).join('')
    : `<option value="">${classRecord ? '当前班级还没有学生' : '尚未创建班级'}</option>`;
  $('#genReview').onclick = () => {
    if (!classRecord) {
      notify('请先创建班级并导入学生');
      return;
    }
    renderRealReview(classRecord, records);
  };
  $('#genStu').onclick = () => {
    const student = records.students.find((item) => item.id === select.value);
    if (!student) {
      notify('请先导入学生名单');
      return;
    }
    renderRealStudentEvaluation(student, records);
  };
  if (isAdminAiUser()) {
    $('#genAiReview')?.classList.add('on');
    $('#genAiStu')?.classList.add('on');
    $('#genAiReview').onclick = () => {
      if (!classRecord) return notify('请先创建班级并导入学生');
      generateAiClassReview(classRecord, records);
    };
    $('#genAiStu').onclick = () => {
      const student = records.students.find((item) => item.id === select.value);
      if (!student) return notify('请先导入学生名单');
      generateAiStudentReview(student, records);
    };
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  initializeBackupPanel()
    .then(() => {
      hidePrototypeOnlySections();
      return initializeRealReports();
    })
    .catch((error) => {
      console.error(error);
      $('#backupScopeCopy').textContent = '暂时无法读取本机班级数据，请刷新页面后重试。';
      notify('回顾数据暂时无法读取');
    });
}

export { normalizeBackup, remapClassDataset, restoreDatasetsToClasses };
