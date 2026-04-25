# Cloudflare Pages + Supabase 部署教程

> **King & Angel · 信笺与封缄** 项目
> 适用：Next.js 16 (App Router) + React 19 + Supabase
> 架构：前端 / SSR 跑在 Cloudflare Pages（免费 + 全球 CDN），数据库与认证用 Supabase（免费版足够）

> ⚙️ **当前仓库默认是 4 人测试版**（4 人 + 12 心愿 + 3 人揭示）。
> 部署完成后想切到 15 人正式版，请按 [§Part 8 切换活动规模](#part-8--切换活动规模) 操作。

---

## 总览：你将得到什么

| 角色 | 服务商 | 价格 |
|---|---|---|
| 前端 + Server Actions + Server Components | **Cloudflare Pages** | 免费（每月 500 build / 100k 请求） |
| Postgres 数据库 + Auth + RLS | **Supabase** | 免费（500 MB DB / 50k MAU） |
| 自定义域名（可选） | Cloudflare DNS | 免费 |

部署后：每次 `git push origin main` → Cloudflare 自动 build → 全球可访问。

---

## Part 0 · 一次性准备工作

### 0.1 你需要的账号

- [ ] **GitHub** 账号（项目已经在 https://github.com/WishingCat/king-and-angel）
- [ ] **Supabase** 账号 https://supabase.com（用 GitHub 登录最方便）
- [ ] **Cloudflare** 账号 https://dash.cloudflare.com（用邮箱注册）

### 0.2 本地需要的命令行工具

```bash
node -v   # 应 ≥ 20
npm -v    # 应 ≥ 10
git --version
```

---

## Part 1 · 在 Supabase 上建好数据库

> 这一步给你的项目准备一个**真实的、可对外提供服务的 Postgres 数据库**。

### 1.1 创建项目

1. 登录 https://supabase.com → 右上角 **New project**
2. Organization 选自己的，Region 选 **Northeast Asia (Tokyo)** 或 **Southeast Asia (Singapore)**——离中国大陆最近
3. **Project name**: `king-and-angel`（随意）
4. **Database password**: 系统生成一个强密码 → 复制保存到密码管理器
5. **Pricing plan**: Free
6. 点 **Create new project**，等待约 2 分钟初始化

### 1.2 跑两份 SQL 迁移

项目里有两份 SQL 文件，**必须按顺序执行**：

1. Supabase 项目左侧菜单 → **SQL Editor** → **New query**
2. 打开本地 `sql/01_schema.sql`，把全部内容复制粘贴到 Supabase 的 SQL Editor 里
3. 点右下角 **Run**（或 ⌘+↵）；看到底部显示 "Success. No rows returned" 就好
4. **新开一个 New query**
5. 打开 `sql/02_e2e_schema.sql`，全部复制粘贴 → Run
6. 同样应该看到 Success

> 这两份脚本会建好：`profiles`、`invites`、`pre_seal_wishes`、`tasks`、`public_messages`、`seal_state`、`angel_envelopes`、`sealed_pairing` 等所有表，加上 RLS 策略和 `claim_task / complete_task / publish_seal` 三个 RPC。

### 1.3 关闭邮箱确认（测试期）

1. 左侧菜单 → **Authentication** → **Providers**
2. 找到 **Email**，点开
3. **Confirm email** 关闭（OFF）
4. **Save**

> 这样**测试版的 4 个同学**注册后立刻能登录，不必等收邮件。正式活动前可以再打开。

### 1.4 录入参与者邀请码

**测试版**：`sql/01_schema.sql` 末尾已经预置 4 个测试邀请码：

| 邀请码 | 姓名 | 是管理员 |
|---|---|---|
| `ADMIN` | 文建负责人 | ✅ |
| `A1001` | 张三 | |
| `A1002` | 李四 | |
| `A1003` | 王五 | |

如果你只是要做 4 人测试，**不需要改任何邀请码**——把 `01_schema.sql` 整段执行就好。要改成 4 个朋友的真名也很简单：

```sql
update invites set display_name = '小明' where code = 'A1001';
update invites set display_name = '小红' where code = 'A1002';
-- ...
```

**正式版**：把示例 4 个换成你们活动的 15 个真实名单，其中 2 个 `can_admin = true`：

```sql
insert into public.invites (code, display_name, can_admin) values
  ('K001', '张三', true),
  ('K002', '李四', true),
  ('K003', '王五', false),
  ('K004', '赵六', false),
  -- ... 一共 15 行
  ('K015', '小红', false)
on conflict (code) do nothing;
```

把 2 个 `can_admin = true` 留给负责人。在 SQL Editor 里执行。

### 1.5 抄下 3 个关键凭据（部署 Cloudflare 时要用）

左侧菜单 → **Project Settings** → **API**

| 凭据 | 在哪里 | 备注 |
|---|---|---|
| **Project URL** | 顶部 `https://xxxxx.supabase.co` | 公开，前端会用 |
| **anon key** | Project API keys → `anon` `public` | 公开，前端会用 |
| **service_role key** | Project API keys → `service_role` `secret` | **绝密**，只在服务端用 |

把这三个值写到一张纸上或密码管理器里，下一步要用。

---

## Part 2 · 让项目兼容 Cloudflare Pages（小改动）

> Cloudflare Pages 默认跑在 **Edge Runtime** 上，与 Next.js 默认的 Node.js Runtime 有差异。我们用官方适配器 `@cloudflare/next-on-pages` 把 Next.js 输出转成 Pages 能跑的格式。

### 2.1 装两个开发依赖

```bash
cd /Users/wishingcat/Projects/king_angel_yongchun_app
npm install --save-dev @cloudflare/next-on-pages wrangler
```

### 2.2 在 `package.json` 加三个脚本

`package.json` 的 `"scripts"` 部分追加：

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "pages:build": "npx @cloudflare/next-on-pages",
    "pages:preview": "npm run pages:build && npx wrangler pages dev .vercel/output/static --compatibility-flag=nodejs_compat",
    "pages:deploy": "npm run pages:build && npx wrangler pages deploy .vercel/output/static --compatibility-flag=nodejs_compat"
  }
}
```

### 2.3 给所有 Server Action / Route 文件加 Edge runtime 声明

> 这一步是**最容易漏的**——Next.js Server Actions 默认是 Node runtime，Cloudflare Pages 不支持。每个文件顶部要加一行 `export const runtime = "edge"`。

需要加的文件：

```
app/page.tsx
app/auth/page.tsx
app/auth/actions.ts
app/dashboard/page.tsx
app/dashboard/actions.ts
app/admin/seal/page.tsx
app/admin/seal/actions.ts
app/reveal/page.tsx
```

每个文件最顶部（`"use server"` 或第一个 `import` 之前/之后都行）加：

```ts
export const runtime = "edge";
```

> **注意**：`"use client"` 文件**不需要**加这行（它们跑在浏览器里）。

### 2.4 创建 `wrangler.toml`

项目根目录创建 `wrangler.toml`：

```toml
name = "king-and-angel"
compatibility_date = "2026-04-25"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = ".vercel/output/static"
```

### 2.5 本地验证 Pages build

```bash
npm run pages:build
```

第一次会比较慢（30-60 秒），看到 `⚡️ Build complete!` 就成功。

如果失败，最常见原因：
- 某个文件忘了加 `export const runtime = "edge"`
- `lib/supabase/admin.ts` 里用了 Node 专用 API（实际上没有，应该 OK）

### 2.6 提交这些改动

```bash
git add -A
git commit -m "Configure project for Cloudflare Pages deployment"
git push
```

---

## Part 3 · 部署到 Cloudflare Pages

### 3.1 创建 Pages 项目

1. 登录 https://dash.cloudflare.com
2. 左侧菜单 → **Workers & Pages** → **Create**
3. 选 **Pages** 标签 → **Connect to Git**
4. **Connect GitHub** → 授权 Cloudflare 访问你的 GitHub
5. 选择仓库 `WishingCat/king-and-angel` → **Begin setup**

### 3.2 Build 配置

| 字段 | 值 |
|---|---|
| Project name | `king-and-angel`（成 URL 的一部分：`king-and-angel.pages.dev`） |
| Production branch | `main` |
| Framework preset | **Next.js** |
| Build command | `npx @cloudflare/next-on-pages` |
| Build output directory | `.vercel/output/static` |
| Root directory | `/`（保持默认） |

### 3.3 环境变量（**部署前一定要先填好**）

往下滚到 **Environment variables (advanced)**，**Production** 和 **Preview** 都要填这 4 个：

| 变量名 | 值 | Type |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Part 1.5 里抄的 Project URL | Plaintext |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key | Plaintext |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | **Secret** ⚠️ |
| `NODE_VERSION` | `20` | Plaintext |

> **`SUPABASE_SERVICE_ROLE_KEY` 一定要选 Secret 类型**——它能绕过所有 RLS，泄露=灾难。

### 3.4 点 Save and Deploy

第一次 build 大约 2-4 分钟。完成后会拿到 `https://king-and-angel.pages.dev`。

### 3.5 必做：补上 Compatibility flag

第一次部署完成后还要做一个补充设置：

1. 在 Pages 项目页 → **Settings** → **Functions**
2. 找到 **Compatibility flags**
3. **Production** 和 **Preview** 都加上：`nodejs_compat`
4. **Save**
5. 回到 **Deployments** → 找最新一次 → 点右侧 `...` → **Retry deployment**

> 这一步必须做，否则 `crypto`、`buffer` 等 Node 内建模块会报错。

---

## Part 4 · 验证部署

打开 `https://king-and-angel.pages.dev`：

- [ ] **首页**能打开，看到「写一封没有署名的信」
- [ ] 点「持邀请码前来登记」→ 跳转到 `/auth`
- [ ] 用一个真实邀请码尝试注册 → 应跳回首页提示「注册成功」
- [ ] 用注册的邮箱密码登录 → 进 `/dashboard`
- [ ] 写 3 条心愿 → 保存成功
- [ ] 在留言板写一条留言 → 可见
- [ ] 在任务板上传一条任务 → 可见
- [ ] 用第二个无痕窗口注册另一个账号 → 能看到第一个人发的留言和任务

如果某一步失败，最常见原因和排查：

| 症状 | 可能原因 | 解决 |
|---|---|---|
| 首页 500 | 环境变量没填 / 名字写错 | Pages → Settings → Environment variables 检查 |
| 登录后跳回 `/auth` | Supabase URL 或 anon key 错 | 检查 NEXT_PUBLIC_ 开头的两个变量 |
| 注册时报「邀请码不存在」 | 没运行 SQL 或 invites 表为空 | 回 Supabase SQL Editor 检查 `select * from invites;` |
| `crypto.subtle is not a function` | 没开 `nodejs_compat` flag | 见 Part 3.5 |
| 任何 Server Action 500 | 文件没加 `export const runtime = "edge"` | 见 Part 2.3 |

---

## Part 5 · 自定义域名（可选）

如果你有自己的域名（比如 `angel.yourdomain.com`）：

1. Pages 项目 → **Custom domains** → **Set up a custom domain**
2. 输入域名 → Cloudflare 自动帮你建 DNS CNAME
3. 等 1-3 分钟证书签发完成
4. 用新域名访问验证

如果域名不在 Cloudflare DNS 上，Cloudflare 会给你一行 CNAME 让你去原 DNS 提供商手动加。

---

## Part 6 · 后续维护

### 6.1 日常更新

```bash
# 在本地改代码、测试
npm run dev

# 满意后推送 → Cloudflare 自动 build & deploy
git add -A
git commit -m "your message"
git push
```

每次 push 到 `main`，Cloudflare 自动重新部署，约 2-4 分钟。Pull Request 会自动生成 **Preview** 部署，每个 PR 一个独立 URL。

### 6.2 看部署日志

Pages 项目 → **Deployments** → 点任一次部署 → 看 build log 和 runtime log。

### 6.3 看运行时错误

Pages 项目 → **Functions** → **Real-time logs**——在线追踪 Server Action 调用。

### 6.4 回滚

某次部署出问题：**Deployments** → 找一个之前的好版本 → 右侧 `...` → **Rollback to this deployment**。

### 6.5 想重新做封缄

万一封缄出错，需要重新执行：在 Supabase SQL Editor 执行：

```sql
update public.seal_state set status = 'open', sealed_at = null where id = 1;
delete from public.angel_envelopes;
delete from public.sealed_pairing;
-- 注意：心愿已被销毁，所有人需要重新填一次
```

然后让 4 / 15 人重新填心愿，管理员重新去 `/admin/seal` 封缄。

---

## Part 7 · 安全自查清单（活动正式开始前）

- [ ] Supabase 控制台 → Auth → Confirm email **重新打开**（如果你想要邮箱确认）
- [ ] 4（测试）/ 15（正式）个邀请码都录入了，没有多余的测试码
- [ ] 测试期已经验证完毕，准备切到正式版的话见 [§Part 8](#part-8--切换活动规模)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` 在 Cloudflare 是 **Secret** 类型
- [ ] GitHub 仓库里**没有** `.env.local` 文件（应该在 `.gitignore` 里）
- [ ] 自定义域名（如果有）已经走 HTTPS
- [ ] Supabase 控制台 → Settings → API → 把 anon key 的 JWT expiry 设成合适的值（默认 1 小时即可）

---

## 常见问题

**Q：能完全不用 Supabase，全部跑在 Cloudflare 上吗？**
A：可以，但需要把 Supabase Auth 换成 Cloudflare Access、把 PostgreSQL 改成 Cloudflare D1（SQLite）、把 RLS 全部改写成应用层权限——大约 1-2 天工作量。当前项目的端到端加密设计本身和数据库无关，这部分完全不会变。如果将来要做这次迁移，可以再开一份新的部署文档。

**Q：Cloudflare Pages 的免费版够用吗？**
A：极度够用。免费版每月 100k 请求，4 人测试或 15 人正式跑一季活动撑死也用不到 1k。

**Q：Supabase 免费版会被睡眠吗？**
A：会。如果连续 7 天没有任何活动，免费版数据库会暂停。但只要任何一个用户访问一次就会自动恢复（约 30 秒）。活动期间天天有人登录就不会睡。

**Q：我能在本地用 production 的 Supabase 数据库测试吗？**
A：可以——把 Cloudflare 上填的那 3 个值复制到本地 `.env.local` 就行。**注意：这意味着你的本地操作会影响真实数据**。

**Q：怎么导出活动结束后的数据存档？**
A：Supabase 控制台 → Database → Backups 可以下载 SQL dump。或者在 SQL Editor 里 `select * from public_messages;` 然后导出 CSV。

---

## 附录 · 文件结构速查

```
king_angel_yongchun_app/
├── app/                       # Next.js 路由
│   ├── auth/                  # 注册 / 登录
│   ├── dashboard/             # 主控制台
│   ├── admin/seal/            # 封缄仪式（一次性）
│   ├── reveal/                # 揭示仪式（≥10 把钥匙）
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/                # 共享 UI（FormMessage / SubmitButton 等）
├── lib/
│   ├── crypto/                # AEAD / HKDF / Shamir / IndexedDB keystore
│   ├── supabase/              # browser / server / admin / middleware
│   ├── auth.ts
│   ├── dashboard.ts           # 数据加载
│   └── types.ts
├── sql/
│   ├── 01_schema.sql          # profiles + invites（基础表）
│   └── 02_e2e_schema.sql      # 加密版业务表 + RPC（含 publish_seal）
├── middleware.ts              # Supabase 会话 cookie 刷新
├── next.config.ts
├── package.json
├── tsconfig.json
├── wrangler.toml              # ← 部署时新增
└── README.md
```

---

## Part 8 · 切换活动规模（4 人测试版 ↔ 15 人正式版）

当前仓库默认是 **4 人测试版**（n=4, k=3）。测试完成后想切到 **15 人正式版**（n=15, k=10），需要改 3 处：

### 8.1 代码：`lib/config.ts`

```ts
export const PARTICIPANT_TOTAL = 15;  // 从 4 改成 15
export const REVEAL_THRESHOLD  = 10;  // 从 3 改成 10
```

### 8.2 数据库：`sql/02_e2e_schema.sql` 的 `publish_seal` RPC

找到 `create or replace function public.publish_seal(...)` 块，把第一行常量改成：

```sql
expected_total constant int := 15;  -- 从 4 改成 15
```

然后在 Supabase SQL Editor 里**重新执行整个 `create or replace function publish_seal(...) ... end; $$;` 块**（约 60 行）。

### 8.3 邀请码：`sql/01_schema.sql` 末尾

把测试用的 4 个邀请码换成 15 个真实名单（见 Part 1.4）。

### 8.4 清理测试数据（可选）

如果数据库里已经有测试账号和测试心愿，想清空重来：

```sql
-- 清空业务数据
delete from public.angel_envelopes;
delete from public.sealed_pairing;
delete from public.pre_seal_wishes;
delete from public.public_messages;
delete from public.tasks;
update public.seal_state set status='open', sealed_at=null where id=1;

-- 清空测试账号（谨慎！会删除所有用户）
delete from auth.users;
delete from public.profiles;

-- 清空旧邀请码
delete from public.invites;
```

然后重新执行 8.3 的 15 个邀请码 insert。

### 8.5 推送 + 重新部署

```bash
git add lib/config.ts sql/02_e2e_schema.sql sql/01_schema.sql
git commit -m "Switch to 15-person production config"
git push
```

Cloudflare Pages 会自动重新 build（约 2-4 分钟）。部署完成后：
- 首页会显示 "15 位同行者都到齐"
- 封缄页会显示 "15 位齐聚 · 45 条心愿齐备"
- 揭示页会要求 "≥10 把钥匙"

### 8.6 参数约束

- `REVEAL_THRESHOLD` 必须 ≥ 2
- `REVEAL_THRESHOLD` 必须 ≤ `PARTICIPANT_TOTAL`
- 推荐 `REVEAL_THRESHOLD ≈ ⌈PARTICIPANT_TOTAL × 2/3⌉`：既有意义（难以合谋提前揭示），又留容错（允许丢失几份 share）
