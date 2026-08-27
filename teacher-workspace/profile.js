import { workspaceApi as api } from './api-client.js';
import {
  encryptedSyncManager,
  formatRecoveryCode,
  validateRecoveryCode,
} from './encrypted-sync.js';

const guestCard = document.getElementById('guestCard');
const profileContent = document.getElementById('profileContent');
const form = document.getElementById('profileForm');
const input = document.getElementById('displayNameInput');
const toast = document.getElementById('profileToast');
const onboardingCard = document.getElementById('onboardingCard');
let currentSession = null;
const syncManager = encryptedSyncManager();
const syncStatus = document.getElementById('syncStatus');
const syncDeviceState = document.getElementById('syncDeviceState');
const syncCloudState = document.getElementById('syncCloudState');
const syncLastTime = document.getElementById('syncLastTime');
const syncMessage = document.getElementById('syncMessage');
const syncConflict = document.getElementById('syncConflict');
const enableCloudSync = document.getElementById('enableCloudSync');
const enterRecoveryCode = document.getElementById('enterRecoveryCode');
const syncNowButton = document.getElementById('syncNow');
const showRecoveryCode = document.getElementById('showRecoveryCode');
const rotateRecoveryCode = document.getElementById('rotateRecoveryCode');
const syncDialog = document.getElementById('syncDialog');
const recoveryInputWrap = document.getElementById('recoveryInputWrap');
const recoveryCodeInput = document.getElementById('recoveryCodeInput');
const recoveryOutput = document.getElementById('recoveryOutput');
const recoveryCodeOutput = document.getElementById('recoveryCodeOutput');
const recoveryConfirmWrap = document.getElementById('recoveryConfirmWrap');
const recoverySavedConfirm = document.getElementById('recoverySavedConfirm');
const syncDialogSummary = document.getElementById('syncDialogSummary');
const syncDialogPrimary = document.getElementById('syncDialogPrimary');
let syncDialogMode = '';
let generatedRecoveryCode = '';

const planLabels = { authorized: '旧版会员', yearly: '一年会员', permanent: '长期会员', admin: '管理员' };

function notify(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => toast.classList.remove('show'), 2400);
}

function teacherName(session, draft = null) {
  const value = (draft === null ? session?.user?.displayName : draft)?.trim();
  if (value) return value;
  const username = session?.user?.username || '';
  if (!username) return '老师';
  return username.endsWith('老师') ? username : `${username}老师`;
}

function formatDate(value, fallback = '—') {
  if (!value) return fallback;
  return new Date(value).toLocaleString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatSyncTime(value) {
  if (!value) return '尚未同步';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '尚未同步';
  return date.toLocaleString('zh-CN', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function setSyncButtonBusy(button, busy, text) {
  if (!button) return;
  if (!button.dataset.label) button.dataset.label = button.textContent;
  button.disabled = busy;
  button.textContent = busy ? text : button.dataset.label;
}

function setSyncStatus(label, tone = '') {
  syncStatus.textContent = label;
  syncStatus.className = `sync-status ${tone}`.trim();
}

function renderSyncStatus(status) {
  const local = status.localState || {};
  const conflict = local.status === 'conflict';
  const recoveryIssue = local.status === 'error' && /恢复码|解密/.test(local.error || '');
  syncConflict.hidden = !conflict;
  enableCloudSync.hidden = status.enabled;
  enterRecoveryCode.hidden = !status.enabled || (status.deviceReady && !recoveryIssue);
  enterRecoveryCode.textContent = status.deviceReady ? '更新恢复码' : '输入恢复码';
  syncNowButton.hidden = !status.enabled || !status.deviceReady;
  showRecoveryCode.hidden = !status.enabled || !status.deviceReady;
  rotateRecoveryCode.hidden = !status.enabled || !status.deviceReady;
  syncCloudState.textContent = status.enabled ? `已有加密数据 · 版本 ${status.revision}` : '尚未开启';
  syncDeviceState.textContent = status.deviceReady ? '已保存解密钥匙' : status.enabled ? '需要输入恢复码' : '尚未生成恢复码';
  syncLastTime.textContent = formatSyncTime(local.lastSyncAt || status.updatedAt);
  if (conflict) {
    setSyncStatus('需要选择', 'warning');
    syncMessage.textContent = '系统检测到两台设备分别修改了数据，没有自动覆盖任何一边。';
  } else if (!status.enabled) {
    setSyncStatus('尚未开启');
    syncMessage.textContent = '开启后会生成长期有效的恢复码，并把当前本机数据加密上传。';
  } else if (!status.deviceReady) {
    setSyncStatus('需要恢复码', 'warning');
    syncMessage.textContent = '这是这台设备第一次使用云同步。输入一次原恢复码，即可恢复数据并自动同步。';
  } else if (local.status === 'error') {
    setSyncStatus('同步异常', 'error');
    syncMessage.textContent = local.error || '同步暂时失败，本机数据不受影响。';
  } else {
    setSyncStatus('已加密同步', 'ready');
    syncMessage.textContent = '这台设备已经获得解密授权。之后联网时会自动上传和接收加密数据。';
  }
}

async function refreshSyncStatus() {
  if (!currentSession?.authenticated || !currentSession.authorized) return;
  try {
    renderSyncStatus(await syncManager.status());
  } catch (error) {
    setSyncStatus('暂时不可用', 'error');
    syncDeviceState.textContent = '无法检查';
    syncCloudState.textContent = '无法连接';
    syncMessage.textContent = error.message || '加密云同步服务暂时无法连接，本机数据不受影响。';
  }
}

function resetSyncDialog() {
  generatedRecoveryCode = '';
  recoveryCodeInput.value = '';
  recoveryInputWrap.hidden = true;
  recoveryOutput.hidden = true;
  recoveryConfirmWrap.hidden = true;
  recoverySavedConfirm.checked = false;
  syncDialogSummary.hidden = true;
  syncDialogSummary.textContent = '';
  syncDialogPrimary.disabled = false;
  delete syncDialogPrimary.dataset.label;
}

function openSyncDialog(mode) {
  resetSyncDialog();
  syncDialogMode = mode;
  const title = document.getElementById('syncDialogTitle');
  const copy = document.getElementById('syncDialogCopy');
  const kicker = document.getElementById('syncDialogKicker');
  if (mode === 'enable') {
    kicker.textContent = '首次开启';
    title.textContent = '生成恢复码并开启同步';
    copy.textContent = '系统会用新恢复码加密当前电脑里的全部班级数据。恢复码不会上传，请务必自行保存。';
    syncDialogPrimary.textContent = '生成并开启';
  } else if (mode === 'restore') {
    kicker.textContent = '新设备恢复';
    title.textContent = '输入原来的恢复码';
    copy.textContent = '解密成功后，云端数据会恢复到这台电脑，并在以后自动同步。当前本机班级数据会被云端版本替换。';
    recoveryInputWrap.hidden = false;
    syncDialogPrimary.textContent = '恢复并开始同步';
    setTimeout(() => recoveryCodeInput.focus(), 80);
  } else if (mode === 'show') {
    kicker.textContent = '请妥善保管';
    title.textContent = '当前账号的恢复码';
    copy.textContent = '它可以在新电脑上解密你的云端数据，请不要发送给无关人员。';
    recoveryOutput.hidden = false;
    syncDialogPrimary.textContent = '完成';
    syncManager.getRecoveryCode().then((code) => {
      generatedRecoveryCode = code;
      recoveryCodeOutput.textContent = code;
    });
  } else if (mode === 'rotate') {
    kicker.textContent = '安全操作';
    title.textContent = '更换恢复码';
    copy.textContent = '云端数据会立即改用新恢复码加密。其他电脑下次同步时，需要输入新的恢复码。';
    syncDialogPrimary.textContent = '确认更换';
  }
  syncDialog.showModal();
}

function showGeneratedCode(result, title = '恢复码已经生成') {
  syncDialogMode = 'generated';
  generatedRecoveryCode = result.recoveryCode;
  document.getElementById('syncDialogKicker').textContent = '只显示给你';
  document.getElementById('syncDialogTitle').textContent = title;
  document.getElementById('syncDialogCopy').textContent = '请复制到密码管理器、私人笔记或打印保存。平台无法替你找回这组恢复码。';
  recoveryInputWrap.hidden = true;
  recoveryOutput.hidden = false;
  recoveryCodeOutput.textContent = result.recoveryCode;
  recoveryConfirmWrap.hidden = false;
  syncDialogSummary.hidden = false;
  syncDialogSummary.textContent = `已加密：${result.summary.classes} 个班级、${result.summary.students} 名学生、${result.summary.homeworks} 次作业和 ${result.summary.judgements} 条学情判断。`;
  syncDialogPrimary.textContent = '我已保存，完成';
  syncDialogPrimary.disabled = true;
}

async function handleSyncDialogPrimary() {
  if (syncDialogMode === 'show') {
    syncDialog.close();
    return;
  }
  if (syncDialogMode === 'generated') {
    if (!recoverySavedConfirm.checked) return;
    syncDialog.close();
    await refreshSyncStatus();
    return;
  }
  setSyncButtonBusy(syncDialogPrimary, true, syncDialogMode === 'restore' ? '正在解密…' : '正在加密…');
  try {
    if (syncDialogMode === 'enable') {
      showGeneratedCode(await syncManager.enable());
    } else if (syncDialogMode === 'restore') {
      if (!validateRecoveryCode(recoveryCodeInput.value)) throw new Error('请输入完整的32位恢复码。');
      const result = await syncManager.restore(recoveryCodeInput.value);
      syncDialogMode = 'restored';
      recoveryInputWrap.hidden = true;
      document.getElementById('syncDialogTitle').textContent = '数据已经安全恢复';
      document.getElementById('syncDialogCopy').textContent = '这台电脑以后会自动加密同步，不需要再次输入恢复码。';
      syncDialogSummary.hidden = false;
      syncDialogSummary.textContent = `已恢复：${result.summary.classes} 个班级、${result.summary.students} 名学生、${result.summary.homeworks} 次作业和 ${result.summary.judgements} 条学情判断。`;
      syncDialogPrimary.dataset.label = '完成并刷新';
      syncDialogPrimary.textContent = '完成并刷新';
      syncDialogPrimary.disabled = false;
    } else if (syncDialogMode === 'restored') {
      location.reload();
    } else if (syncDialogMode === 'rotate') {
      showGeneratedCode(await syncManager.rotateRecoveryCode(), '新的恢复码已经生效');
    }
  } catch (error) {
    notify(error.message || '操作没有完成。');
    syncDialogPrimary.disabled = false;
  } finally {
    if (!['generated', 'restored'].includes(syncDialogMode)) {
      setSyncButtonBusy(syncDialogPrimary, false, '');
    }
  }
}

function updatePreview(value = input.value) {
  const hour = new Date().getHours();
  const greeting = hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
  document.getElementById('greetingPreview').textContent = `${greeting}，${teacherName(currentSession, value)}`;
}

function cacheTeacherName(session) {
  if (!session?.authenticated) return;
  const name = teacherName(session);
  localStorage.setItem('sjhk-workspace-display-name', name);
  localStorage.setItem(`sjhk-workspace-display-name:${session.user.id}`, name);
}

function dbAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function setOnboardingStep(name, complete, locked = false) {
  const step = onboardingCard.querySelector(`[data-onboarding-step="${name}"]`);
  step.classList.toggle('complete', complete);
  step.classList.toggle('locked', locked && !complete);
  step.querySelector('i').textContent = complete ? '✓' : ({ class: '1', seats: '2', kps: '3' })[name];
  step.querySelector('a').textContent = complete ? '已完成' : ({ class: '开始设置', seats: '编辑座位', kps: '导入知识点' })[name];
}

async function renderOnboarding() {
  await window.TeacherWorkspaceAccess?.ready;
  if (!window.TeacherWorkspaceAccess?.isAuthorized) {
    onboardingCard.hidden = true;
    return;
  }
  const context = await window.TeacherClassManager?.getContext();
  if (!context?.db) return;
  const activeClass = context.classes.find((item) => item.id === context.activeClassId && item.status !== 'archived');
  const [students, kps, meta] = await Promise.all([
    dbAll(context.db, 'students'), dbAll(context.db, 'kps'), dbAll(context.db, 'meta'),
  ]);
  const scopedStudents = students.filter((item) => Boolean(context.activeClassId) && (item.classId || 'class-local') === context.activeClassId);
  const scopedKps = kps.filter((item) => Boolean(context.activeClassId) && (item.classId || 'class-local') === context.activeClassId && !item.archivedAt);
  const assignments = meta.find((item) => item.id === `seat-assignments:${context.activeClassId}`)?.value || {};
  const assigned = new Set(Object.values(assignments));
  const classComplete = Boolean(activeClass && scopedStudents.length);
  const seatsComplete = classComplete && scopedStudents.every((student) => assigned.has(student.id));
  const kpsComplete = classComplete && scopedKps.length > 0;
  const completed = [classComplete, seatsComplete, kpsComplete].filter(Boolean).length;
  onboardingCard.hidden = completed === 3;
  document.getElementById('onboardingProgress').textContent = `${completed}/3`;
  setOnboardingStep('class', classComplete);
  setOnboardingStep('seats', seatsComplete, !classComplete);
  setOnboardingStep('kps', kpsComplete, !classComplete);
}

function render(session) {
  currentSession = session;
  const authenticated = Boolean(session?.authenticated);
  guestCard.hidden = authenticated;
  profileContent.hidden = !authenticated;
  if (!authenticated) return;
  cacheTeacherName(session);
  const name = teacherName(session);
  document.getElementById('profileAvatar').textContent = name.slice(0, 1).toUpperCase();
  document.getElementById('profileDisplayHeading').textContent = name;
  document.getElementById('profileUsername').textContent = `登录账号：${session.user.username}`;
  document.getElementById('profilePlan').textContent = planLabels[session.plan] || '会员账号';
  document.getElementById('profileStatus').textContent = session.user.mustChangePassword ? '需要修改密码' : session.authorized || session.user.role === 'admin' ? '使用中' : '需要续费';
  document.getElementById('profileExpiry').textContent = session.expiresAt ? formatDate(session.expiresAt) : '长期有效';
  document.getElementById('profileLastLogin').textContent = formatDate(session.user.lastLoginAt, '首次使用');
  input.value = session.user.displayName || '';
  updatePreview();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = '正在保存…';
  try {
    const result = await api('/auth/profile', { method: 'POST', body: JSON.stringify({ displayName: input.value }) });
    render(result);
    await window.TeacherWorkspaceAccess?.refreshSession?.();
    notify(result.message || '个人信息已保存。');
  } catch (error) {
    notify(error.message);
  } finally {
    button.disabled = false;
    button.textContent = '保存个人信息';
  }
});

input.addEventListener('input', () => updatePreview());
enableCloudSync.addEventListener('click', () => openSyncDialog('enable'));
enterRecoveryCode.addEventListener('click', () => openSyncDialog('restore'));
showRecoveryCode.addEventListener('click', () => openSyncDialog('show'));
rotateRecoveryCode.addEventListener('click', () => openSyncDialog('rotate'));
syncDialogPrimary.addEventListener('click', () => handleSyncDialogPrimary());
recoverySavedConfirm.addEventListener('change', () => {
  if (syncDialogMode === 'generated') syncDialogPrimary.disabled = !recoverySavedConfirm.checked;
});
recoveryCodeInput.addEventListener('input', () => {
  recoveryCodeInput.value = formatRecoveryCode(recoveryCodeInput.value).slice(0, 39);
});
document.getElementById('copyRecoveryCode').addEventListener('click', async () => {
  if (!generatedRecoveryCode) return;
  try {
    await navigator.clipboard.writeText(generatedRecoveryCode);
    notify('恢复码已复制，请妥善保存。');
  } catch {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(recoveryCodeOutput);
    selection.removeAllRanges();
    selection.addRange(range);
    notify('浏览器未允许自动复制，请手动复制。');
  }
});
syncNowButton.addEventListener('click', async () => {
  setSyncButtonBusy(syncNowButton, true, '正在同步…');
  try {
    const result = await syncManager.syncNow();
    notify(result?.conflict ? '检测到同步冲突，请选择保留版本。' : '同步已完成。');
    await refreshSyncStatus();
  } catch (error) {
    notify(error.message || '同步暂时失败。');
    await refreshSyncStatus();
  } finally {
    setSyncButtonBusy(syncNowButton, false, '');
  }
});
document.getElementById('keepCloudVersion').addEventListener('click', async () => {
  if (!confirm('确定用云端版本覆盖这台电脑的班级数据吗？')) return;
  try {
    await syncManager.useCloudVersion();
    location.reload();
  } catch (error) {
    notify(error.message || '云端版本恢复失败。');
  }
});
document.getElementById('keepLocalVersion').addEventListener('click', async () => {
  if (!confirm('确定用这台电脑的数据覆盖云端版本吗？其他电脑下次会收到这个版本。')) return;
  try {
    await syncManager.upload({ force: true });
    notify('已保留本机版本并更新云端。');
    await refreshSyncStatus();
  } catch (error) {
    notify(error.message || '本机版本上传失败。');
  }
});
window.addEventListener('teacher-workspace-sync-state', () => {
  refreshSyncStatus().catch(() => undefined);
});
document.getElementById('profileLogout').addEventListener('click', async () => {
  await api('/auth/logout', { method: 'POST', body: '{}' }).catch(() => null);
  location.href = './account.html';
});

api('/auth/session').then((session) => {
  render(session);
  refreshSyncStatus();
  renderOnboarding().catch((error) => {
    console.error(error);
    notify('首次使用向导暂时无法读取，请刷新后重试。');
  });
}).catch(() => {
  guestCard.hidden = false;
  profileContent.hidden = true;
  notify('暂时无法连接账号服务，请稍后重试。');
});
