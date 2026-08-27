import assert from 'node:assert/strict';
import test from 'node:test';

import {
  decryptWorkspaceSnapshot,
  encryptWorkspaceSnapshot,
  formatRecoveryCode,
  generateRecoveryCode,
  normalizeRecoveryCode,
  validateRecoveryCode,
  validateWorkspaceSnapshot,
} from '../../teacher-workspace/encrypted-sync.js';

function snapshotFixture() {
  const stores = Object.fromEntries([
    'meta', 'classes', 'students', 'kps', 'judgements', 'questionSets',
    'questionSetUses', 'reasonTemplates', 'homeworks', 'homeworkEntries',
    'followupTasks', 'notes',
  ].map((store) => [store, []]));
  stores.classes.push({ id: 'class-a', name: '测试班级' });
  stores.students.push({ id: 'student-a', classId: 'class-a', name: '测试学生' });
  return {
    app: '上节好课教师工作台',
    syncVersion: 1,
    databaseVersion: 5,
    stores,
    settings: { schoolWeek: null },
  };
}

test('恢复码生成、格式化和校验使用同一规则', () => {
  const code = generateRecoveryCode();
  assert.equal(code.split('-').length, 8);
  assert.equal(normalizeRecoveryCode(code).length, 32);
  assert.equal(validateRecoveryCode(code), true);
  assert.equal(formatRecoveryCode(normalizeRecoveryCode(code)), code);
  assert.equal(validateRecoveryCode('1234'), false);
});

test('工作台快照可端到端加密并用同一恢复码解密', async () => {
  const code = generateRecoveryCode();
  const source = snapshotFixture();
  const encrypted = await encryptWorkspaceSnapshot(source, code);
  assert.equal(encrypted.algorithm, 'AES-GCM');
  assert.equal(JSON.stringify(encrypted).includes('测试学生'), false);
  assert.deepEqual(await decryptWorkspaceSnapshot(encrypted, code), source);
});

test('错误恢复码无法解密云端密文', async () => {
  const encrypted = await encryptWorkspaceSnapshot(snapshotFixture(), generateRecoveryCode());
  await assert.rejects(
    decryptWorkspaceSnapshot(encrypted, generateRecoveryCode()),
    /恢复码不正确|密文已经损坏/,
  );
});

test('快照校验拒绝重复记录', () => {
  const snapshot = snapshotFixture();
  snapshot.stores.students.push({ id: 'student-a', classId: 'class-a', name: '重复学生' });
  assert.throws(() => validateWorkspaceSnapshot(snapshot), /重复记录/);
});
