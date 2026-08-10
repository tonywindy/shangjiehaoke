import { workspaceApi as api } from './api-client.js';

const guestCard = document.getElementById('guestCard');
const profileContent = document.getElementById('profileContent');
const form = document.getElementById('profileForm');
const input = document.getElementById('displayNameInput');
const toast = document.getElementById('profileToast');
const onboardingCard = document.getElementById('onboardingCard');
let currentSession = null;

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
document.getElementById('profileLogout').addEventListener('click', async () => {
  await api('/auth/logout', { method: 'POST', body: '{}' }).catch(() => null);
  location.href = './account.html';
});

api('/auth/session').then((session) => {
  render(session);
  renderOnboarding().catch((error) => {
    console.error(error);
    notify('首次使用向导暂时无法读取，请刷新后重试。');
  });
}).catch(() => {
  guestCard.hidden = false;
  profileContent.hidden = true;
  notify('暂时无法连接账号服务，请稍后重试。');
});
