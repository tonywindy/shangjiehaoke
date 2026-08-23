(function () {
  'use strict';

  var LEGACY_DATABASE = 'shangjiehaoke-teacher-workspace-v07';
  var EXPERIENCE_DATABASE = 'shangjiehaoke-teacher-workspace-experience-v1';
  var BLOCKED_DATABASE = 'shangjiehaoke-teacher-workspace-locked-v1';
  var DATABASE_VERSION = 5;
  var STORES = [
    'meta', 'classes', 'students', 'kps', 'judgements', 'questionSets',
    'questionSetUses', 'reasonTemplates', 'homeworks', 'homeworkEntries',
    'followupTasks', 'notes',
  ];
  var params = new URLSearchParams(location.search);
  var forceExperience = params.get('experience') === '1';

  var authorized = false;
  var mode = 'experience';
  var databaseName = EXPERIENCE_DATABASE;
  var accountSession = null;
  var limits = { classes: 1, manualTasks: 5, homeworks: 1, knowledgePoints: 3, students: 12 };
  var featureLabels = {
    studentImport: '导入真实学生名单',
    knowledgeImport: '导入完整知识点清单',
    multiClass: '新建和管理多个班级',
    unlimitedTasks: '创建更多任务',
    unlimitedHomeworks: '登记更多作业',
    exportBackup: '导出、备份和恢复数据',
  };

  function openDatabase(name) {
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open(name || EXPERIENCE_DATABASE, DATABASE_VERSION);
      request.onupgradeneeded = function () {
        var db = request.result;
        STORES.forEach(function (name) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
        });
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  function demoRecords() {
    var timestamp = Date.now();
    var classId = 'class-local';
    var names = ['陈浩宇', '林雨桐', '周子轩', '黄诗涵', '张博文', '李欣怡', '王俊熙', '朱若曦', '刘奕辰', '吴梦琪', '徐嘉乐', '孙语嫣'];
    var students = names.map(function (name, index) {
      return {
        id: 'experience-student-' + String(index + 1).padStart(2, '0'),
        classId: classId,
        name: name,
        seatNo: index + 1,
        sortOrder: index,
        createdAt: timestamp + index,
      };
    });
    var kps = [
      { id: 'experience-kp-1', classId: classId, unitName: '体验单元 · 表内乘除法', name: '理解乘法的意义', sortOrder: 0, createdAt: timestamp },
      { id: 'experience-kp-2', classId: classId, unitName: '体验单元 · 表内乘除法', name: '熟练运用乘法口诀', sortOrder: 1, createdAt: timestamp + 1 },
      { id: 'experience-kp-3', classId: classId, unitName: '体验单元 · 表内乘除法', name: '解决简单实际问题', sortOrder: 2, createdAt: timestamp + 2 },
    ];
    var statuses = ['mastered', 'needs_support', 'mastered', 'mastered', 'needs_support', 'mastered'];
    var judgements = students.slice(0, 6).map(function (student, index) {
      return {
        id: 'experience-judgement-' + (index + 1),
        classId: classId,
        studentId: student.id,
        kpId: kps[index % kps.length].id,
        status: statuses[index],
        note: statuses[index] === 'needs_support' ? '容易混淆题意中的数量关系' : '',
        judgedAt: timestamp - (index + 1) * 3600000,
        sourceType: 'experience_sample',
      };
    });
    var assignments = {};
    students.forEach(function (student, index) {
      var row = Math.floor(index / 4);
      var desk = Math.floor((index % 4) / 2);
      var seat = index % 2;
      assignments[row + ':' + desk + ':' + seat] = student.id;
    });
    return {
      meta: [
        { id: 'active-class-id', value: classId },
        { id: 'experience-seeded-v2', value: true },
        { id: 'initialized:' + classId, value: true },
        { id: 'seat-config:' + classId, value: { rows: 3, desks: 2, seatsPerDesk: 2 } },
        { id: 'seat-assignments:' + classId, value: assignments },
      ],
      classes: [{ id: classId, name: '体验班（虚拟学生）', status: 'active', createdAt: timestamp, updatedAt: timestamp }],
      students: students,
      kps: kps,
      judgements: judgements,
      questionSets: [],
      questionSetUses: [],
      reasonTemplates: [{
        id: 'experience-reason-1', classId: classId, unitName: '体验单元 · 表内乘除法',
        text: '没有看清题目中的数量关系', usageCount: 2, createdAt: timestamp, updatedAt: timestamp,
      }],
      homeworks: [],
      homeworkEntries: [],
      followupTasks: [
        { id: 'experience-task-1', classId: classId, type: 'demo', title: '找黄诗涵聊一聊', status: 'pending', dueDate: new Date().toISOString().slice(0, 10), list: '班级管理', source: '体验示例', createdAt: timestamp, updatedAt: timestamp },
        { id: 'experience-task-2', classId: classId, type: 'demo', title: '准备一组乘法口诀练习', status: 'pending', dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10), list: '学情评价', source: '体验示例', createdAt: timestamp + 1, updatedAt: timestamp + 1 },
      ],
      notes: [
        { id: 'experience-note-1', classId: classId, type: 'student_note', category: '表扬', body: '主动帮助同学讲解题目', studentIds: [students[0].id], studentNames: [students[0].name], createdAt: timestamp - 7200000, updatedAt: timestamp - 7200000 },
        { id: 'experience-note-2', classId: classId, type: 'class_note', category: '活动', body: '全班完成了课堂小练习', studentIds: [], studentNames: [], createdAt: timestamp - 10800000, updatedAt: timestamp - 10800000 },
      ],
    };
  }

  function writeDemoData(db, force) {
    return new Promise(function (resolve, reject) {
      var check = db.transaction('meta', 'readonly').objectStore('meta').get('experience-seeded-v2');
      check.onsuccess = function () {
        if (check.result && !force) {
          db.close();
          resolve();
          return;
        }
        var records = demoRecords();
        var tx = db.transaction(STORES, 'readwrite');
        if (force || !check.result) STORES.forEach(function (name) { tx.objectStore(name).clear(); });
        STORES.forEach(function (name) {
          (records[name] || []).forEach(function (record) { tx.objectStore(name).put(record); });
        });
        tx.oncomplete = function () { db.close(); resolve(); };
        tx.onerror = function () { db.close(); reject(tx.error); };
      };
      check.onerror = function () { db.close(); reject(check.error); };
    });
  }

  function seedExperience(force) {
    if (mode !== 'experience') return Promise.resolve();
    return openDatabase(EXPERIENCE_DATABASE).then(function (db) { return writeDemoData(db, Boolean(force)); });
  }

  function scopedDatabaseName(userId) {
    return LEGACY_DATABASE + '-user-' + String(userId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  }

  function getRecord(db, storeName, id) {
    return new Promise(function (resolve, reject) {
      var request = db.transaction(storeName, 'readonly').objectStore(storeName).get(id);
      request.onsuccess = function () { resolve(request.result || null); };
      request.onerror = function () { reject(request.error); };
    });
  }

  function getAllRecords(db, storeName) {
    return new Promise(function (resolve, reject) {
      var request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
      request.onsuccess = function () { resolve(request.result || []); };
      request.onerror = function () { reject(request.error); };
    });
  }

  function putRecord(db, storeName, record) {
    return new Promise(function (resolve, reject) {
      var request = db.transaction(storeName, 'readwrite').objectStore(storeName).put(record);
      request.onsuccess = function () { resolve(); };
      request.onerror = function () { reject(request.error); };
    });
  }

  function copyLegacyRecords(source, target) {
    return Promise.all(STORES.map(function (storeName) {
      return getAllRecords(source, storeName).then(function (records) {
        return { storeName: storeName, records: records };
      });
    })).then(function (groups) {
      return new Promise(function (resolve, reject) {
        var transaction = target.transaction(STORES, 'readwrite');
        groups.forEach(function (group) {
          var store = transaction.objectStore(group.storeName);
          group.records.forEach(function (record) { store.put(record); });
        });
        transaction.objectStore('meta').put({ id: 'legacy-account-migration-v1', value: true });
        transaction.oncomplete = function () { resolve(); };
        transaction.onerror = function () { reject(transaction.error); };
        transaction.onabort = function () { reject(transaction.error || new Error('旧数据迁移已取消')); };
      });
    });
  }

  function migrateLegacyDatabase(userId) {
    var scopedName = scopedDatabaseName(userId);
    return Promise.all([openDatabase(LEGACY_DATABASE), openDatabase(scopedName)]).then(function (databases) {
      var legacy = databases[0];
      var target = databases[1];
      return Promise.all([
        getRecord(legacy, 'meta', 'scoped-migration-owner-v1'),
        getRecord(target, 'meta', 'legacy-account-migration-v1'),
        getAllRecords(target, 'classes'),
      ]).then(function (values) {
        var owner = values[0];
        var migrated = values[1];
        var targetClasses = values[2];
        if (owner && owner.value !== userId) return;
        var claim = owner ? Promise.resolve() : putRecord(legacy, 'meta', { id: 'scoped-migration-owner-v1', value: userId });
        return claim.then(function () {
          if (migrated || targetClasses.length) return;
          return copyLegacyRecords(legacy, target);
        });
      }).finally(function () {
        legacy.close();
        target.close();
      });
    });
  }

  function introUrl() {
    return location.pathname.indexOf('/v07/') >= 0 ? '../index.html#plans' : 'index.html#plans';
  }

  function accountUrl() {
    return location.pathname.indexOf('/v07/') >= 0 ? '../account.html?tab=register' : 'account.html?tab=register';
  }

  function ensureDialog() {
    var existing = document.getElementById('workspaceAccessDialog');
    if (existing) return existing;
    var backdrop = document.createElement('div');
    backdrop.id = 'workspaceAccessDialog';
    backdrop.className = 'workspace-access-backdrop';
    backdrop.hidden = true;
    backdrop.innerHTML = '<section class="workspace-access-dialog" role="dialog" aria-modal="true" aria-labelledby="workspaceAccessTitle">' +
      '<button type="button" class="workspace-access-close" aria-label="关闭">×</button>' +
      '<span class="workspace-access-icon">钥</span>' +
      '<p>体验版功能提示</p><h2 id="workspaceAccessTitle">此功能获得授权后开放</h2>' +
      '<div class="workspace-access-copy">体验版使用12名虚拟学生，供你完整了解主要操作。导入真实班级、更多记录以及备份恢复需要获得授权。</div>' +
      '<div class="workspace-access-actions"><button type="button" class="workspace-access-later">继续体验</button><a href="' + accountUrl() + '">使用授权码注册</a></div>' +
      '<a class="workspace-access-compare" href="' + introUrl() + '">查看体验版与授权版区别</a>' +
      '</section>';
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', function (event) {
      if (event.target === backdrop || event.target.closest('.workspace-access-close,.workspace-access-later')) backdrop.hidden = true;
    });
    return backdrop;
  }

  function showLocked(feature) {
    var dialog = ensureDialog();
    var title = dialog.querySelector('h2');
    title.textContent = featureLabels[feature] ? featureLabels[feature] + '需获得授权' : '此功能获得授权后开放';
    dialog.hidden = false;
    dialog.querySelector('.workspace-access-close').focus();
  }

  function can(feature) {
    if (authorized) return true;
    return ['today', 'seatEditing', 'classroomMarking', 'homeworkDemo', 'learningDemo', 'studentProfile', 'reviewDemo'].indexOf(feature) >= 0;
  }

  function requireFeature(feature) {
    if (can(feature)) return true;
    showLocked(feature);
    return false;
  }

  function injectStyles() {
    var style = document.createElement('style');
    style.textContent = '.workspace-access-badge{height:28px;padding:0 10px;border:1px solid #ebc984;border-radius:999px;background:#fff8e8;color:#a36a0c;font:600 12px/26px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;cursor:pointer;white-space:nowrap}' +
      '.workspace-access-badge.authorized{border-color:#b9ddc7;background:#edf8f1;color:#177f48}' +
      '.workspace-access-backdrop{position:fixed;z-index:1000;inset:0;padding:20px;display:grid;place-items:center;background:rgba(26,31,28,.5);backdrop-filter:blur(4px)}' +
      '.workspace-access-backdrop[hidden]{display:none}.workspace-access-dialog{position:relative;width:min(520px,100%);padding:38px;border-radius:22px;background:#fff;box-shadow:0 28px 80px rgba(25,34,29,.28);text-align:center;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}' +
      '.workspace-access-close{position:absolute;top:16px;right:16px;width:38px;height:38px;border:1px solid #e9e5dc;border-radius:10px;background:#fff;color:#69736d;font-size:25px;cursor:pointer}' +
      '.workspace-access-icon{width:60px;height:60px;margin:0 auto 14px;border-radius:18px;display:grid;place-items:center;background:#fff3d9;color:#b87610;font:700 23px/1 "Songti SC",serif}' +
      '.workspace-access-dialog>p{margin:0 0 6px;color:#b87610;font-size:12px;font-weight:700;letter-spacing:.12em}.workspace-access-dialog h2{margin:0;font-size:25px}.workspace-access-copy{margin:14px auto 22px;color:#69736d;line-height:1.8}' +
      '.workspace-access-actions{display:flex;justify-content:center;gap:10px}.workspace-access-actions button,.workspace-access-actions a{min-height:42px;padding:0 17px;border:1px solid #e5e1d8;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;background:#fff;color:#56605a;font-weight:600;text-decoration:none;cursor:pointer}.workspace-access-actions a{border-color:#1e9455;background:#1e9455;color:#fff}' +
      '.workspace-access-compare{display:inline-block;margin-top:15px;color:#78827c;font-size:12px;text-decoration:underline;text-underline-offset:3px}' +
      '.workspace-access-lock-note{display:inline-flex;align-items:center;margin-left:8px;padding:2px 7px;border-radius:999px;background:#fff3d9;color:#a76b0f;font-size:10px;font-weight:600;vertical-align:middle}' +
      '@media(max-width:720px){.workspace-access-badge{display:none}.workspace-access-dialog{padding:34px 22px}.workspace-access-actions{flex-direction:column}}';
    document.head.appendChild(style);
  }

  function markLockedAreas() {
    if (authorized) return;
    [
      ['#studentImportSection .card-title h2', '授权版导入真实学生'],
      ['#studentImportSection + .data-card .card-title h2', '授权版导入完整清单'],
      ['#workspaceBackupPane .ph h2', '授权版开放备份恢复'],
    ].forEach(function (item) {
      var title = document.querySelector(item[0]);
      if (!title || title.querySelector('.workspace-access-lock-note')) return;
      var note = document.createElement('span');
      note.className = 'workspace-access-lock-note';
      note.textContent = item[1];
      title.appendChild(note);
    });
    var clearButton = document.getElementById('clearAll');
    if (clearButton) clearButton.textContent = '重置体验数据';
  }

  function mountStatus() {
    injectStyles();
    var header = document.querySelector('.top,.topbar');
    if (header) {
      var title = header.querySelector('.title,.shell-title,h1');
      var badge = document.createElement('button');
      badge.type = 'button';
      badge.className = 'workspace-access-badge' + (authorized ? ' authorized' : '');
      badge.textContent = authorized ? '已授权' : mode === 'experience' ? '体验版' : mode === 'expired' ? '授权待续费' : '连接异常';
      badge.addEventListener('click', function () {
        if (authorized) {
          location.href = location.pathname.indexOf('/v07/') >= 0 ? '../account.html' : 'account.html';
          return;
        }
        showLocked('');
      });
      if (title && title.nextSibling) header.insertBefore(badge, title.nextSibling);
      else header.prepend(badge);
    }
    markLockedAreas();
    showBlockingState();
  }

  function showBlockingState() {
    var existing = document.getElementById('workspaceBlockingState');
    if (mode !== 'expired' && mode !== 'unavailable') {
      if (existing) existing.remove();
      return;
    }
    if (!existing) {
      existing = document.createElement('div');
      existing.id = 'workspaceBlockingState';
      existing.className = 'workspace-access-backdrop workspace-blocking-state';
      document.body.appendChild(existing);
    }
    var unavailable = mode === 'unavailable';
    existing.innerHTML = '<section class="workspace-access-dialog" role="alertdialog" aria-modal="true">' +
      '<span class="workspace-access-icon">' + (unavailable ? '连' : '钥') + '</span>' +
      '<p>' + (unavailable ? '授权服务连接异常' : '账号授权已失效') + '</p>' +
      '<h2>' + (unavailable ? '暂时无法核验使用资格' : '续费后可继续使用原数据') + '</h2>' +
      '<div class="workspace-access-copy">' + (unavailable
        ? '你的班级、学生、作业和学情数据仍保存在这台电脑中，没有丢失。请检查网络后重试；为避免误操作，连接恢复前不会切换到体验数据。'
        : '你的本机教学数据不会被删除。请前往账号页输入新授权码，续费后会重新打开原来的班级数据。') + '</div>' +
      '<div class="workspace-access-actions">' +
      (unavailable ? '<button type="button" id="workspaceRetryConnection">重新连接</button>' : '<a href="' + accountUrl().replace('?tab=register', '') + '">前往续费</a>') +
      '</div></section>';
    var retry = existing.querySelector('#workspaceRetryConnection');
    if (retry) retry.addEventListener('click', function () { location.reload(); });
  }

  document.addEventListener('click', function (event) {
    if (authorized) return;
    var target = event.target.closest('a[href*="onboarding=students"],#importStudents,#studentExcelFile,#importKps,#kpFile,#applyBnupTemplate,#exportBackup,#exportQuick,#exportWorkspaceBackup,#workspaceRestoreFile,#exportHomeworkRecord,[onclick*="window.print"]');
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    var feature = target.matches('a[href*="onboarding=students"],#importStudents,#studentExcelFile') ? 'studentImport'
      : target.matches('#importKps,#kpFile,#applyBnupTemplate') ? 'knowledgeImport'
        : 'exportBackup';
    showLocked(feature);
  }, true);

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      var dialog = document.getElementById('workspaceAccessDialog');
      if (dialog && !dialog.hidden) dialog.hidden = true;
    }
  });

  var accessControl = {
    mode: mode,
    isExperience: mode === 'experience',
    isAuthorized: authorized,
    isLocalPreview: false,
    databaseName: databaseName,
    limits: limits,
    session: accountSession,
    ready: Promise.resolve(),
    can: can,
    requireFeature: requireFeature,
    showLocked: showLocked,
    resetExperience: function () { return seedExperience(true); },
  };
  window.TeacherWorkspaceAccess = accessControl;

  function applyAuthorizationState(result) {
    mode = result.mode;
    authorized = mode === 'authorized';
    accountSession = result.session || null;
    databaseName = authorized && accountSession && accountSession.user
      ? scopedDatabaseName(accountSession.user.id)
      : mode === 'experience' ? EXPERIENCE_DATABASE : BLOCKED_DATABASE;
    accessControl.mode = mode;
    accessControl.isExperience = mode === 'experience';
    accessControl.isAuthorized = authorized;
    accessControl.databaseName = databaseName;
    accessControl.session = accountSession;
    try {
      if (accountSession && accountSession.authenticated && accountSession.user && accountSession.user.displayName) {
        var displayName = String(accountSession.user.displayName).trim();
        if (displayName) {
          localStorage.setItem('sjhk-workspace-display-name', displayName);
          localStorage.setItem('sjhk-workspace-display-name:' + accountSession.user.id, displayName);
        }
      }
    } catch (error) {
      console.warn('教师称呼缓存失败', error);
    }
  }

  function workspaceSessionUrl() {
    var local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    return (local ? '' : 'https://api.shangjiehaoke.com') + '/api/workspace/auth/session';
  }

  function resolveAuthorization() {
    if (forceExperience) return Promise.resolve({ mode: 'experience', session: null });
    return fetch(workspaceSessionUrl(), { credentials: 'include', headers: { Accept: 'application/json' } })
      .then(function (response) {
        if (!response.ok) throw new Error('授权服务暂时不可用');
        return response.json();
      })
      .then(function (session) {
        if (!session.authenticated) return { mode: 'experience', session: session };
        if (session.authorized && !session.user.mustChangePassword) return { mode: 'authorized', session: session };
        return { mode: 'expired', session: session };
      });
  }

  var ready = resolveAuthorization()
    .then(function (result) {
      applyAuthorizationState(result);
      if (mode === 'authorized') return migrateLegacyDatabase(result.session.user.id);
      if (mode === 'experience') return seedExperience(false);
      return undefined;
    })
    .catch(function (error) {
      console.error('授权服务连接失败', error);
      applyAuthorizationState({ mode: 'unavailable', session: null });
    });
  accessControl.ready = ready;
  accessControl.refreshSession = function () {
    accessControl.ready = resolveAuthorization().then(function (result) {
      var previousMode = mode;
      applyAuthorizationState(result);
      if (previousMode !== mode) {
        if (previousMode === 'authorized' && mode !== 'authorized') showBlockingState();
        else location.reload();
      }
      if (mode === 'authorized') return migrateLegacyDatabase(result.session.user.id);
      if (mode === 'experience') return seedExperience(false);
      return undefined;
    }).catch(function () {
      var previousMode = mode;
      applyAuthorizationState({ mode: 'unavailable', session: accountSession });
      if (previousMode === 'authorized') showBlockingState();
      else if (document.readyState !== 'loading') showBlockingState();
    });
    return accessControl.ready;
  };

  ready.then(function () {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountStatus, { once: true });
    else mountStatus();
  });

  setInterval(function () { accessControl.refreshSession(); }, 2 * 60 * 1000);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') accessControl.refreshSession();
  });
})();
