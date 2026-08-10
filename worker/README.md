# 上节好课 AI API

AI小学数学精准教学助手的 Cloudflare Worker 后端。

同一个 Worker 还承载教师工作台的账号与授权接口，但使用独立的 `AUTH_DB`，不会与 AI 教学业务的 `DB` 混表。

## 当前接口

- `GET /api/health`：服务健康检查
- `GET /api/config`：V1 年级、单元与知识点配置
- `GET /api/db/health`：D1 数据库连接检查
- `GET /api/ai/health`：GLM配置状态检查（不会暴露密钥）
- `POST /api/diagnoses/analyze`：上传作品图片并调用 GLM-4.6V-FlashX 生成初步诊断

### 教师工作台授权接口

- `GET /api/workspace/health`
- `GET /api/workspace/auth/session`
- `POST /api/workspace/auth/register`
- `POST /api/workspace/auth/login`
- `POST /api/workspace/auth/logout`
- `POST /api/workspace/auth/change-password`
- `POST /api/workspace/auth/renew`
- `GET /api/workspace/admin/overview`
- `GET|POST /api/workspace/admin/licenses`
- `POST /api/workspace/admin/licenses/:id/revoke`
- `GET /api/workspace/admin/users`
- `POST /api/workspace/admin/users/:id/status`
- `POST /api/workspace/admin/users/:id/password`

## 本地开发

```bash
npm install
npm run dev
```

默认访问地址：`http://127.0.0.1:8787`。

首次启动前，在本地应用数据库迁移：

```bash
npm run db:migrate:local
npm run db:auth:migrate:local
```

本地调试 AI 接口时，在 `worker/.dev.vars` 中配置 `GLM_API_KEY` 和
`RATE_LIMIT_SALT`；正式环境使用 Cloudflare Secret，不要把密钥提交到 Git。

工作台授权还需要在 `.dev.vars` / Cloudflare Secrets 中配置：

- `WORKSPACE_ADMIN_PASSWORD_HASH`
- `WORKSPACE_SESSION_SECRET`
- `WORKSPACE_LICENSE_PEPPER`
- `WORKSPACE_PASSWORD_PEPPER`

远程授权数据库迁移：

```bash
npm run db:auth:migrate:remote
```

## 安全约定

- AI密钥只通过 Cloudflare Secret 保存，不写入代码。
- 图片限制为 5MB，支持 JPG、PNG、WEBP；AI分析完成后 Worker 不留存原图。
- 未登录演示阶段按匿名客户端每日 50 次、全站每日 500 次限制调用。
- 学生作品使用匿名编号，不在文件名或接口参数中保存真实姓名。
- 正式环境只允许 `shangjiehaoke.com` 及其受控子域访问。
- 教师工作台的学生、座位、作业与学情数据不进入 `AUTH_DB`；它们保存在教师浏览器本机。
- 管理员初始密码只通过 Secret 注入，首次登录必须修改。
