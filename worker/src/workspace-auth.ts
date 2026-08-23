import { verifyPassword } from './auth';
import { generateStoryImage, ZhipuImageError } from './ai/zhipu-image';
import { generateMathStory, ZhipuStoryError } from './ai/zhipu-story';
import {
  generateWorkspaceAi,
  MimoWorkspaceError,
  type WorkspaceAiFeature,
} from './ai/mimo-workspace';

const API_PREFIX = '/api/workspace';
const SESSION_COOKIE = 'sjhk_workspace_session';
const SESSION_DAYS = 30;
const ADMIN_ID = 'workspace-admin-primary';
const ALLOWED_ORIGINS = new Set([
  'https://shangjiehaoke.com',
  'https://www.shangjiehaoke.com',
]);
const encoder = new TextEncoder();

export type WorkspaceAuthEnv = {
  AUTH_DB: D1Database;
  GLM_API_KEY?: string;
  MIMO_API_KEY?: string;
  WORKSPACE_ADMIN_USERNAME?: string;
  WORKSPACE_ADMIN_PASSWORD_HASH?: string;
  WORKSPACE_SESSION_SECRET?: string;
  WORKSPACE_LICENSE_PEPPER?: string;
  WORKSPACE_PASSWORD_PEPPER?: string;
};

type UserRow = {
  id: string;
  username: string;
  display_name: string | null;
  password_hash: string;
  role: 'user' | 'admin';
  status: 'active' | 'disabled';
  must_change_password: number;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
};

type SessionUser = UserRow & {
  session_id: string;
  session_expires_at: string;
};

type LicenseRow = {
  id: string;
  code_hash: string;
  code_prefix: string;
  plan: 'authorized' | 'yearly' | 'permanent';
  status: 'available' | 'redeemed' | 'revoked' | 'expired';
  duration_days: number;
  redeem_before: string | null;
  expires_at: string | null;
  redeemed_by: string | null;
  redeemed_at: string | null;
};

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    return (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
      && (url.protocol === 'http:' || url.protocol === 'https:');
  } catch {
    return false;
  }
}

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('Origin');
  return {
    'Access-Control-Allow-Origin': origin && isAllowedOrigin(origin) ? origin : 'https://shangjiehaoke.com',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(request: Request, data: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
  return Response.json(data, {
    status,
    headers: {
      ...corsHeaders(request),
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      ...extraHeaders,
    },
  });
}

function failure(request: Request, status: number, message: string, code: string): Response {
  return json(request, { ok: false, code, message }, status);
}

function originAllowed(request: Request): boolean {
  const origin = request.headers.get('Origin');
  return Boolean(origin && isAllowedOrigin(origin));
}

function configured(env: WorkspaceAuthEnv): boolean {
  return Boolean(
    env.AUTH_DB
    && env.WORKSPACE_ADMIN_USERNAME
    && env.WORKSPACE_ADMIN_PASSWORD_HASH
    && env.WORKSPACE_SESSION_SECRET
    && env.WORKSPACE_LICENSE_PEPPER
    && env.WORKSPACE_PASSWORD_PEPPER,
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomToken(bytes = 32): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

function timingSafeTextEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function hashWorkspacePassword(password: string, env: WorkspaceAuthEnv): Promise<string> {
  const salt = randomToken(16);
  const digest = await hmac(`${salt}\u0000${password}`, env.WORKSPACE_PASSWORD_PEPPER || '');
  return `hmac_sha256$${salt}$${digest}`;
}

async function verifyWorkspacePassword(
  password: string,
  encodedHash: string,
  env: WorkspaceAuthEnv,
): Promise<boolean> {
  const [algorithm, salt, expected, extra] = encodedHash.split('$');
  if (algorithm !== 'hmac_sha256') return verifyPassword(password, encodedHash);
  if (!salt || !expected || extra) return false;
  const actual = await hmac(`${salt}\u0000${password}`, env.WORKSPACE_PASSWORD_PEPPER || '');
  return timingSafeTextEqual(actual, expected);
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie') || '';
  for (const pair of header.split(';')) {
    const [cookieName, ...valueParts] = pair.trim().split('=');
    if (cookieName === name) return valueParts.join('=') || null;
  }
  return null;
}

function sessionCookie(request: Request, token: string, maxAge = SESSION_DAYS * 86400): string {
  const url = new URL(request.url);
  const secure = url.protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; Path=${API_PREFIX}; Max-Age=${maxAge}; HttpOnly${secure}; SameSite=Strict`;
}

function clearSessionCookie(request: Request): string {
  return sessionCookie(request, '', 0);
}

function normalizeUsername(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function validUsername(value: unknown): boolean {
  return /^[a-zA-Z0-9_\u4e00-\u9fa5]{3,24}$/.test(String(value || '').trim());
}

function validPassword(value: unknown): boolean {
  const password = String(value || '');
  return password.length >= 8
    && password.length <= 72
    && /[A-Za-z\u4e00-\u9fa5]/.test(password)
    && /\d/.test(password);
}

function normalizeLicenseCode(value: unknown): string {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function formatLicenseCode(value: string): string {
  return normalizeLicenseCode(value).match(/.{1,4}/g)?.join('-') || '';
}

function createLicenseCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const random = crypto.getRandomValues(new Uint8Array(16));
  let value = 'SJHK';
  for (const byte of random) value += alphabet[byte % alphabet.length];
  return formatLicenseCode(value);
}

async function licenseHash(code: string, env: WorkspaceAuthEnv): Promise<string> {
  return hmac(normalizeLicenseCode(code), env.WORKSPACE_LICENSE_PEPPER || '');
}

async function clientHash(request: Request, env: WorkspaceAuthEnv): Promise<string> {
  const address = request.headers.get('CF-Connecting-IP')
    || request.headers.get('X-Forwarded-For')?.split(',')[0]
    || 'unknown';
  return hmac(address.trim().slice(0, 80), env.WORKSPACE_SESSION_SECRET || '');
}

async function checkRateLimit(
  request: Request,
  env: WorkspaceAuthEnv,
  name: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const bucket = Math.floor(Date.now() / windowMs);
  const key = await hmac(`${name}:${bucket}:${await clientHash(request, env)}`, env.WORKSPACE_SESSION_SECRET || '');
  const expiresAt = new Date((bucket + 1) * windowMs).toISOString();
  const result = await env.AUTH_DB.prepare(`
    INSERT INTO rate_limits (bucket_key, request_count, expires_at, updated_at)
    VALUES (?, 1, ?, ?)
    ON CONFLICT (bucket_key) DO UPDATE SET
      request_count = request_count + 1,
      updated_at = excluded.updated_at
    RETURNING request_count
  `).bind(key, expiresAt, nowIso()).first<{ request_count: number }>();
  return (result?.request_count || 1) <= limit;
}

async function bodyJson<T>(request: Request): Promise<T> {
  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > 65_536) throw new Error('REQUEST_TOO_LARGE');
  return request.json<T>();
}

async function ensureAdmin(env: WorkspaceAuthEnv): Promise<void> {
  const username = normalizeUsername(env.WORKSPACE_ADMIN_USERNAME);
  if (!username || !env.WORKSPACE_ADMIN_PASSWORD_HASH) return;
  const timestamp = nowIso();
  await env.AUTH_DB.prepare(`
    INSERT INTO users (
      id, username, password_hash, role, status, must_change_password,
      created_at, updated_at, last_login_at
    ) VALUES (?, ?, ?, 'admin', 'active', 1, ?, ?, NULL)
    ON CONFLICT (id) DO NOTHING
  `).bind(ADMIN_ID, username, env.WORKSPACE_ADMIN_PASSWORD_HASH, timestamp, timestamp).run();
}

function publicUser(user: UserRow) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name || '',
    role: user.role,
    status: user.status,
    mustChangePassword: Boolean(user.must_change_password),
    createdAt: user.created_at,
    lastLoginAt: user.last_login_at,
  };
}

function normalizeDisplayName(value: unknown): string {
  return String(value || '').trim().replace(/[\u0000-\u001f\u007f]/g, '');
}

async function authorization(env: WorkspaceAuthEnv, user: UserRow) {
  if (user.role === 'admin') {
    return { authorized: !user.must_change_password, plan: 'admin', expiresAt: null };
  }
  const timestamp = nowIso();
  await env.AUTH_DB.prepare(`
    UPDATE license_codes SET status = 'expired'
    WHERE status = 'redeemed' AND expires_at IS NOT NULL AND expires_at <= ?
  `).bind(timestamp).run();
  const active = await env.AUTH_DB.prepare(`
    SELECT plan, expires_at
    FROM license_codes
    WHERE redeemed_by = ? AND status = 'redeemed'
      AND (expires_at IS NULL OR expires_at > ?)
    ORDER BY CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END DESC, expires_at DESC
    LIMIT 1
  `).bind(user.id, timestamp).first<{ plan: string; expires_at: string | null }>();
  if (active) {
    return {
      authorized: !user.must_change_password,
      plan: active.plan,
      expiresAt: active.expires_at,
    };
  }
  const latest = await env.AUTH_DB.prepare(`
    SELECT plan, expires_at FROM license_codes
    WHERE redeemed_by = ? ORDER BY redeemed_at DESC LIMIT 1
  `).bind(user.id).first<{ plan: string; expires_at: string | null }>();
  return { authorized: false, plan: latest?.plan || null, expiresAt: latest?.expires_at || null };
}

async function createSession(request: Request, env: WorkspaceAuthEnv, userId: string): Promise<string> {
  const token = randomToken();
  const timestamp = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  await env.AUTH_DB.prepare(`
    INSERT INTO sessions (id, token_hash, user_id, created_at, last_seen_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    await hmac(token, env.WORKSPACE_SESSION_SECRET || ''),
    userId,
    timestamp,
    timestamp,
    expiresAt,
  ).run();
  return token;
}

async function resolveSession(request: Request, env: WorkspaceAuthEnv): Promise<SessionUser | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await hmac(token, env.WORKSPACE_SESSION_SECRET || '');
  const user = await env.AUTH_DB.prepare(`
    SELECT
      users.*,
      sessions.id AS session_id,
      sessions.expires_at AS session_expires_at
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ?
  `).bind(tokenHash).first<SessionUser>();
  if (!user || user.status !== 'active' || user.session_expires_at <= nowIso()) {
    await env.AUTH_DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    return null;
  }
  await env.AUTH_DB.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?')
    .bind(nowIso(), user.session_id).run();
  return user;
}

async function sessionPayload(env: WorkspaceAuthEnv, user: SessionUser | UserRow) {
  return {
    ok: true,
    authenticated: true,
    ...(await authorization(env, user)),
    user: publicUser(user),
  };
}

async function auditStatement(
  request: Request,
  env: WorkspaceAuthEnv,
  actorUserId: string | null,
  eventType: string,
  targetType: string | null,
  targetId: string | null,
  detail: unknown = null,
): Promise<D1PreparedStatement> {
  return env.AUTH_DB.prepare(`
    INSERT INTO audit_events (
      id, actor_user_id, event_type, target_type, target_id,
      detail_json, client_hash, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    actorUserId,
    eventType,
    targetType,
    targetId,
    detail ? JSON.stringify(detail) : null,
    await clientHash(request, env),
    nowIso(),
  );
}

async function requireSession(request: Request, env: WorkspaceAuthEnv): Promise<SessionUser | Response> {
  const user = await resolveSession(request, env);
  return user || failure(request, 401, '请先登录。', 'AUTH_REQUIRED');
}

async function requireAdmin(request: Request, env: WorkspaceAuthEnv): Promise<SessionUser | Response> {
  const user = await resolveSession(request, env);
  if (!user) return failure(request, 401, '请先登录管理员账号。', 'AUTH_REQUIRED');
  if (user.role !== 'admin') return failure(request, 403, '没有管理员权限。', 'ADMIN_REQUIRED');
  if (user.must_change_password) {
    return failure(request, 403, '首次登录请先修改管理员初始密码。', 'PASSWORD_CHANGE_REQUIRED');
  }
  return user;
}

function isResponse(value: SessionUser | Response): value is Response {
  return value instanceof Response;
}

async function handleRegister(request: Request, env: WorkspaceAuthEnv): Promise<Response> {
  if (!(await checkRateLimit(request, env, 'register', 8, 15 * 60_000))) {
    return failure(request, 429, '注册尝试过于频繁，请15分钟后再试。', 'RATE_LIMITED');
  }
  let input: { username?: string; password?: string; licenseCode?: string; acceptedTerms?: boolean; termsVersion?: string };
  try {
    input = await bodyJson(request);
  } catch {
    return failure(request, 400, '注册信息格式不正确。', 'INVALID_REQUEST');
  }
  const usernameInput = String(input.username || '').trim();
  const username = normalizeUsername(usernameInput);
  const password = String(input.password || '');
  const code = normalizeLicenseCode(input.licenseCode);
  if (!validUsername(usernameInput)) {
    return failure(request, 400, '用户名请使用3至24位中文、字母、数字或下划线。', 'INVALID_USERNAME');
  }
  if (!validPassword(password)) {
    return failure(request, 400, '密码至少8位，并同时包含文字或字母和数字。', 'INVALID_PASSWORD');
  }
  if (code.length !== 20 || !code.startsWith('SJHK')) {
    return failure(request, 400, '请输入完整授权码。', 'INVALID_LICENSE');
  }
  if (input.acceptedTerms !== true || input.termsVersion !== '2026-08-07') {
    return failure(request, 400, '请先阅读并同意使用协议与隐私说明。', 'TERMS_REQUIRED');
  }
  const codeHash = await licenseHash(code, env);
  const timestamp = nowIso();
  const license = await env.AUTH_DB.prepare('SELECT * FROM license_codes WHERE code_hash = ?')
    .bind(codeHash).first<LicenseRow>();
  if (!license || license.status !== 'available') {
    return failure(request, 400, '授权码无效、已使用或已停用。', 'INVALID_LICENSE');
  }
  if (license.redeem_before && license.redeem_before <= timestamp) {
    await env.AUTH_DB.prepare("UPDATE license_codes SET status = 'expired' WHERE id = ? AND status = 'available'")
      .bind(license.id).run();
    return failure(request, 400, '该授权码已经超过注册期限。', 'LICENSE_EXPIRED');
  }
  const existing = await env.AUTH_DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
  if (existing) return failure(request, 409, '这个用户名已被使用。', 'USERNAME_TAKEN');

  const userId = crypto.randomUUID();
  const passwordHash = await hashWorkspacePassword(password, env);
  const expiresAt = license.duration_days > 0
    ? new Date(Date.now() + license.duration_days * 86400000).toISOString()
    : null;
  try {
    await env.AUTH_DB.batch([
      env.AUTH_DB.prepare(`
        UPDATE license_codes
        SET status = 'redeemed', redeemed_by = ?, redeemed_at = ?, expires_at = ?
        WHERE id = ? AND status = 'available'
          AND (redeem_before IS NULL OR redeem_before > ?)
      `).bind(userId, timestamp, expiresAt, license.id, timestamp),
      env.AUTH_DB.prepare(`
        INSERT INTO users (
          id, username, password_hash, role, status, must_change_password,
          terms_version, terms_accepted_at, created_at, updated_at, last_login_at
        )
        SELECT ?, ?, ?, 'user', 'active', 0, '2026-08-07', ?, ?, ?, ?
        FROM license_codes
        WHERE id = ? AND status = 'redeemed' AND redeemed_by = ?
      `).bind(userId, username, passwordHash, timestamp, timestamp, timestamp, timestamp, license.id, userId),
      await auditStatement(request, env, userId, 'license.redeemed', 'license', license.id),
      await auditStatement(request, env, userId, 'user.registered', 'user', userId),
    ]);
  } catch (error) {
    const message = String(error);
    if (message.includes('UNIQUE')) return failure(request, 409, '这个用户名已被使用。', 'USERNAME_TAKEN');
    return failure(request, 409, '授权码刚刚已被使用，请联系管理员。', 'LICENSE_ALREADY_USED');
  }
  const user = await env.AUTH_DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<UserRow>();
  if (!user) return failure(request, 409, '授权码刚刚已被使用，请联系管理员。', 'LICENSE_ALREADY_USED');
  const token = await createSession(request, env, userId);
  return json(request, {
    ...(await sessionPayload(env, user)),
    message: '注册成功，已为你开通授权版。',
  }, 201, { 'Set-Cookie': sessionCookie(request, token) });
}

async function handleLogin(request: Request, env: WorkspaceAuthEnv): Promise<Response> {
  if (!(await checkRateLimit(request, env, 'login', 12, 15 * 60_000))) {
    return failure(request, 429, '登录尝试过于频繁，请15分钟后再试。', 'RATE_LIMITED');
  }
  let input: { username?: string; password?: string };
  try {
    input = await bodyJson(request);
  } catch {
    return failure(request, 400, '请输入用户名和密码。', 'INVALID_REQUEST');
  }
  const username = normalizeUsername(input.username);
  const password = String(input.password || '');
  if (username === normalizeUsername(env.WORKSPACE_ADMIN_USERNAME)) await ensureAdmin(env);
  const user = await env.AUTH_DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first<UserRow>();
  if (!user || password.length > 72 || !(await verifyWorkspacePassword(password, user.password_hash, env))) {
    return failure(request, 401, '用户名或密码不正确。', 'LOGIN_FAILED');
  }
  if (user.status !== 'active') return failure(request, 403, '这个账号已停用，请联系管理员。', 'ACCOUNT_DISABLED');
  const timestamp = nowIso();
  await env.AUTH_DB.batch([
    env.AUTH_DB.prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?')
      .bind(timestamp, timestamp, user.id),
    await auditStatement(request, env, user.id, 'user.logged_in', 'user', user.id),
  ]);
  const loggedIn = { ...user, last_login_at: timestamp };
  const token = await createSession(request, env, user.id);
  return json(request, await sessionPayload(env, loggedIn), 200, {
    'Set-Cookie': sessionCookie(request, token),
  });
}

async function handleChangePassword(request: Request, env: WorkspaceAuthEnv): Promise<Response> {
  const user = await requireSession(request, env);
  if (isResponse(user)) return user;
  let input: { currentPassword?: string; newPassword?: string };
  try {
    input = await bodyJson(request);
  } catch {
    return failure(request, 400, '密码信息格式不正确。', 'INVALID_REQUEST');
  }
  const currentPassword = String(input.currentPassword || '');
  const newPassword = String(input.newPassword || '');
  if (!(await verifyWorkspacePassword(currentPassword, user.password_hash, env))) {
    return failure(request, 401, '当前密码不正确。', 'CURRENT_PASSWORD_INVALID');
  }
  if (!validPassword(newPassword)) {
    return failure(request, 400, '新密码至少8位，并同时包含文字或字母和数字。', 'INVALID_PASSWORD');
  }
  if (currentPassword === newPassword) {
    return failure(request, 400, '新密码不能与当前密码相同。', 'PASSWORD_UNCHANGED');
  }
  const passwordHash = await hashWorkspacePassword(newPassword, env);
  const timestamp = nowIso();
  await env.AUTH_DB.batch([
    env.AUTH_DB.prepare(`
      UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?
    `).bind(passwordHash, timestamp, user.id),
    env.AUTH_DB.prepare('DELETE FROM sessions WHERE user_id = ? AND id <> ?').bind(user.id, user.session_id),
    await auditStatement(request, env, user.id, 'user.password_changed', 'user', user.id),
  ]);
  return json(request, { ok: true, message: '密码已修改，其他设备上的登录已经退出。' });
}

async function handleUpdateProfile(request: Request, env: WorkspaceAuthEnv): Promise<Response> {
  const user = await requireSession(request, env);
  if (isResponse(user)) return user;
  let input: { displayName?: string };
  try {
    input = await bodyJson(request);
  } catch {
    return failure(request, 400, '个人资料格式不正确。', 'INVALID_REQUEST');
  }
  const displayName = normalizeDisplayName(input.displayName);
  if (displayName.length > 24) {
    return failure(request, 400, '主页称呼不能超过24个字。', 'INVALID_DISPLAY_NAME');
  }
  const timestamp = nowIso();
  await env.AUTH_DB.batch([
    env.AUTH_DB.prepare('UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?')
      .bind(displayName || null, timestamp, user.id),
    await auditStatement(request, env, user.id, 'user.profile_updated', 'user', user.id, {
      hasDisplayName: Boolean(displayName),
    }),
  ]);
  return json(request, {
    ...(await sessionPayload(env, { ...user, display_name: displayName || null, updated_at: timestamp })),
    message: '个人信息已保存。',
  });
}

async function handleRenew(request: Request, env: WorkspaceAuthEnv): Promise<Response> {
  const user = await requireSession(request, env);
  if (isResponse(user)) return user;
  if (user.role !== 'user') return failure(request, 400, '管理员账号不需要续费。', 'RENEWAL_NOT_REQUIRED');
  let input: { licenseCode?: string };
  try {
    input = await bodyJson(request);
  } catch {
    return failure(request, 400, '请输入授权码。', 'INVALID_REQUEST');
  }
  const code = normalizeLicenseCode(input.licenseCode);
  if (code.length !== 20 || !code.startsWith('SJHK')) {
    return failure(request, 400, '请输入完整授权码。', 'INVALID_LICENSE');
  }
  const activePermanent = await env.AUTH_DB.prepare(`
    SELECT id FROM license_codes
    WHERE redeemed_by = ? AND status = 'redeemed' AND expires_at IS NULL LIMIT 1
  `).bind(user.id).first();
  if (activePermanent) return failure(request, 409, '当前账号已经是长期会员，无需续费。', 'ALREADY_PERMANENT');
  const codeHash = await licenseHash(code, env);
  const license = await env.AUTH_DB.prepare('SELECT * FROM license_codes WHERE code_hash = ?')
    .bind(codeHash).first<LicenseRow>();
  const timestamp = nowIso();
  if (!license || license.status !== 'available') {
    return failure(request, 400, '授权码无效、已使用或已停用。', 'INVALID_LICENSE');
  }
  if (license.redeem_before && license.redeem_before <= timestamp) {
    await env.AUTH_DB.prepare("UPDATE license_codes SET status = 'expired' WHERE id = ? AND status = 'available'")
      .bind(license.id).run();
    return failure(request, 400, '该授权码已经超过兑换期限。', 'LICENSE_EXPIRED');
  }
  const current = await env.AUTH_DB.prepare(`
    SELECT MAX(expires_at) AS expires_at FROM license_codes
    WHERE redeemed_by = ? AND status = 'redeemed' AND expires_at > ?
  `).bind(user.id, timestamp).first<{ expires_at: string | null }>();
  const baseTime = Math.max(Date.now(), current?.expires_at ? Date.parse(current.expires_at) : 0);
  const expiresAt = license.duration_days > 0
    ? new Date(baseTime + license.duration_days * 86400000).toISOString()
    : null;
  const result = await env.AUTH_DB.batch([
    env.AUTH_DB.prepare(`
      UPDATE license_codes
      SET status = 'redeemed', redeemed_by = ?, redeemed_at = ?, expires_at = ?
      WHERE id = ? AND status = 'available'
        AND (redeem_before IS NULL OR redeem_before > ?)
    `).bind(user.id, timestamp, expiresAt, license.id, timestamp),
  ]);
  if ((result[0].meta.changes || 0) !== 1) {
    return failure(request, 409, '授权码刚刚已被使用，请联系管理员。', 'LICENSE_ALREADY_USED');
  }
  await (await auditStatement(request, env, user.id, 'license.renewed', 'license', license.id, { expiresAt })).run();
  return json(request, {
    ok: true,
    message: expiresAt ? `续费成功，会员有效期至${new Date(expiresAt).toLocaleDateString('zh-CN')}。` : '续费成功，已升级为长期会员。',
    ...(await authorization(env, user)),
  });
}

async function handleAdminOverview(request: Request, env: WorkspaceAuthEnv): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (isResponse(admin)) return admin;
  const timestamp = nowIso();
  await env.AUTH_DB.prepare("UPDATE license_codes SET status = 'expired' WHERE status IN ('available','redeemed') AND ((status = 'available' AND redeem_before IS NOT NULL AND redeem_before <= ?) OR (status = 'redeemed' AND expires_at IS NOT NULL AND expires_at <= ?))")
    .bind(timestamp, timestamp).run();
  const [users, activeUsers, available, redeemed, events] = await Promise.all([
    env.AUTH_DB.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'user'").first<{ count: number }>(),
    env.AUTH_DB.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'user' AND status = 'active'").first<{ count: number }>(),
    env.AUTH_DB.prepare("SELECT COUNT(*) AS count FROM license_codes WHERE status = 'available'").first<{ count: number }>(),
    env.AUTH_DB.prepare("SELECT COUNT(*) AS count FROM license_codes WHERE status = 'redeemed'").first<{ count: number }>(),
    env.AUTH_DB.prepare(`
      SELECT audit_events.event_type, audit_events.target_type, audit_events.created_at,
        users.username AS actor_username
      FROM audit_events LEFT JOIN users ON users.id = audit_events.actor_user_id
      ORDER BY audit_events.created_at DESC LIMIT 12
    `).all(),
  ]);
  return json(request, {
    ok: true,
    stats: {
      users: users?.count || 0,
      activeUsers: activeUsers?.count || 0,
      availableLicenses: available?.count || 0,
      redeemedLicenses: redeemed?.count || 0,
    },
    events: events.results || [],
  });
}

async function handleAdminLicenseList(request: Request, env: WorkspaceAuthEnv, url: URL): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (isResponse(admin)) return admin;
  const timestamp = nowIso();
  await env.AUTH_DB.prepare("UPDATE license_codes SET status = 'expired' WHERE status IN ('available','redeemed') AND ((status = 'available' AND redeem_before IS NOT NULL AND redeem_before <= ?) OR (status = 'redeemed' AND expires_at IS NOT NULL AND expires_at <= ?))")
    .bind(timestamp, timestamp).run();
  const status = url.searchParams.get('status') || 'all';
  const validStatus = ['available', 'redeemed', 'revoked', 'expired'].includes(status);
  const statement = env.AUTH_DB.prepare(`
    SELECT license_codes.*, creator.username AS creator_username, redeemer.username AS redeemer_username
    FROM license_codes
    LEFT JOIN users creator ON creator.id = license_codes.created_by
    LEFT JOIN users redeemer ON redeemer.id = license_codes.redeemed_by
    ${validStatus ? 'WHERE license_codes.status = ?' : ''}
    ORDER BY license_codes.created_at DESC LIMIT 500
  `);
  const rows = validStatus ? await statement.bind(status).all() : await statement.all();
  return json(request, {
    ok: true,
    licenses: (rows.results || []).map((row) => ({
      id: row.id,
      prefix: row.code_prefix,
      plan: row.plan,
      status: row.status,
      durationDays: row.duration_days,
      redeemBefore: row.redeem_before,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      creatorUsername: row.creator_username,
      redeemerUsername: row.redeemer_username,
      redeemedAt: row.redeemed_at,
    })),
  });
}

async function handleAdminCreateLicenses(request: Request, env: WorkspaceAuthEnv): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (isResponse(admin)) return admin;
  if (!(await checkRateLimit(request, env, `license:${admin.id}`, 30, 60_000))) {
    return failure(request, 429, '生成过于频繁，请一分钟后再试。', 'RATE_LIMITED');
  }
  let input: { count?: number; plan?: string; durationDays?: number; redeemBeforeDays?: number };
  try {
    input = await bodyJson(request);
  } catch {
    return failure(request, 400, '授权码参数不正确。', 'INVALID_REQUEST');
  }
  const count = Math.min(100, Math.max(1, Number(input.count || 1)));
  if (!['yearly', 'permanent'].includes(String(input.plan))) {
    return failure(request, 400, '请选择一年会员或长期会员。', 'INVALID_PLAN');
  }
  const plan = String(input.plan) as LicenseRow['plan'];
  const durationDays = plan === 'permanent' ? 0 : 365;
  const redeemBeforeDays = Math.max(0, Math.min(3650, Number(input.redeemBeforeDays ?? 30)));
  const timestamp = nowIso();
  const redeemBefore = redeemBeforeDays
    ? new Date(Date.now() + redeemBeforeDays * 86400000).toISOString()
    : null;
  const codes: Array<{ id: string; code: string; plan: string; durationDays: number; redeemBefore: string | null }> = [];
  const statements: D1PreparedStatement[] = [];
  for (let index = 0; index < count; index += 1) {
    const code = createLicenseCode();
    const id = crypto.randomUUID();
    codes.push({ id, code, plan, durationDays, redeemBefore });
    statements.push(env.AUTH_DB.prepare(`
      INSERT INTO license_codes (
        id, code_hash, code_prefix, plan, status, duration_days,
        redeem_before, expires_at, created_by, created_at
      ) VALUES (?, ?, ?, ?, 'available', ?, ?, NULL, ?, ?)
    `).bind(id, await licenseHash(code, env), code.slice(0, 9), plan, durationDays, redeemBefore, admin.id, timestamp));
    statements.push(await auditStatement(request, env, admin.id, 'license.created', 'license', id, {
      plan, durationDays, redeemBefore,
    }));
  }
  await env.AUTH_DB.batch(statements);
  return json(request, {
    ok: true,
    message: `已生成${codes.length}个授权码，完整号码仅在本次显示。`,
    codes,
  }, 201);
}

async function handleAdminRevokeLicense(
  request: Request,
  env: WorkspaceAuthEnv,
  licenseId: string,
): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (isResponse(admin)) return admin;
  const license = await env.AUTH_DB.prepare('SELECT * FROM license_codes WHERE id = ?')
    .bind(licenseId).first<LicenseRow>();
  if (!license) return failure(request, 404, '没有找到这个授权码。', 'LICENSE_NOT_FOUND');
  if (license.status === 'revoked') return json(request, { ok: true, message: '该授权码已经停用。' });
  const timestamp = nowIso();
  const statements = [
    env.AUTH_DB.prepare("UPDATE license_codes SET status = 'revoked', revoked_at = ? WHERE id = ?")
      .bind(timestamp, license.id),
    await auditStatement(request, env, admin.id, 'license.revoked', 'license', license.id, {
      previousStatus: license.status,
    }),
  ];
  if (license.redeemed_by) {
    statements.push(env.AUTH_DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(license.redeemed_by));
  }
  await env.AUTH_DB.batch(statements);
  return json(request, { ok: true, message: '授权码已停用，对应账号已退出登录。' });
}

async function handleAdminUsers(request: Request, env: WorkspaceAuthEnv): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (isResponse(admin)) return admin;
  const rows = await env.AUTH_DB.prepare(`
    SELECT
      users.id, users.username, users.role, users.status, users.created_at,
      users.last_login_at, users.must_change_password,
      COALESCE(
        (SELECT plan FROM license_codes WHERE redeemed_by = users.id AND status = 'redeemed' AND (expires_at IS NULL OR datetime(expires_at) > CURRENT_TIMESTAMP) ORDER BY CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END DESC, expires_at DESC LIMIT 1),
        (SELECT plan FROM license_codes WHERE redeemed_by = users.id ORDER BY redeemed_at DESC LIMIT 1)
      ) AS plan,
      COALESCE(
        (SELECT status FROM license_codes WHERE redeemed_by = users.id AND status = 'redeemed' AND (expires_at IS NULL OR datetime(expires_at) > CURRENT_TIMESTAMP) ORDER BY CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END DESC, expires_at DESC LIMIT 1),
        (SELECT status FROM license_codes WHERE redeemed_by = users.id ORDER BY redeemed_at DESC LIMIT 1)
      ) AS license_status,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM license_codes
          WHERE redeemed_by = users.id AND status = 'redeemed' AND expires_at IS NULL
        ) THEN NULL
        ELSE COALESCE(
          (SELECT expires_at FROM license_codes WHERE redeemed_by = users.id AND status = 'redeemed' AND datetime(expires_at) > CURRENT_TIMESTAMP ORDER BY expires_at DESC LIMIT 1),
          (SELECT expires_at FROM license_codes WHERE redeemed_by = users.id ORDER BY redeemed_at DESC LIMIT 1)
        )
      END AS expires_at
    FROM users ORDER BY users.created_at DESC LIMIT 500
  `).all();
  return json(request, {
    ok: true,
    users: (rows.results || []).map((row) => ({
      id: row.id,
      username: row.username,
      role: row.role,
      status: row.status,
      mustChangePassword: Boolean(row.must_change_password),
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at,
      plan: row.plan,
      licenseStatus: row.license_status,
      expiresAt: row.expires_at,
    })),
  });
}

async function handleAdminUserStatus(
  request: Request,
  env: WorkspaceAuthEnv,
  userId: string,
): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (isResponse(admin)) return admin;
  let input: { status?: string };
  try {
    input = await bodyJson(request);
  } catch {
    return failure(request, 400, '账号状态不正确。', 'INVALID_REQUEST');
  }
  const status = input.status === 'active' || input.status === 'disabled' ? input.status : null;
  if (!status) return failure(request, 400, '账号状态不正确。', 'INVALID_STATUS');
  const user = await env.AUTH_DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<UserRow>();
  if (!user) return failure(request, 404, '没有找到这个账号。', 'USER_NOT_FOUND');
  if (user.role === 'admin') return failure(request, 400, '管理员账号不能在这里停用。', 'ADMIN_PROTECTED');
  const statements = [
    env.AUTH_DB.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?')
      .bind(status, nowIso(), user.id),
    await auditStatement(request, env, admin.id, `user.${status}`, 'user', user.id, {
      previousStatus: user.status,
    }),
  ];
  if (status === 'disabled') statements.push(env.AUTH_DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id));
  await env.AUTH_DB.batch(statements);
  return json(request, { ok: true, message: status === 'active' ? '账号已恢复。' : '账号已停用并退出登录。' });
}

async function handleAdminResetPassword(
  request: Request,
  env: WorkspaceAuthEnv,
  userId: string,
): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (isResponse(admin)) return admin;
  let input: { newPassword?: string };
  try {
    input = await bodyJson(request);
  } catch {
    return failure(request, 400, '临时密码格式不正确。', 'INVALID_REQUEST');
  }
  const newPassword = String(input.newPassword || '');
  if (!validPassword(newPassword)) {
    return failure(request, 400, '临时密码至少8位，并同时包含文字或字母和数字。', 'INVALID_PASSWORD');
  }
  const user = await env.AUTH_DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<UserRow>();
  if (!user) return failure(request, 404, '没有找到这个账号。', 'USER_NOT_FOUND');
  if (user.role === 'admin') return failure(request, 400, '管理员密码请在账号页自行修改。', 'ADMIN_PROTECTED');
  await env.AUTH_DB.batch([
    env.AUTH_DB.prepare(`
      UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = ? WHERE id = ?
    `).bind(await hashWorkspacePassword(newPassword, env), nowIso(), user.id),
    env.AUTH_DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
    await auditStatement(request, env, admin.id, 'user.password_reset', 'user', user.id),
  ]);
  return json(request, { ok: true, message: '临时密码已设置；用户下次登录后必须修改密码。' });
}

async function handleAdminGenerateImage(
  request: Request,
  env: WorkspaceAuthEnv,
): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (isResponse(admin)) return admin;
  if (!env.GLM_API_KEY) return failure(request, 503, 'AI生图服务尚未完成配置。', 'IMAGE_AI_NOT_CONFIGURED');
  if (!(await checkRateLimit(request, env, `admin-ai-image:${admin.id}`, 15, 24 * 60 * 60_000))) {
    return failure(request, 429, '今天的AI生图次数已达到15次，请明天再试。', 'DAILY_LIMIT_REACHED');
  }

  let input: { prompt?: string };
  try {
    input = await bodyJson(request);
  } catch {
    return failure(request, 400, '图片描述格式不正确。', 'INVALID_REQUEST');
  }

  try {
    const result = await generateStoryImage({
      apiKey: env.GLM_API_KEY,
      prompt: typeof input.prompt === 'string' ? input.prompt : '',
    });
    await (await auditStatement(request, env, admin.id, 'ai.image_generated', 'ai_model', result.model)).run();
    return json(request, {
      ok: true,
      imageUrl: result.imageUrl,
      provider: 'zhipu',
      model: result.model,
    });
  } catch (error) {
    if (error instanceof ZhipuImageError) {
      return failure(
        request,
        error.status,
        error.message,
        error.providerCode || 'IMAGE_PROVIDER_ERROR',
      );
    }
    return failure(request, 500, '图片生成失败，请稍后重试。', 'IMAGE_GENERATION_FAILED');
  }
}

async function handleAdminGenerateStory(
  request: Request,
  env: WorkspaceAuthEnv,
): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (isResponse(admin)) return admin;
  if (!env.GLM_API_KEY) return failure(request, 503, 'AI故事服务尚未完成配置。', 'STORY_AI_NOT_CONFIGURED');
  if (!(await checkRateLimit(request, env, `admin-ai-story:${admin.id}`, 5, 24 * 60 * 60_000))) {
    return failure(request, 429, '今天的AI故事次数已达到5次，请明天再试。', 'DAILY_LIMIT_REACHED');
  }

  let input: { messages?: unknown; max_tokens?: number };
  try {
    input = await bodyJson(request);
  } catch {
    return failure(request, 400, '故事请求格式不正确。', 'INVALID_REQUEST');
  }

  try {
    const result = await generateMathStory({
      apiKey: env.GLM_API_KEY,
      messages: input.messages,
      maxTokens: input.max_tokens,
    });
    await (await auditStatement(request, env, admin.id, 'ai.story_generated', 'ai_model', result.model)).run();
    return json(request, {
      ok: true,
      choices: [
        {
          message: {
            role: 'assistant',
            content: result.content,
          },
        },
      ],
      provider: 'zhipu',
      model: result.model,
      usage: result.usage,
    });
  } catch (error) {
    if (error instanceof ZhipuStoryError) {
      return failure(
        request,
        error.status,
        error.message,
        error.providerCode || 'STORY_PROVIDER_ERROR',
      );
    }
    return failure(request, 500, '故事生成失败，请稍后重试。', 'STORY_GENERATION_FAILED');
  }
}

async function handleAdminWorkspaceAi(
  request: Request,
  env: WorkspaceAuthEnv,
  feature: WorkspaceAiFeature,
): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (isResponse(admin)) return admin;
  if (!env.MIMO_API_KEY) {
    return failure(request, 503, 'MiMo智能整理服务尚未完成配置。', 'MIMO_AI_NOT_CONFIGURED');
  }
  const limits: Record<WorkspaceAiFeature, number> = {
    organize: 60,
    'daily-summary': 12,
    review: 12,
    'learning-insights': 12,
  };
  if (!(await checkRateLimit(request, env, `admin-workspace-ai:${feature}:${admin.id}`, limits[feature], 24 * 60 * 60_000))) {
    return failure(request, 429, '今天这项AI功能的使用次数已达到上限，请明天再试。', 'DAILY_LIMIT_REACHED');
  }
  let payload: unknown;
  try {
    payload = await bodyJson(request);
  } catch {
    return failure(request, 400, 'AI请求内容格式不正确。', 'INVALID_REQUEST');
  }
  try {
    const generated = await generateWorkspaceAi({
      apiKey: env.MIMO_API_KEY,
      feature,
      payload,
    });
    await (await auditStatement(
      request,
      env,
      admin.id,
      `ai.workspace_${feature.replace('-', '_')}`,
      'ai_model',
      generated.model,
    )).run();
    return json(request, {
      ok: true,
      result: generated.result,
      provider: 'xiaomi-mimo',
      model: generated.model,
      usage: generated.usage,
    });
  } catch (error) {
    if (error instanceof MimoWorkspaceError) {
      return failure(
        request,
        error.status,
        error.message,
        error.providerCode || 'MIMO_PROVIDER_ERROR',
      );
    }
    return failure(request, 500, 'AI整理失败，请稍后重试。', 'AI_GENERATION_FAILED');
  }
}

export async function handleWorkspaceRequest(
  request: Request,
  env: WorkspaceAuthEnv,
  url = new URL(request.url),
): Promise<Response | null> {
  if (!url.pathname.startsWith(API_PREFIX)) return null;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (url.pathname === `${API_PREFIX}/health` && request.method === 'GET') {
    try {
      const table = await env.AUTH_DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'").first();
      return json(request, { ok: true, service: 'teacher-workspace-authorization', database: table ? 'connected' : 'migration-required' });
    } catch {
      return failure(request, 503, '授权数据库暂时不可用。', 'DATABASE_UNAVAILABLE');
    }
  }
  if (!configured(env)) return failure(request, 503, '授权服务尚未完成配置。', 'AUTH_NOT_CONFIGURED');
  if (request.method !== 'GET' && !originAllowed(request)) {
    return failure(request, 403, '请求来源校验失败，请刷新页面后重试。', 'ORIGIN_NOT_ALLOWED');
  }

  try {
    if (url.pathname === `${API_PREFIX}/auth/session` && request.method === 'GET') {
      const user = await resolveSession(request, env);
      return user
        ? json(request, await sessionPayload(env, user))
        : json(request, { ok: true, authenticated: false, authorized: false });
    }
    if (url.pathname === `${API_PREFIX}/auth/register` && request.method === 'POST') return handleRegister(request, env);
    if (url.pathname === `${API_PREFIX}/auth/login` && request.method === 'POST') return handleLogin(request, env);
    if (url.pathname === `${API_PREFIX}/auth/change-password` && request.method === 'POST') return handleChangePassword(request, env);
    if (url.pathname === `${API_PREFIX}/auth/profile` && request.method === 'POST') return handleUpdateProfile(request, env);
    if (url.pathname === `${API_PREFIX}/auth/renew` && request.method === 'POST') return handleRenew(request, env);
    if (url.pathname === `${API_PREFIX}/auth/logout` && request.method === 'POST') {
      const token = readCookie(request, SESSION_COOKIE);
      const user = await resolveSession(request, env);
      if (token) {
        await env.AUTH_DB.prepare('DELETE FROM sessions WHERE token_hash = ?')
          .bind(await hmac(token, env.WORKSPACE_SESSION_SECRET || '')).run();
      }
      if (user) await (await auditStatement(request, env, user.id, 'user.logged_out', 'user', user.id)).run();
      return json(request, { ok: true }, 200, { 'Set-Cookie': clearSessionCookie(request) });
    }
    if (url.pathname === `${API_PREFIX}/admin/overview` && request.method === 'GET') return handleAdminOverview(request, env);
    if (url.pathname === `${API_PREFIX}/admin/ai/generate-image` && request.method === 'POST') return handleAdminGenerateImage(request, env);
    if (url.pathname === `${API_PREFIX}/admin/ai/generate-story` && request.method === 'POST') return handleAdminGenerateStory(request, env);
    if (url.pathname === `${API_PREFIX}/admin/ai/organize` && request.method === 'POST') return handleAdminWorkspaceAi(request, env, 'organize');
    if (url.pathname === `${API_PREFIX}/admin/ai/daily-summary` && request.method === 'POST') return handleAdminWorkspaceAi(request, env, 'daily-summary');
    if (url.pathname === `${API_PREFIX}/admin/ai/review` && request.method === 'POST') return handleAdminWorkspaceAi(request, env, 'review');
    if (url.pathname === `${API_PREFIX}/admin/ai/learning-insights` && request.method === 'POST') return handleAdminWorkspaceAi(request, env, 'learning-insights');
    if (url.pathname === `${API_PREFIX}/admin/licenses` && request.method === 'GET') return handleAdminLicenseList(request, env, url);
    if (url.pathname === `${API_PREFIX}/admin/licenses` && request.method === 'POST') return handleAdminCreateLicenses(request, env);
    const licenseRevoke = url.pathname.match(/^\/api\/workspace\/admin\/licenses\/([^/]+)\/revoke$/);
    if (licenseRevoke && request.method === 'POST') return handleAdminRevokeLicense(request, env, decodeURIComponent(licenseRevoke[1]));
    if (url.pathname === `${API_PREFIX}/admin/users` && request.method === 'GET') return handleAdminUsers(request, env);
    const userStatus = url.pathname.match(/^\/api\/workspace\/admin\/users\/([^/]+)\/status$/);
    if (userStatus && request.method === 'POST') return handleAdminUserStatus(request, env, decodeURIComponent(userStatus[1]));
    const userPassword = url.pathname.match(/^\/api\/workspace\/admin\/users\/([^/]+)\/password$/);
    if (userPassword && request.method === 'POST') return handleAdminResetPassword(request, env, decodeURIComponent(userPassword[1]));
    return failure(request, 404, '接口不存在。', 'NOT_FOUND');
  } catch (error) {
    console.error('Workspace authorization error', error);
    return failure(request, 500, '授权服务暂时出现问题，请稍后重试。', 'INTERNAL_ERROR');
  }
}
