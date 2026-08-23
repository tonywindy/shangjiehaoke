import assert from 'node:assert/strict';
import test from 'node:test';

import {
  hashPepperedPassword,
  hashPassword,
  verifyPassword,
  verifyPepperedPassword,
} from '../../worker/src/auth.ts';

test('工作台密码使用带随机盐的 PBKDF2 慢哈希', async () => {
  const first = await hashPepperedPassword('Teacher2026', 'server-pepper');
  const second = await hashPepperedPassword('Teacher2026', 'server-pepper');

  assert.match(first, /^pbkdf2_sha256\$100000\$/);
  assert.notEqual(first, second);
  assert.equal(await verifyPepperedPassword('Teacher2026', first, 'server-pepper'), true);
  assert.equal(await verifyPepperedPassword('wrong-password', first, 'server-pepper'), false);
  assert.equal(await verifyPepperedPassword('Teacher2026', first, 'wrong-pepper'), false);
});

test('迁移前的 PBKDF2 管理员密码仍可验证', async () => {
  const legacyAdminHash = await hashPassword('Admin2026');

  assert.equal(await verifyPepperedPassword('Admin2026', legacyAdminHash, 'new-pepper'), true);
  assert.equal(await verifyPassword('Admin2026', legacyAdminHash), true);
});
