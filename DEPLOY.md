# 部署教程 · Cloudflare + Supabase

> **King & Angel · 信笺与封缄** — 用 [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) 把 Next.js 16 部署到 Cloudflare Workers，数据库与认证用 Supabase 免费版。

> ⚙️ **当前仓库默认是 4 人测试版**（4 人 + 12 心愿 + 3 人揭示）。
> 部署完成后想切到 15 人正式版，请按 [§Part 4 切换活动规模](#part-4--切换活动规模) 操作。

---

## 总览

| 角色 | 服务商 | 价格 |
|---|---|---|
| 前端 + Server Actions + Server Components | **Cloudflare Workers** | 免费版（每天 10 万请求） |
| Postgres 数据库 + Auth + RLS | **Supabase** | 免费版（500 MB DB / 50k MAU） |
| 自定义域名（可选） | Cloudflare DNS | 免费 |

部署完成后：每次 `git push origin main` → Cloudflare 自动 build → 全球可访问。

**整个部署流程只有两步，约 10 分钟。** 不需要修改任何代码文件，不需要在控制台手动勾 compatibility flag。

---

## Part 1 · Supabase（5 分钟）

### 1.1 创建项目

1. 登录 https://supabase.com → **New project**
2. Region 选 **Northeast Asia (Tokyo)** 或 **Southeast Asia (Singapore)**
3. **Project name**: 随意（如 `king-and-angel`）
4. **Database password**: 系统生成 → 复制存好
5. Pricing: Free → **Create**（约 2 分钟初始化）

### 1.2 跑两份 SQL 迁移

1. 左侧 **SQL Editor** → **New query**
2. 复制 `sql/01_schema.sql` 全部内容 → 粘贴 → **Run**
3. 再 **New query**
4. 复制 `sql/02_e2e_schema.sql` 全部内容 → 粘贴 → **Run**

> 这两份会建好所有业务表 + RLS 策略 + `claim_task / complete_task / publish_seal` 三个 RPC。

### 1.3 关闭邮箱确认（测试期）

**Authentication** → **Providers** → **Email** → 关闭 **Confirm email** → **Save**

> 这样测试期注册后立刻能登录，不必等收邮件。正式活动前可以再打开。

### 1.4 邀请码

`sql/01_schema.sql` 末尾已预置 4 个测试邀请码：

| 邀请码 | 姓名 | 是管理员 |
|---|---|---|
| `ADMIN` | 文建负责人 | ✅ |
| `A1001` | 张三 | |
| `A1002` | 李四 | |
| `A1003` | 王五 | |

想换成 4 个真名：

```sql
update invites set display_name = '小明' where code = 'A1001';
```

正式版（15 人）的邀请码改造见 [§Part 4](#part-4--切换活动规模)。

### 1.5 抄下 3 个凭据

**Project Settings** → **API**：

| 凭据 | 用途 |
|---|---|
| **Project URL** | `NEXT_PUBLIC_SUPABASE_URL` |
| **anon key** | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **service_role key** | `SUPABASE_SERVICE_ROLE_KEY`（**绝密**，只在服务端用） |

---

## Part 2 · Cloudflare Workers（5 分钟）

### 2.1 创建项目

1. 登录 https://dash.cloudflare.com
2. **Workers & Pages** → **Create**
3. 选 **Pages** 标签 → **Connect to Git**
4. 授权访问 GitHub → 选仓库 `WishingCat/king-and-angel`

### 2.2 Build 配置

| 字段 | 值 |
|---|---|
| Project name | `king-and-angel`（成 URL 一部分：`king-and-angel.pages.dev`） |
| Production branch | `main` |
| Framework preset | **Next.js** |
| Build command | `npx opennextjs-cloudflare build` |
| Build output directory | `.open-next/assets` |

### 2.3 环境变量

往下滚到 **Environment variables**，**Production** 和 **Preview** 都填这 4 个：

| 变量名 | 值 | 类型 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Part 1.5 抄的 URL | Plaintext |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key | Plaintext |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | **Secret** ⚠️ |
| `NODE_VERSION` | `20` | Plaintext |

> **`SUPABASE_SERVICE_ROLE_KEY` 一定要选 Secret 类型**——它能绕过所有 RLS，泄露 = 灾难。

### 2.4 Save and Deploy

点击 **Save and Deploy**。第一次 build 约 2-4 分钟。完成后会拿到 `https://king-and-angel.pages.dev`。

> ✨ **不需要**：手动加 `nodejs_compat` flag、不需要在每个文件加 `export const runtime = "edge"`、不需要修改任何代码文件。
> 这些都已经在仓库的 `wrangler.toml` 和 `open-next.config.ts` 里声明好了。

---

## Part 3 · 验证

打开 `https://king-and-angel.pages.dev`：

- [ ] **首页**能打开，看到「写一封没有署名的信」
- [ ] 点「持邀请码前来登记」→ 跳到 `/auth`
- [ ] 用 `A1001` 之类的邀请码注册 → 应回首页提示「注册成功」
- [ ] 用注册的邮箱密码登录 → 进 `/dashboard`
- [ ] 写 3 条心愿 → 保存成功
- [ ] 在留言板写一条留言 → 可见
- [ ] 在任务板上传一条任务 → 可见
- [ ] 用第二个无痕窗口注册另一个账号 → 能看到第一个人发的留言和任务

如果某一步失败：

| 症状 | 排查 |
|---|---|
| 首页 500 / 404 | Pages → Settings → Environment variables 检查 4 个变量是否填对 |
| 登录后跳回 `/auth` | 检查 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| 注册时报「邀请码不存在」 | 没运行 `sql/01_schema.sql` 或 invites 表为空 |
| Build 失败提示 module 找不到 | 删掉 `node_modules` 重 push；或本地 `npm install && npm run preview` 复现错误 |

---

## Part 4 · 切换活动规模

测试完想切到 **15 人正式版**（n=15, k=10），需要改 3 处：

### 4.1 代码：`lib/config.ts`

```ts
export const PARTICIPANT_TOTAL = 15;  // 从 4 改成 15
export const REVEAL_THRESHOLD  = 10;  // 从 3 改成 10
```

### 4.2 数据库：`sql/02_e2e_schema.sql` 的 `publish_seal` RPC

找到 `create or replace function public.publish_seal(...)` 块，把：

```sql
expected_total constant int := 4;  -- 改成 15
```

然后在 Supabase SQL Editor 重新执行整个 `create or replace function publish_seal(...) ... end; $$;` 块。

### 4.3 邀请码：`sql/01_schema.sql`

把测试用的 4 个邀请码换成 15 个真实名单（其中 2 个 `can_admin = true`）：

```sql
insert into public.invites (code, display_name, can_admin) values
  ('K001', '张三', true),
  ('K002', '李四', true),
  -- ... 一共 15 行
  ('K015', '小红', false)
on conflict (code) do nothing;
```

### 4.4 清理测试数据（可选）

```sql
delete from public.angel_envelopes;
delete from public.sealed_pairing;
delete from public.pre_seal_wishes;
delete from public.public_messages;
delete from public.tasks;
update public.seal_state set status='open', sealed_at=null where id=1;
delete from auth.users;
delete from public.profiles;
delete from public.invites;
```

然后重新执行 4.3 的 15 个邀请码 insert。

### 4.5 推送 + 重新部署

```bash
git add lib/config.ts sql/02_e2e_schema.sql sql/01_schema.sql
git commit -m "Switch to 15-person production config"
git push
```

Cloudflare 自动重新 build。

---

## Part 5 · 自定义域名（可选）

1. Pages 项目 → **Custom domains** → **Set up a custom domain**
2. 输入域名（如 `angel.yourdomain.com`），Cloudflare 自动建 DNS
3. 等 1-3 分钟证书签发完成

---

## Part 6 · 后续维护

### 日常更新

```bash
# 本地改代码
npm run dev

# 提交 → Cloudflare 自动 build & deploy
git add -A && git commit -m "your message" && git push
```

### 本地预览生产构建

```bash
npm run preview     # 用 OpenNext 在本地模拟 Workers 环境
```

### 看部署日志

Pages 项目 → **Deployments** → 点任一次 → 看 build log。

### 看运行时错误

Pages 项目 → **Functions** → **Real-time logs**——在线追踪 Server Action 调用。

### 回滚

某次部署有问题：**Deployments** → 找之前好的版本 → 右侧 `...` → **Rollback to this deployment**。

### 重新封缄

万一封缄出错需要重做：在 Supabase SQL Editor 执行：

```sql
update public.seal_state set status='open', sealed_at=null where id=1;
delete from public.angel_envelopes;
delete from public.sealed_pairing;
```

然后让所有人重新填心愿（已被销毁），管理员重新去 `/admin/seal` 封缄。

---

## Part 7 · 安全自查（活动正式开始前）

- [ ] Supabase → Auth → **Confirm email** 重新打开（如想要邮箱确认）
- [ ] 邀请码都录入了，没有多余的测试码
- [ ] `SUPABASE_SERVICE_ROLE_KEY` 在 Cloudflare 是 **Secret** 类型
- [ ] 仓库里**没有** `.env.local`（应在 `.gitignore` 里）
- [ ] 自定义域名走 HTTPS

---

## 常见问题

**Q：能完全不用 Supabase，全部跑在 Cloudflare 上吗？**
A：技术上可以（Cloudflare D1 + 自实现 Auth），但需要重写认证、把 28 条 RLS policies 改成应用层权限、3 个 Postgres 函数改成 TypeScript——约 3-4 天工作量。当前的端到端加密设计本身和数据库无关。如果将来要做这次迁移可以再开一份新文档；现阶段不建议。

**Q：Cloudflare 免费版够用吗？**
A：极度够用。Workers 免费版每天 10 万请求，4 人测试或 15 人正式跑一季活动用不到 1k。

**Q：Supabase 免费版会被睡眠吗？**
A：会。连续 7 天没活动会暂停，但用户访问一次就自动恢复（约 30 秒）。活动期间天天有人登录就不会睡。

**Q：能在本地用 production 的 Supabase 数据库测试吗？**
A：可以——把 Cloudflare 上填的 3 个值复制到本地 `.env.local`。**注意**：这意味着本地操作会影响真实数据。

**Q：怎么导出活动结束后的数据存档？**
A：Supabase → Database → Backups 下载 SQL dump；或在 SQL Editor 里 `select * from public_messages;` 然后导出 CSV。

**Q：为什么不用 Vercel？**
A：可以用，且更简单（Vercel 对 Next.js 一等支持）。但 Vercel 免费版有带宽限制 / 商业用途限制；Cloudflare Workers 更便宜更快。

**Q：本地改了代码怎么测试？**
A：`npm run dev` 用 Next.js dev server。要测试和生产一致的环境就 `npm run preview`（OpenNext 本地模拟）。

---

## 附录 · 项目结构

```
king_angel_yongchun_app/
├── app/                       # Next.js 路由
│   ├── auth/                  # 注册 / 登录
│   ├── dashboard/             # 主控制台
│   ├── admin/seal/            # 封缄仪式（一次性）
│   └── reveal/                # 揭示仪式（≥K 把钥匙合力）
├── components/
├── lib/
│   ├── config.ts              # ⭐ 单一真相源：PARTICIPANT_TOTAL / REVEAL_THRESHOLD
│   ├── crypto/                # AEAD / HKDF / Shamir / IndexedDB keystore
│   ├── supabase/              # browser / server / admin / middleware
│   └── ...
├── sql/
│   ├── 01_schema.sql          # profiles + invites
│   └── 02_e2e_schema.sql      # 加密版业务表 + RPC
├── middleware.ts              # Supabase 会话 cookie 刷新
├── next.config.ts
├── open-next.config.ts        # ← OpenNext 配置
├── wrangler.toml              # ← Cloudflare Workers 配置（含 nodejs_compat）
├── package.json
├── tsconfig.json
└── README.md
```
