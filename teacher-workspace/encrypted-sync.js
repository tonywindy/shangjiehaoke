import { workspaceApi as api } from './api-client.js';

const SYNC_VERSION = 1;
const WORKSPACE_DB_VERSION = 5;
const WORKSPACE_STORES = [
  'meta', 'classes', 'students', 'kps', 'judgements', 'questionSets',
  'questionSetUses', 'reasonTemplates', 'homeworks', 'homeworkEntries',
  'followupTasks', 'notes',
];
const RECOVERY_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const RECOVERY_LENGTH = 32;
const KEY_DATABASE = 'shangjiehaoke-workspace-e2ee-keys-v1';
const KEY_STORE = 'keys';
const AAD = new TextEncoder().encode('SJHK-TEACHER-WORKSPACE-E2EE-V1');
const SYNC_INTERVAL = 30_000;

let singleton = null;

function bytesToBase64Url(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const base64 = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function normalizeRecoveryCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function formatRecoveryCode(value) {
  return normalizeRecoveryCode(value).match(/.{1,4}/g)?.join('-') || '';
}

export function validateRecoveryCode(value) {
  const normalized = normalizeRecoveryCode(value);
  return normalized.length === RECOVERY_LENGTH
    && [...normalized].every((character) => RECOVERY_ALPHABET.includes(character));
}

export function generateRecoveryCode() {
  const random = crypto.getRandomValues(new Uint8Array(RECOVERY_LENGTH));
  const value = [...random].map((byte) => RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length]).join('');
  return formatRecoveryCode(value);
}

async function recoveryKey(recoveryCode) {
  const normalized = normalizeRecoveryCode(recoveryCode);
  if (!validateRecoveryCode(normalized)) throw new Error('恢复码格式不正确，请输入完整的32位恢复码。');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptWorkspaceSnapshot(snapshot, recoveryCode) {
  const key = await recoveryKey(recoveryCode);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(snapshot));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: AAD, tagLength: 128 },
    key,
    plaintext,
  );
  return {
    cipherVersion: SYNC_VERSION,
    algorithm: 'AES-GCM',
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
  };
}

export async function decryptWorkspaceSnapshot(encrypted, recoveryCode) {
  if (!encrypted || encrypted.cipherVersion !== SYNC_VERSION || encrypted.algorithm !== 'AES-GCM') {
    throw new Error('这份云端数据使用了当前版本不支持的加密格式。');
  }
  try {
    const key = await recoveryKey(recoveryCode);
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: base64UrlToBytes(encrypted.iv),
        additionalData: AAD,
        tagLength: 128,
      },
      key,
      base64UrlToBytes(encrypted.ciphertext),
    );
    return validateWorkspaceSnapshot(JSON.parse(new TextDecoder().decode(plaintext)));
  } catch (error) {
    if (error?.message?.includes('不支持')) throw error;
    throw new Error('恢复码不正确，或云端密文已经损坏。');
  }
}

export function validateWorkspaceSnapshot(snapshot) {
  if (!snapshot || snapshot.app !== '上节好课教师工作台' || snapshot.syncVersion !== SYNC_VERSION) {
    throw new Error('云端数据不是有效的教师工作台加密快照。');
  }
  if (!snapshot.stores || typeof snapshot.stores !== 'object') throw new Error('云端数据结构不完整。');
  for (const storeName of WORKSPACE_STORES) {
    const records = snapshot.stores[storeName];
    if (!Array.isArray(records) || records.length > 200_000) {
      throw new Error(`云端数据中的${storeName}记录不完整。`);
    }
    const ids = new Set();
    for (const record of records) {
      if (!record || typeof record !== 'object' || Array.isArray(record) || record.id == null) {
        throw new Error(`云端数据中的${storeName}记录缺少有效ID。`);
      }
      const id = `${typeof record.id}:${record.id}`;
      if (ids.has(id)) throw new Error(`云端数据中的${storeName}存在重复记录。`);
      ids.add(id);
    }
  }
  return snapshot;
}

function openWorkspaceDatabase(databaseName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, WORKSPACE_DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      WORKSPACE_STORES.forEach((storeName) => {
        if (!database.objectStoreNames.contains(storeName)) {
          database.createObjectStore(storeName, { keyPath: 'id' });
        }
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function allFromStore(database, storeName) {
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function schoolWeekKey(userId) {
  return `sjhk-workspace-school-week:${userId}`;
}

export async function readWorkspaceSnapshot(databaseName, userId = '') {
  const database = await openWorkspaceDatabase(databaseName);
  try {
    const groups = await Promise.all(WORKSPACE_STORES.map((storeName) => allFromStore(database, storeName)));
    const stores = Object.fromEntries(WORKSPACE_STORES.map((storeName, index) => [storeName, groups[index]]));
    return validateWorkspaceSnapshot({
      app: '上节好课教师工作台',
      syncVersion: SYNC_VERSION,
      databaseVersion: WORKSPACE_DB_VERSION,
      stores,
      settings: {
        schoolWeek: userId ? localStorage.getItem(schoolWeekKey(userId)) : null,
      },
    });
  } finally {
    database.close();
  }
}

export async function replaceWorkspaceWithSnapshot(databaseName, snapshot, userId = '') {
  const normalized = validateWorkspaceSnapshot(snapshot);
  const database = await openWorkspaceDatabase(databaseName);
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(WORKSPACE_STORES, 'readwrite');
      try {
        WORKSPACE_STORES.forEach((storeName) => {
          const store = transaction.objectStore(storeName);
          store.clear();
          normalized.stores[storeName].forEach((record) => store.put(record));
        });
      } catch (error) {
        transaction.abort();
        reject(error);
        return;
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('恢复事务已取消。'));
    });
    if (userId) {
      const value = normalized.settings?.schoolWeek;
      if (value) localStorage.setItem(schoolWeekKey(userId), value);
      else localStorage.removeItem(schoolWeekKey(userId));
    }
  } finally {
    database.close();
  }
}

async function snapshotHash(snapshot) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(snapshot)));
  return bytesToBase64Url(new Uint8Array(digest));
}

function openKeyDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(KEY_DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(KEY_STORE)) {
        request.result.createObjectStore(KEY_STORE, { keyPath: 'userId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storedRecoveryCode(userId) {
  const database = await openKeyDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(KEY_STORE, 'readonly').objectStore(KEY_STORE).get(userId);
      request.onsuccess = () => resolve(request.result?.recoveryCode || '');
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

async function saveRecoveryCode(userId, recoveryCode) {
  const normalized = formatRecoveryCode(recoveryCode);
  const database = await openKeyDatabase();
  try {
    await new Promise((resolve, reject) => {
      const request = database.transaction(KEY_STORE, 'readwrite').objectStore(KEY_STORE).put({
        userId,
        recoveryCode: normalized,
        savedAt: new Date().toISOString(),
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

function deviceId(userId) {
  const key = `sjhk-e2ee-device:${userId}`;
  let value = localStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(key, value);
  }
  return value;
}

function stateKey(userId) {
  return `sjhk-e2ee-sync-state:${userId}`;
}

function readState(userId) {
  try {
    return JSON.parse(localStorage.getItem(stateKey(userId)) || '{}');
  } catch {
    return {};
  }
}

function writeState(userId, patch) {
  const next = { ...readState(userId), ...patch };
  localStorage.setItem(stateKey(userId), JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('teacher-workspace-sync-state', { detail: next }));
  return next;
}

function localSummary(snapshot) {
  return {
    classes: snapshot.stores.classes.length,
    students: snapshot.stores.students.length,
    homeworks: snapshot.stores.homeworks.length,
    judgements: snapshot.stores.judgements.length,
  };
}

export class EncryptedSyncManager {
  constructor(access = window.TeacherWorkspaceAccess) {
    this.access = access;
    this.timer = null;
    this.running = false;
    this.started = false;
  }

  async context() {
    await this.access?.ready;
    const session = this.access?.session;
    if (!this.access?.isAuthorized || !session?.authenticated || !session.user?.id) {
      throw new Error('请先登录有效的会员账号。');
    }
    return {
      userId: session.user.id,
      databaseName: this.access.databaseName,
      deviceId: deviceId(session.user.id),
    };
  }

  async status() {
    const context = await this.context();
    const [remote, recoveryCode] = await Promise.all([
      api('/sync/status'),
      storedRecoveryCode(context.userId),
    ]);
    return {
      ...remote,
      deviceReady: Boolean(recoveryCode),
      localState: readState(context.userId),
    };
  }

  async getRecoveryCode() {
    const { userId } = await this.context();
    return storedRecoveryCode(userId);
  }

  async enable() {
    const context = await this.context();
    const remote = await api('/sync/status');
    if (remote.enabled) throw new Error('这个账号已经有云端加密数据，请输入原恢复码。');
    const recoveryCode = generateRecoveryCode();
    const snapshot = await readWorkspaceSnapshot(context.databaseName, context.userId);
    const hash = await snapshotHash(snapshot);
    const encrypted = await encryptWorkspaceSnapshot(snapshot, recoveryCode);
    const result = await api('/sync/snapshot', {
      method: 'PUT',
      body: JSON.stringify({ baseRevision: 0, deviceId: context.deviceId, encrypted }),
    });
    await saveRecoveryCode(context.userId, recoveryCode);
    writeState(context.userId, {
      revision: result.revision,
      lastHash: hash,
      lastSyncAt: result.updatedAt,
      remoteUpdatedAt: result.updatedAt,
      status: 'synced',
      error: '',
    });
    return { recoveryCode, ...result, summary: localSummary(snapshot) };
  }

  async restore(recoveryCode) {
    const context = await this.context();
    const remote = await api('/sync/snapshot');
    const snapshot = await decryptWorkspaceSnapshot(remote.encrypted, recoveryCode);
    await replaceWorkspaceWithSnapshot(context.databaseName, snapshot, context.userId);
    await saveRecoveryCode(context.userId, recoveryCode);
    const hash = await snapshotHash(snapshot);
    writeState(context.userId, {
      revision: remote.revision,
      lastHash: hash,
      lastSyncAt: new Date().toISOString(),
      remoteUpdatedAt: remote.updatedAt,
      status: 'synced',
      error: '',
    });
    return { ...remote, summary: localSummary(snapshot) };
  }

  async upload({ force = false, recoveryCode = '' } = {}) {
    const context = await this.context();
    const code = recoveryCode || await storedRecoveryCode(context.userId);
    if (!code) throw new Error('当前设备还没有恢复码。');
    const remote = await api('/sync/status');
    const state = readState(context.userId);
    if (!force && remote.revision !== Number(state.revision || 0)) {
      writeState(context.userId, { status: 'conflict', remoteUpdatedAt: remote.updatedAt });
      throw Object.assign(new Error('云端已有其他设备的新版本，请先处理同步冲突。'), { code: 'SYNC_CONFLICT' });
    }
    const snapshot = await readWorkspaceSnapshot(context.databaseName, context.userId);
    const hash = await snapshotHash(snapshot);
    const encrypted = await encryptWorkspaceSnapshot(snapshot, code);
    const result = await api('/sync/snapshot', {
      method: 'PUT',
      body: JSON.stringify({
        baseRevision: remote.revision,
        deviceId: context.deviceId,
        encrypted,
      }),
    });
    if (recoveryCode) await saveRecoveryCode(context.userId, recoveryCode);
    writeState(context.userId, {
      revision: result.revision,
      lastHash: hash,
      lastSyncAt: result.updatedAt,
      remoteUpdatedAt: result.updatedAt,
      status: 'synced',
      error: '',
    });
    return { ...result, summary: localSummary(snapshot) };
  }

  async rotateRecoveryCode() {
    const newCode = generateRecoveryCode();
    const result = await this.upload({ force: true, recoveryCode: newCode });
    return { ...result, recoveryCode: newCode };
  }

  async useCloudVersion() {
    const code = await this.getRecoveryCode();
    if (!code) throw new Error('请先输入恢复码。');
    return this.restore(code);
  }

  async syncNow() {
    if (this.running || !navigator.onLine) return null;
    this.running = true;
    try {
      const context = await this.context();
      const code = await storedRecoveryCode(context.userId);
      const remote = await api('/sync/status');
      if (!code) {
        if (remote.enabled) writeState(context.userId, { status: 'recovery-required', remoteUpdatedAt: remote.updatedAt });
        return remote;
      }
      const snapshot = await readWorkspaceSnapshot(context.databaseName, context.userId);
      const hash = await snapshotHash(snapshot);
      const state = readState(context.userId);
      if (!remote.enabled) return this.upload({ recoveryCode: code });
      const remoteChanged = remote.revision !== Number(state.revision || 0);
      const localChanged = state.lastHash ? state.lastHash !== hash : false;
      if (remoteChanged && localChanged) {
        writeState(context.userId, {
          status: 'conflict',
          remoteUpdatedAt: remote.updatedAt,
          error: '本机和云端都有新修改',
        });
        return { ...remote, conflict: true };
      }
      if (remoteChanged) {
        await this.restore(code);
        window.dispatchEvent(new CustomEvent('teacher-workspace-sync-restored'));
        if (!location.pathname.endsWith('/profile.html')) location.reload();
        return { ...remote, downloaded: true };
      }
      if (localChanged) return this.upload();
      writeState(context.userId, {
        revision: remote.revision,
        lastHash: hash,
        lastSyncAt: state.lastSyncAt || remote.updatedAt,
        remoteUpdatedAt: remote.updatedAt,
        status: 'synced',
        error: '',
      });
      return remote;
    } catch (error) {
      try {
        const { userId } = await this.context();
        writeState(userId, {
          status: error.code === 'SYNC_CONFLICT' ? 'conflict' : 'error',
          error: error.message || '同步失败',
        });
      } catch {
        // 未登录或授权失效时不写入同步状态。
      }
      throw error;
    } finally {
      this.running = false;
    }
  }

  schedule(delay = 2500) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.syncNow().catch(() => undefined), delay);
  }

  async start() {
    if (this.started) return this;
    this.started = true;
    await this.access?.ready;
    if (!this.access?.isAuthorized) return this;
    this.schedule(1600);
    window.addEventListener('online', () => this.schedule(500));
    window.addEventListener('teacher-workspace-data-changed', () => this.schedule());
    document.addEventListener('change', () => this.schedule(3500), true);
    document.addEventListener('pointerup', () => this.schedule(5000), true);
    setInterval(() => {
      if (document.visibilityState === 'visible') this.schedule(200);
    }, SYNC_INTERVAL);
    return this;
  }
}

export function encryptedSyncManager() {
  singleton ||= new EncryptedSyncManager();
  return singleton;
}

export async function startEncryptedAutoSync() {
  return encryptedSyncManager().start();
}
