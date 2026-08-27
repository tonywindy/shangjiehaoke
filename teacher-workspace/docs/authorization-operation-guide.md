# 教师工作台授权系统使用说明

## 页面入口

- 产品介绍：`https://shangjiehaoke.com/teacher-workspace/`
- 用户注册 / 登录 / 续费 / 改密：`https://shangjiehaoke.com/teacher-workspace/account.html`
- 管理员后台：`https://shangjiehaoke.com/teacher-workspace/admin.html`
- 使用协议与隐私说明：`https://shangjiehaoke.com/teacher-workspace/terms.html`
- 授权 API 健康检查：`https://api.shangjiehaoke.com/api/workspace/health`

## 管理员首次登录

管理员用户名在 `worker/wrangler.jsonc` 的 `WORKSPACE_ADMIN_USERNAME` 中配置；初始密码摘要必须通过 Cloudflare Secret 设置，不能写在文件里。

首次登录后页面会强制跳到账号页修改初始密码。在完成改密前，所有管理员接口都会返回 `PASSWORD_CHANGE_REQUIRED`，不能生成授权码或管理账号。

## 日常发放授权

1. 登录管理后台。
2. 选择数量、授权类型、有效天数和授权码注册期限。
3. 点击“生成授权码”。
4. 立即复制完整授权码并通过私信发给用户。
5. 用户在账号页选择“授权码注册”，阅读并同意协议后完成注册。

## 管理员 AI 功能

工作台中的 MiMo AI 智能整理、今日小结、任务解析、阶段回顾和学情建议目前只对管理员账号开放。普通授权账号不显示入口，服务端接口也会再次校验管理员角色。

- 模型：小米 `mimo-v2.5`
- 密钥：仅通过 Cloudflare Secret `MIMO_API_KEY` 配置，不写入仓库
- 学生姓名：调用前在浏览器中替换为匿名代号，返回后仅在本机还原
- 写入原则：AI 只生成草稿；记录和任务必须由管理员确认后才写入本机数据库
- 学情原则：AI 只提供建议，不自动修改知识矩阵中的掌握状态

完整授权码只在生成当次返回。D1 只保存带 Secret 保护的摘要和短前缀，刷新后台后无法找回完整号码。

## 续费、停用和忘记密码

- 续费：用户登录账号页，在“续费或重新授权”中输入新授权码。
- 撤销授权：在授权码列表点击“停用”。对应用户现有会话会退出。
- 停用账号：在账号列表点击“停用账号”。该用户所有会话立即失效。
- 忘记密码：管理员点击“重置密码”，设置一个临时密码；用户用临时密码登录后必须马上修改。
- 管理员密码：管理员在账号页自行修改，不能通过普通用户的重置按钮处理。

## 数据边界和用户告知

账号与授权保存在 Cloudflare D1。教学数据优先保存在教师浏览器本机；会员主动开启后，浏览器会先用恢复码完成端到端加密，再把密文同步到云端。销售说明、介绍页、注册确认和协议页都必须明确：

- 未开启加密同步时，换电脑前仍需导出备份；
- 开启加密同步后，新电脑登录同一账号并输入一次恢复码即可自动同步；
- 恢复码不会上传，平台无法代为找回；
- 清除浏览器网站数据会删除本机教学记录；
- 备份 JSON 可能含学生姓名和学情，应妥善保存；
- 授权版需要定期联网核验。

## Cloudflare 部署

在 `worker` 目录执行：

```bash
npm run check
npm run db:auth:migrate:remote
npm run deploy
```

需要的 Worker Secrets：

- `WORKSPACE_ADMIN_PASSWORD_HASH`
- `WORKSPACE_SESSION_SECRET`
- `WORKSPACE_LICENSE_PEPPER`
- `WORKSPACE_PASSWORD_PEPPER`
- `MIMO_API_KEY`

可用 `npm run auth:hash -- --stdin` 生成兼容摘要。Secret 更新后再执行一次 `npm run deploy`，保证最新代码版本使用新 Secret。

## 备份与恢复

- 授权 D1 使用 Cloudflare D1 Time Travel 制定恢复方案，并定期演练。
- 教师教学数据不在 D1 中，仍依赖工作台的“导出备份—恢复备份”。
- 覆盖当前班级时，删除和写入在一个 IndexedDB 事务中完成；恢复前仍建议先导出现有备份。
