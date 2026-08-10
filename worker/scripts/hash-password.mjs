import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

const fromStdin = process.argv[2] === '--stdin';
const password = fromStdin ? readFileSync(0, 'utf8').replace(/[\r\n]+$/, '') : process.argv[2];
if (!password || password.length < 8 || password.length > 72 || !/[A-Za-z\u4e00-\u9fa5]/.test(password) || !/\d/.test(password)) {
  console.error('用法：npm run auth:hash -- "至少8位且同时包含字母和数字的密码"');
  console.error('更安全的输入方式：printf 密码 | npm run auth:hash -- --stdin');
  process.exit(1);
}

const iterations = 100_000;
const salt = randomBytes(16);
const digest = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
console.log(`pbkdf2_sha256$${iterations}$${salt.toString('base64url')}$${digest.toString('base64url')}`);
