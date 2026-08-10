import { workspaceApi as api } from './api-client.js';

const guestCard = document.getElementById('guestCard');
const profileContent = document.getElementById('profileContent');
const form = document.getElementById('profileForm');
const input = document.getElementById('displayNameInput');
const toast = document.getElementById('profileToast');
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

function render(session) {
  currentSession = session;
  const authenticated = Boolean(session?.authenticated);
  guestCard.hidden = authenticated;
  profileContent.hidden = !authenticated;
  if (!authenticated) return;
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

api('/auth/session').then(render).catch(() => {
  guestCard.hidden = false;
  profileContent.hidden = true;
  notify('暂时无法连接账号服务，请稍后重试。');
});
