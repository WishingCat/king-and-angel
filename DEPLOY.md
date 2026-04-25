# 部署教程 · Cloudflare + Supabase

> **King & Angel · 信笺与封缄** — 用 [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) 把 Next.js 16 部署到 Cloudflare Workers，数据库与认证用 Supabase 免费版。

> ⚙️ **当前仓库为 15 人正式版**（15 人 + 45 心愿 + 10 人揭示）。
> 想切回 4 人测试规模，请按 [§Part 4 切换活动规模](#part-4--切换活动规模) 操作（要写新 migration）。

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

### 1.2 应用所有 schema migrations

**推荐：用 Supabase CLI**（一键应用本仓库所有 migration，最不容易漏）：

```bash
brew install supabase/tap/supabase           # macOS；其他平台见官方文档
supabase login
supabase link --project-ref <你的项目 ref>     # 在 Dashboard URL 里能看到

# 直连 db.<ref>.supabase.co 经常被 TUN 模式代理拦截，用 pooler 更稳：
supabase db push --db-url "postgresql://postgres.<REF>:<PASSWORD>@aws-1-us-west-2.pooler.supabase.com:5432/postgres"

# 推 auth 配置（关闭邮箱确认 + 设置 site_url 等）
supabase config push
```

**或者：手动在 SQL Editor 跑（4 个文件依次粘贴运行）**：
- `supabase/migrations/20260425000001_initial_schema.sql`
- `supabase/migrations/20260425000002_e2e_schema.sql`
- `supabase/migrations/20260425000003_pending_shares.sql`
- `supabase/migrations/20260425000004_scale_to_15.sql`

> 这 4 份会建好所有业务表 + RLS 策略 + RPC（含 3 参数版的 publish_seal）+ pg_cron 7 天自动清理 pending_shares。

### 1.3 关闭邮箱确认

如果用了 `supabase config push`，这一步会自动完成。否则手工：

**Authentication** → **Providers** → **Email** → 关闭 **Confirm email** → **Save**

> 这样测试期注册后立刻能登录，不必等收邮件——同时也避开了 Supabase 默认 SMTP 的"每小时 3-4 封"严苛限制。

### 1.4 邀请码

migrations 应用完成后，`invites` 表会有一行示例（或者空的，取决于你跑的版本）。15 人正式版的邀请码命名规则：`YC` + 出生日期 `YYYYMMDD`，管理员后加 `ADMIN`，display_name 用「序号+姓名」。

15 人版的完整名单存在仓库的活动数据里——具体 SQL 见 [§Part 4](#part-4--切换活动规模)。

### 1.5 抄下 3 个凭据

**Project Settings** → **API**：

| 凭据 | 用途 |
|---|---|
| **Project URL** | `NEXT_PUBLIC_SUPABASE_URL` |
| **anon key** | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **service_role key** | `SUPABASE_SERVICE_ROLE_KEY`（**绝密**，只在服务端用） |

---

## Part 2 · Cloudflare Workers（用 wrangler，5 分钟）

> ⚠️ **不用 Cloudflare Pages 的 Connect to Git 方式**——OpenNext 推荐直接通过 `wrangler` 部署到 Workers，构建在本地完成。

### 2.1 本地准备

```bash
# 把仓库 clone 下来
git clone <repo-url>
cd king_angel_yongchun_app
npm install

# 写本地环境变量（构建时 Next.js 会把 NEXT_PUBLIC_* 内联到客户端 bundle）
cp .env.example .env.local
# 然后编辑 .env.local，填上 Part 1.5 抄的三个值
```

`.env.local` 内容：

```env
NEXT_PUBLIC_SUPABASE_URL=https://<你的 ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### 2.2 登录 wrangler 并配置 Worker secret

```bash
npx wrangler login   # 会打开浏览器走 OAuth

# 把三个值喂给 Worker（runtime 用，跟 .env.local 独立）。
# 用 stdin 输入避免值进入 shell history：
grep '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | cut -d= -f2- | tr -d '\n' | npx wrangler secret put NEXT_PUBLIC_SUPABASE_URL --name king-and-angel
grep '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' .env.local | cut -d= -f2- | tr -d '\n' | npx wrangler secret put NEXT_PUBLIC_SUPABASE_ANON_KEY --name king-and-angel
grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2- | tr -d '\n' | npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --name king-and-angel
```

> ⚠️ **`SUPABASE_SERVICE_ROLE_KEY` 一定走 secret，绝不写到 wrangler.toml 或任何 git 跟踪文件**——它能绕过所有 RLS，泄露 = 灾难。

### 2.3 部署

```bash
rm -rf .next .open-next     # 清缓存（防 Turbopack 字体模块解析抽风）
npm run deploy
```

`npm run deploy` 实际跑的是 `opennextjs-cloudflare build && opennextjs-cloudflare deploy`。第一次约 2-3 分钟。完成后输出会显示 Worker 的默认地址，类似 `https://king-and-angel.<your-account>.workers.dev`。

> ✨ **不需要**：手动加 `nodejs_compat` flag、不需要在每个文件加 `export const runtime = "edge"`、不需要修改任何代码文件。
> 这些都已经在仓库的 `wrangler.toml` 和 `open-next.config.ts` 里声明好了。

---

## Part 3 · 验证

打开 `https://king-and-angel.<your-account>.workers.dev`：

- [ ] **首页**能打开，看到「写一封没有署名的信」
- [ ] 点「持邀请码前来登记」→ 跳到 `/auth`
- [ ] 用 `YC20060314` 之类的邀请码（参考你 invites 表的实际值）注册 → 应回首页提示「注册成功」
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

仓库默认是 15 人正式版。如果要切回 4 人测试版，或者切到任意其他人数，需要改 3 处：

### 4.1 代码：`lib/config.ts`

```ts
export const PARTICIPANT_TOTAL = 4;   // 改成你想要的人数
export const REVEAL_THRESHOLD  = 3;   // 改成你想要的揭示门槛
```

### 4.2 数据库：写一条新 migration 改 publish_seal

`publish_seal` RPC 里 `expected_total constant int := 15` 是函数内的硬编码常量。要改它，**写一条新的 migration**（不要直接改已应用的 migration 文件），参考 `supabase/migrations/20260425000004_scale_to_15.sql` 的形式：

```sql
-- supabase/migrations/<新时间戳>_scale_to_4.sql
create or replace function public.publish_seal(
  envelopes jsonb,
  pairing jsonb,
  shares jsonb
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  expected_total constant int := 4;  -- 改成新数值
  -- ... 其余函数体跟 ...004_scale_to_15.sql 完全一样
$$;
```

然后：

```bash
supabase db push --db-url "postgresql://postgres.<REF>:<PASSWORD>@aws-1-us-west-2.pooler.supabase.com:5432/postgres"
```

### 4.3 邀请码：在 SQL Editor 重置

在 Supabase Dashboard SQL Editor 跑：

```sql
truncate table public.invites cascade;
insert into public.invites (code, display_name, can_admin) values
  ('YC20020323ADMIN', '1涂增基', true),
  ('YC20060314',      '2常友善', false),
  -- ... 一共 N 行
  ;
```

格式约定：邀请码 `YC` + 生日 `YYYYMMDD`（管理员后加 `ADMIN`），display_name 用「序号+姓名」。

### 4.4 清理测试数据（可选）

```sql
begin;
truncate table
  public.pre_seal_wishes,
  public.angel_envelopes,
  public.sealed_pairing,
  public.public_messages,
  public.tasks,
  public.pending_shares,
  public.profiles
restart identity cascade;
update public.seal_state set status='open', sealed_at=null where id=1;
delete from auth.users where id is not null;
commit;
```

### 4.5 重新部署

```bash
rm -rf .next .open-next      # 防 Turbopack 字体缓存抽风
npm run deploy
```

---

## Part 5 · 自定义域名（可选）

1. Cloudflare Dashboard → 选中 `king-and-angel` Worker → **Settings** → **Triggers** → **Custom Domains**
2. 输入域名（如 `angel.yourdomain.com`），Cloudflare 自动建 DNS
3. 等 1-3 分钟证书签发完成

---

## Part 6 · 后续维护

### 日常更新

```bash
# 本地改代码
npm run dev

# 验证类型 + 部署
node node_modules/typescript/bin/tsc --noEmit
rm -rf .next .open-next
npm run deploy
```

提交到 git 是为了版本化，**不会**自动触发部署——这个项目是手动 `npm run deploy`。

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
