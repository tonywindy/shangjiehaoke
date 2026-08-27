import { workspaceApi as api } from './api-client.js';

const signedOutView = document.getElementById('signedOutView');
const signedInView = document.getElementById('signedInView');
const alertBox = document.getElementById('authAlert');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

function showAlert(message, type = 'error') {
  alertBox.textContent = message;
  alertBox.className = `form-alert ${type}`;
  alertBox.hidden = !message;
}

function setTab(tab) {
  const register = tab === 'register';
  document.querySelectorAll('.auth-tab').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab));
  loginForm.hidden = register;
  registerForm.hidden = !register;
  showAlert('');
  history.replaceState(null, '', `${location.pathname}${register ? '?tab=register' : ''}`);
}

function setSubmitting(form, submitting, text) {
  const button = form.querySelector('button[type="submit"]');
  if (!button.dataset.label) button.dataset.label = button.textContent;
  button.disabled = submitting;
  button.textContent = submitting ? text : button.dataset.label;
}

function showAccount(session) {
  signedOutView.hidden = true;
  signedInView.hidden = false;
  document.getElementById('accountAvatar').textContent = session.user.username.slice(0, 1).toUpperCase();
  document.getElementById('accountName').textContent = session.user.username;
  document.getElementById('accountRole').textContent = session.user.role === 'admin' ? '管理员' : '授权用户';
  const status = document.getElementById('accountStatus');
  status.textContent = session.user.mustChangePassword
    ? '请先修改密码'
    : session.authorized ? '已授权' : '授权已失效';
  status.classList.toggle('authorized', session.authorized);
  document.getElementById('accountExpiry').textContent = session.expiresAt ? new Date(session.expiresAt).toLocaleDateString('zh-CN') : '长期有效';
  document.getElementById('adminEntry').hidden = session.user.role !== 'admin';
  document.getElementById('renewalSection').hidden = session.user.role === 'admin';
  document.getElementById('passwordSection').hidden = false;
  const passwordNotice = document.getElementById('passwordNotice');
  passwordNotice.hidden = !session.user.mustChangePassword;
  if (session.user.mustChangePassword) {
    passwordNotice.textContent = '这是初始或临时密码。请先修改密码，再进入授权功能。';
    document.getElementById('passwordSection').open = true;
  }
}

document.querySelectorAll('.auth-tab').forEach((button) => button.addEventListener('click', () => setTab(button.dataset.tab)));

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setSubmitting(loginForm, true, '正在登录…');
  try {
    const values = Object.fromEntries(new FormData(loginForm));
    const session = await api('/auth/login', { method: 'POST', body: JSON.stringify(values) });
    if (!session.authorized || session.user.mustChangePassword) {
      showAccount(session);
      showAlert(session.user.mustChangePassword
        ? '登录成功，请先修改初始或临时密码。'
        : '登录成功，但授权已失效。你可以在下方输入新授权码续费。');
      return;
    }
    showAlert('登录成功，正在进入工作台…', 'success');
    setTimeout(() => { location.href = './today.html'; }, 500);
  } catch (error) {
    showAlert(error.message);
  } finally {
    setSubmitting(loginForm, false);
  }
});

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(registerForm));
  if (values.password !== values.confirmPassword) return showAlert('两次输入的密码不一致。');
  setSubmitting(registerForm, true, '正在验证授权码…');
  try {
    const session = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: values.username,
        password: values.password,
        licenseCode: values.licenseCode,
        acceptedTerms: values.agreement === 'on',
        termsVersion: '2026-08-27',
      }),
    });
    showAlert(session.message || '注册成功，正在进入工作台…', 'success');
    setTimeout(() => { location.href = './today.html'; }, 650);
  } catch (error) {
    showAlert(error.message);
  } finally {
    setSubmitting(registerForm, false);
  }
});

document.getElementById('logoutButton').addEventListener('click', async () => {
  await api('/auth/logout', { method: 'POST', body: '{}' }).catch(() => null);
  location.reload();
});

document.getElementById('renewalForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  setSubmitting(form, true, '正在兑换…');
  try {
    const result = await api('/auth/renew', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    showAlert(result.message, 'success');
    form.reset();
    showAccount(await api('/auth/session'));
  } catch (error) {
    showAlert(error.message);
  } finally {
    setSubmitting(form, false);
  }
});

document.getElementById('passwordForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  if (values.newPassword !== values.confirmPassword) return showAlert('两次输入的新密码不一致。');
  setSubmitting(form, true, '正在修改…');
  try {
    const result = await api('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
    });
    showAlert(result.message, 'success');
    form.reset();
    const session = await api('/auth/session');
    showAccount(session);
    if (session.authorized && new URLSearchParams(location.search).get('change') === '1') {
      setTimeout(() => { location.href = session.user.role === 'admin' ? './admin.html' : './today.html'; }, 700);
    }
  } catch (error) {
    showAlert(error.message);
  } finally {
    setSubmitting(form, false);
  }
});

async function initialize() {
  if (new URLSearchParams(location.search).get('tab') === 'register') setTab('register');
  try {
    const session = await api('/auth/session');
    if (session.authenticated) showAccount(session);
  } catch {
    showAlert('暂时无法连接授权服务。你仍可以进入体验版，稍后再试。');
  }
}

initialize();
