import { workspaceApi as api } from './api-client.js';

const adminLogin = document.getElementById('adminLogin');
const adminShell = document.getElementById('adminShell');
const toast = document.getElementById('toast');
let usersCache = [];
let resetPasswordUserId = '';

function notify(message) {
  toast.textContent = message; toast.classList.add('show');
  clearTimeout(notify.timer); notify.timer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function formatDate(value, fallback = '—') {
  if (!value) return fallback;
  return new Date(value).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const statusLabels = { available: '待使用', redeemed: '已兑换', revoked: '已停用', expired: '已过期', active: '正常', disabled: '已停用' };
const planLabels = { authorized: '旧版授权', yearly: '一年会员', permanent: '长期会员', admin: '管理员' };
const eventLabels = { 'license.created': '生成了授权码', 'license.redeemed': '授权码已被兑换', 'license.revoked': '停用了授权码', 'user.registered': '新账号完成注册', 'user.logged_in': '账号登录', 'user.logged_out': '账号退出', 'user.profile_updated': '更新了个人信息', 'user.active': '恢复了账号', 'user.disabled': '停用了账号', 'session.created': '创建了登录会话' };

function statusPill(status) { return `<span class="status-pill ${status}">${statusLabels[status] || status || '—'}</span>`; }

async function loadOverview() {
  const data = await api('/admin/overview');
  document.getElementById('statUsers').textContent = data.stats.users;
  document.getElementById('statActiveUsers').textContent = data.stats.activeUsers;
  document.getElementById('statAvailable').textContent = data.stats.availableLicenses;
  document.getElementById('statRedeemed').textContent = data.stats.redeemedLicenses;
  document.getElementById('eventList').innerHTML = data.events.length ? data.events.map((event) => `<li><i></i><div><strong>${eventLabels[event.event_type] || event.event_type}</strong><span>${event.actor_username || '系统'} · ${formatDate(event.created_at)}</span></div></li>`).join('') : '<li><i></i><div><strong>还没有操作记录</strong><span>生成第一枚授权码后会显示在这里。</span></div></li>';
}

async function loadLicenses() {
  const status = document.getElementById('licenseStatus').value;
  const data = await api(`/admin/licenses?status=${encodeURIComponent(status)}`);
  document.getElementById('licenseRows').innerHTML = data.licenses.length ? data.licenses.map((license) => `<tr>
    <td><strong>${license.prefix}••••</strong></td><td>${planLabels[license.plan] || license.plan}</td><td>${statusPill(license.status)}</td>
    <td>${license.redeemerUsername || '—'}</td><td>${formatDate(license.createdAt)}</td><td>${formatDate(license.redeemBefore, '不限期')}</td><td>${license.status === 'redeemed' ? formatDate(license.expiresAt, '长期有效') : '兑换后起算'}</td>
    <td>${['available', 'redeemed'].includes(license.status) ? `<button class="table-action danger" data-revoke="${license.id}">停用</button>` : '—'}</td></tr>`).join('') : '<tr><td colspan="8" class="empty-state">当前没有授权码记录</td></tr>';
}

function renderUsers() {
  const keyword = document.getElementById('userSearch').value.trim().toLowerCase();
  const rows = usersCache.filter((user) => user.username.toLowerCase().includes(keyword));
  document.getElementById('userRows').innerHTML = rows.length ? rows.map((user) => `<tr>
    <td><strong>${user.username}</strong></td><td>${user.role === 'admin' ? '管理员' : '用户'}</td><td>${statusPill(user.status)}</td>
    <td>${user.role === 'admin' ? statusPill('active') : statusPill(user.licenseStatus || 'revoked')}</td><td>${formatDate(user.createdAt)}</td><td>${formatDate(user.lastLoginAt)}</td>
    <td>${user.role === 'admin' ? '—' : `<div class="row-actions"><button class="table-action" data-reset-password="${user.id}">重置密码</button><button class="table-action ${user.status === 'active' ? 'danger' : ''}" data-user-status="${user.id}" data-next-status="${user.status === 'active' ? 'disabled' : 'active'}">${user.status === 'active' ? '停用账号' : '恢复账号'}</button></div>`}</td></tr>`).join('') : '<tr><td colspan="7" class="empty-state">没有找到匹配的账号</td></tr>';
}

async function loadUsers() {
  const data = await api('/admin/users'); usersCache = data.users; renderUsers();
}

async function activateAdmin(session) {
  if (!session.authenticated || session.user.role !== 'admin') { adminLogin.hidden = false; adminShell.hidden = true; return; }
  if (session.user.mustChangePassword) { location.href = './account.html?change=1'; return; }
  adminLogin.hidden = true; adminShell.hidden = false;
  document.getElementById('adminUsername').textContent = session.user.username;
  document.getElementById('adminAvatar').textContent = session.user.username.slice(0, 1).toUpperCase();
  await loadOverview();
}

document.getElementById('adminLoginForm').addEventListener('submit', async (event) => {
  event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button[type="submit"]'); button.disabled = true; document.getElementById('loginMessage').textContent = '';
  try { const session = await api('/auth/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); if (session.user.role !== 'admin') { await api('/auth/logout', { method: 'POST', body: '{}' }).catch(() => null); throw new Error('这个账号没有管理员权限。'); } await activateAdmin(session); }
  catch (error) { document.getElementById('loginMessage').textContent = error.message; }
  finally { button.disabled = false; }
});

document.querySelectorAll('.admin-nav button').forEach((button) => button.addEventListener('click', async () => {
  document.querySelectorAll('.admin-nav button').forEach((item) => item.classList.toggle('active', item === button));
  document.querySelectorAll('.admin-panel').forEach((panel) => { panel.hidden = panel.id !== `panel-${button.dataset.panel}`; });
  const labels = { overview: ['授权总览', '查看授权使用和账号情况。'], licenses: ['授权码管理', '查看、筛选和停用已经生成的授权码。'], users: ['账号管理', '查看注册账号并控制使用状态。'] };
  [document.getElementById('panelTitle').textContent, document.getElementById('panelSubtitle').textContent] = labels[button.dataset.panel];
  try { if (button.dataset.panel === 'licenses') await loadLicenses(); if (button.dataset.panel === 'users') await loadUsers(); if (button.dataset.panel === 'overview') await loadOverview(); } catch (error) { notify(error.message); }
}));

document.getElementById('generateForm').addEventListener('submit', async (event) => {
  event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button[type="submit"]'); button.disabled = true; button.textContent = '正在生成…';
  try { const values = Object.fromEntries(new FormData(form)); const result = await api('/admin/licenses', { method: 'POST', body: JSON.stringify(values) }); const codes = result.codes.map((item) => item.code).join('\n'); document.getElementById('generatedCodes').textContent = codes; document.getElementById('codeResult').hidden = false; notify(result.message); await loadOverview(); }
  catch (error) { notify(error.message); }
  finally { button.disabled = false; button.textContent = '生成授权码'; }
});

document.getElementById('copyCodes').addEventListener('click', async () => {
  const text = document.getElementById('generatedCodes').textContent;
  try {
    await navigator.clipboard.writeText(text);
    notify('授权码已复制。');
  } catch {
    const range = document.createRange();
    range.selectNodeContents(document.getElementById('generatedCodes'));
    const selection = window.getSelection();
    selection.removeAllRanges(); selection.addRange(range);
    notify('浏览器未允许自动复制，已选中授权码，请手动复制。');
  }
});
document.getElementById('licenseStatus').addEventListener('change', () => loadLicenses().catch((error) => notify(error.message)));
document.getElementById('refreshLicenses').addEventListener('click', () => loadLicenses().catch((error) => notify(error.message)));
document.getElementById('refreshUsers').addEventListener('click', () => loadUsers().catch((error) => notify(error.message)));
document.getElementById('userSearch').addEventListener('input', renderUsers);

document.getElementById('licenseRows').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-revoke]'); if (!button) return;
  if (!confirm('确定停用这枚授权码吗？如果已经被兑换，对应账号会立即退出登录；若账号还有其他有效授权，重新登录后仍可继续使用。需要完全停止使用时，请到“账号”中停用账号。')) return;
  try { const result = await api(`/admin/licenses/${button.dataset.revoke}/revoke`, { method: 'POST', body: '{}' }); notify(result.message); await Promise.all([loadLicenses(), loadOverview()]); } catch (error) { notify(error.message); }
});

document.getElementById('userRows').addEventListener('click', async (event) => {
  const resetButton = event.target.closest('[data-reset-password]');
  if (resetButton) {
    resetPasswordUserId = resetButton.dataset.resetPassword;
    const dialog = document.getElementById('resetPasswordDialog');
    document.getElementById('resetPasswordForm').reset();
    dialog.showModal();
    dialog.querySelector('input[name="newPassword"]').focus();
    return;
  }
  const button = event.target.closest('[data-user-status]'); if (!button) return;
  const disabled = button.dataset.nextStatus === 'disabled'; if (!confirm(disabled ? '确定停用这个账号吗？该账号会立即退出登录。' : '确定恢复这个账号吗？')) return;
  try { const result = await api(`/admin/users/${button.dataset.userStatus}/status`, { method: 'POST', body: JSON.stringify({ status: button.dataset.nextStatus }) }); notify(result.message); await Promise.all([loadUsers(), loadOverview()]); } catch (error) { notify(error.message); }
});

document.getElementById('resetPasswordForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  if (values.newPassword !== values.confirmPassword) { notify('两次输入的临时密码不一致。'); return; }
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const result = await api(`/admin/users/${resetPasswordUserId}/password`, {
      method: 'POST', body: JSON.stringify({ newPassword: values.newPassword }),
    });
    document.getElementById('resetPasswordDialog').close();
    notify(result.message);
    await loadUsers();
  } catch (error) { notify(error.message); }
  finally { button.disabled = false; }
});

['cancelResetPassword', 'cancelResetPasswordBottom'].forEach((id) => {
  document.getElementById(id).addEventListener('click', () => document.getElementById('resetPasswordDialog').close());
});

document.getElementById('adminLogout').addEventListener('click', async () => { await api('/auth/logout', { method: 'POST', body: '{}' }).catch(() => null); location.reload(); });

api('/auth/session').then(activateAdmin).catch(() => { adminLogin.hidden = false; adminShell.hidden = true; document.getElementById('loginMessage').textContent = '暂时无法连接授权服务。'; });
