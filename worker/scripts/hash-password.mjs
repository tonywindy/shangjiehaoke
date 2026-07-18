import { createHash } from 'node:crypto';

const password = process.argv[2];
if (!password || password.length < 12) {
  console.error('用法：npm run auth:hash -- "至少12位的新密码"');
  process.exit(1);
}

const digest = createHash('sha256').update(password, 'utf8').digest('base64url');
console.log(`sha256$${digest}`);
