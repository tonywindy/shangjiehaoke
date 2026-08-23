import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

import { hashPassword } from '../../worker/src/auth.ts';

const workerDirectory = resolve('worker');
const wrangler = resolve(workerDirectory, 'node_modules/.bin/wrangler');
const origin = 'http://127.0.0.1:5173';

async function waitForWorker(url, process, output) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (process.exitCode != null) throw new Error(`本地授权服务提前退出：\n${output()}`);
    try {
      const response = await fetch(`${url}/api/workspace/health`);
      if (response.ok) return;
    } catch {
      // Wrangler 启动和初始化 D1 时会短暂拒绝连接。
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(`本地授权服务启动超时：\n${output()}`);
}

test('授权码注册、续期、停用授权码和停用账号形成完整闭环', { timeout: 30_000 }, async () => {
  const persistDirectory = await mkdtemp(resolve(tmpdir(), 'sjhk-workspace-auth-test-'));
  const port = 18788 + Math.floor(Math.random() * 500);
  const baseUrl = `http://127.0.0.1:${port}`;
  let workerProcess;
  let workerOutput = '';
  try {
    const migration = spawnSync(wrangler, [
      'd1', 'migrations', 'apply', 'AUTH_DB', '--local', '--persist-to', persistDirectory,
    ], { cwd: workerDirectory, encoding: 'utf8' });
    assert.equal(migration.status, 0, `${migration.stdout}\n${migration.stderr}`);

    const initialAdminPassword = 'Admin2026';
    const changedAdminPassword = 'Admin2027';
    const adminHash = await hashPassword(initialAdminPassword);
    const variables = {
      WORKSPACE_ADMIN_USERNAME: 'workspaceadmin',
      WORKSPACE_ADMIN_PASSWORD_HASH: adminHash,
      WORKSPACE_SESSION_SECRET: 'test-session-secret-2026',
      WORKSPACE_LICENSE_PEPPER: 'test-license-pepper-2026',
      WORKSPACE_PASSWORD_PEPPER: 'test-password-pepper-2026',
    };
    const argumentsList = ['dev', '--local', '--port', String(port), '--persist-to', persistDirectory];
    Object.entries(variables).forEach(([key, value]) => argumentsList.push('--var', `${key}:${value}`));
    workerProcess = spawn(wrangler, argumentsList, { cwd: workerDirectory, stdio: ['ignore', 'pipe', 'pipe'] });
    workerProcess.stdout.on('data', (chunk) => { workerOutput += chunk; });
    workerProcess.stderr.on('data', (chunk) => { workerOutput += chunk; });
    await waitForWorker(baseUrl, workerProcess, () => workerOutput);

    async function request(path, { method = 'GET', body, cookie = '' } = {}) {
      const response = await fetch(`${baseUrl}/api/workspace${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          Origin: origin,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = await response.json();
      return {
        response,
        payload,
        cookie: response.headers.get('set-cookie')?.split(';')[0] || cookie,
      };
    }

    let result = await request('/auth/login', {
      method: 'POST', body: { username: 'workspaceadmin', password: initialAdminPassword },
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.payload.user.mustChangePassword, true);
    let adminCookie = result.cookie;

    result = await request('/auth/change-password', {
      method: 'POST', cookie: adminCookie,
      body: { currentPassword: initialAdminPassword, newPassword: changedAdminPassword },
    });
    assert.equal(result.response.status, 200);

    result = await request('/admin/ai/organize', {
      method: 'POST', cookie: adminCookie,
      body: { text: '明天整理课堂记录', currentDate: '2026-08-23', studentTokens: [] },
    });
    assert.equal(result.response.status, 503);
    assert.equal(result.payload.code, 'MIMO_AI_NOT_CONFIGURED');

    result = await request('/admin/licenses', {
      method: 'POST', cookie: adminCookie,
      body: { count: 2, plan: 'yearly', redeemBeforeDays: 30 },
    });
    assert.equal(result.response.status, 201);
    assert.equal(result.payload.codes.length, 2);
    const [registrationLicense, renewalLicense] = result.payload.codes;

    result = await request('/auth/register', {
      method: 'POST',
      body: {
        username: 'testteacher', password: 'Teacher2026',
        licenseCode: registrationLicense.code, acceptedTerms: true, termsVersion: '2026-08-07',
      },
    });
    assert.equal(result.response.status, 201);
    assert.equal(result.payload.authorized, true);
    const userId = result.payload.user.id;
    let userCookie = result.cookie;

    result = await request('/admin/ai/organize', {
      method: 'POST', cookie: userCookie,
      body: { text: '尝试调用管理员AI', currentDate: '2026-08-23', studentTokens: [] },
    });
    assert.equal(result.response.status, 403);
    assert.equal(result.payload.code, 'ADMIN_REQUIRED');

    result = await request('/auth/renew', {
      method: 'POST', cookie: userCookie, body: { licenseCode: renewalLicense.code },
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.payload.authorized, true);

    result = await request(`/admin/licenses/${renewalLicense.id}/revoke`, {
      method: 'POST', cookie: adminCookie, body: {},
    });
    assert.equal(result.response.status, 200);
    result = await request('/auth/session', { cookie: userCookie });
    assert.equal(result.payload.authenticated, false);

    result = await request('/auth/login', {
      method: 'POST', body: { username: 'testteacher', password: 'Teacher2026' },
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.payload.authorized, true);
    userCookie = result.cookie;

    result = await request(`/admin/users/${userId}/status`, {
      method: 'POST', cookie: adminCookie, body: { status: 'disabled' },
    });
    assert.equal(result.response.status, 200);
    result = await request('/auth/session', { cookie: userCookie });
    assert.equal(result.payload.authenticated, false);
    result = await request('/auth/login', {
      method: 'POST', body: { username: 'testteacher', password: 'Teacher2026' },
    });
    assert.equal(result.response.status, 403);
    assert.equal(result.payload.code, 'ACCOUNT_DISABLED');
  } finally {
    if (workerProcess && workerProcess.exitCode == null) {
      workerProcess.kill('SIGTERM');
      await new Promise((resolvePromise) => workerProcess.once('exit', resolvePromise));
    }
    await rm(persistDirectory, { recursive: true, force: true });
  }
});
