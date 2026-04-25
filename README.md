# King Angel Yongchun Road

北大爱心社｜爱心万里行 2026 福建永春路 · 「国王与天使」加密版网页

这一版把活动核心从「明文存储 + RLS 限读」升级成 **端到端加密 + Shamir 秘密共享**：

- 心愿和配对在封印之后，**网站运营者和数据库管理员都看不到**
- 每位参与者收到一把**专属密钥**（Shamir share），登录账户后输入密钥即可看到自己的国王和心愿
- 任意 **k / n** 份密钥合在一起，可以在浏览器内重组主密钥，解密完整配对（用于活动结束后的揭示仪式）

> ⚙️ **当前仓库为 15 人正式版**（n=15, k=10, 45 心愿）。要切回 4 人测试版需要改代码 + 写新 migration，详见「§9 切换活动规模」。
> 单一真相源：[`lib/config.ts`](./lib/config.ts)。

---

## 📚 文档导航

| 文档 | 给谁看 | 内容 |
|---|---|---|
| **[USER_GUIDE.md](./USER_GUIDE.md)** | **参与活动的同学** | 怎么注册 / 怎么写心愿 / 怎么用密钥解锁国王 / 怎么参加揭示仪式 |
| **[DEPLOY.md](./DEPLOY.md)** | 部署的人 | Cloudflare Workers (via OpenNext) + Supabase 完整部署步骤 |
| **[MATCHING.md](./MATCHING.md)** | 想理解配对算法的人 | derangement 算法、Shamir 拆分、概率分析、潜在改造方向 |
| **[CLAUDE.md](./CLAUDE.md)** | Claude Code（AI 助手） | 仓库的"big picture"知识，给 AI 接手时看 |
| 本文档（README.md） | 开发者 / 维护者 | 项目架构、迁移工作流、活动 SOP、安全模型、调试技巧 |

---

## 1. 本地运行

```bash
npm install
cp .env.example .env.local
npm run dev
```

环境变量：

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## 2. 初始化 Supabase

仓库使用 **Supabase CLI 工作流**，schema 通过 `supabase/migrations/*.sql` 版本化管理。

```bash
# 1. 安装 CLI（macOS）
brew install supabase/tap/supabase

# 2. 登录 + 关联远程项目
supabase login
supabase link --project-ref <你的项目 ref>

# 3. 推送所有 migration（直连 db.<ref>.supabase.co 经常被 TUN 模式代理拦截，
#    用 connection pooler 更稳）
supabase db push --db-url "postgresql://postgres.<REF>:<PASSWORD>@aws-1-us-west-2.pooler.supabase.com:5432/postgres"

# 4. 推 auth 配置（关闭邮箱确认 + 设置 site_url 等）
supabase config push
```

migrations 顺序：

| 文件 | 内容 |
|---|---|
| `supabase/migrations/...001_initial_schema.sql` | profiles / invites / activity_settings 基础表 |
| `supabase/migrations/...002_e2e_schema.sql` | 加密版业务表（pre_seal_wishes / angel_envelopes / sealed_pairing / seal_state / public_messages / tasks）+ claim_task / complete_task RPC |
| `supabase/migrations/...003_pending_shares.sql` | pending_shares 表（burn-after-read 分发）+ 3 参数 publish_seal RPC + pg_cron 7 天清理 |
| `supabase/migrations/...004_scale_to_15.sql` | 把 publish_seal 的 expected_total 从 4 改到 15 |

> `sql/01_schema.sql` 和 `sql/02_e2e_schema.sql` 是**历史 baseline**（migrations 001/002 的来源），不要再编辑它们来改 schema——以后改 schema 走"写新 migration"路径。

---

## 3. 邀请码与角色

`invites` 表存储邀请码 + 显示姓名 + 是否管理员。每位参与者一个邀请码，`can_admin = true` 的账号可以执行封印。

**当前正式版**：15 条邀请码，格式 `YC` + 出生日期 `YYYYMMDD`，2 位管理员（涂增基 / 王键豪）的邀请码末尾带 `ADMIN` 后缀（例如 `YC20020323ADMIN`）。

如果要换名单，直接进 Supabase Dashboard SQL Editor 改 `public.invites` 表，或写一条新 migration。

---

## 4. 使用流程（活动 SOP）

> 下文用 N 表示 `PARTICIPANT_TOTAL`（当前 **15**），K 表示 `REVEAL_THRESHOLD`（当前 **10**）。

### 4.1 注册阶段

- 把 N 个邀请码分发给同学
- 每人用邀请码 + 邮箱 + 密码注册
- 控制台顶部会显示「注册进度 X / N」

### 4.2 心愿阶段

- 每人在 dashboard 里填写 3 条心愿
- 可以反复修改
- 顶部显示「心愿填写 X / N×3」

### 4.3 封印仪式（一次性）

**仅当 N 人注册且 N×3 条心愿全部填写完毕**，控制台管理员面板才会出现「进入封印流程」入口。

> ⚠️ **封印是不可逆操作。** 一旦执行，任何管理员都无法在 UI 中再次进入封印页。如果遇到极端情况需要重做，只能由 DBA 手工 `update seal_state set status='open' where id=1` 并清空 `angel_envelopes`、`sealed_pairing`，重新填写心愿。

仪式步骤：

1. 一位管理员当面打开 `/admin/seal`
2. 点击「按下朱印 · 封缄这一季」
3. 浏览器在本地：
   - 拉取 N 人 + 全部心愿
   - 生成配对（Fisher-Yates 洗牌 + 保证不自配，详见 [`MATCHING.md`](./MATCHING.md)）
   - 生成主密钥 `ACTIVITY_KEY`
   - Shamir 拆成 N 份（K / N 门槛）
   - 为每个人生成一份「envelope」：用 `HKDF(自己的 share)` 加密 `{国王名字, 国王 3 条心愿}`
   - 生成 `sealed_pairing`：用 `ACTIVITY_KEY` 加密完整配对
4. 通过单次原子事务上传：插入 envelopes + 插入 sealed_pairing + **插入 N 条 pending_shares** + 翻转 `seal_state` 为 published + truncate 全部 `pre_seal_wishes`
5. 管理员屏幕**只显示 N 个名字 + "已写入对应 dashboard"** —— share 字符串永远不会出现在管理员屏幕上
6. 管理员通知 N 位参与者上线领取自己的钥匙（详见 4.4）

### 4.4 活动期间（领钥匙 + 解信）

每位参与者各自登录控制台后会看到：

- **首次进入**（自己的 `pending_shares` 行还在时）：「其二·开启信笺」标签上方出现 `ShareClaim` 卡片，显示自己的 share 字符串、一键复制按钮、销毁按钮
- 参与者把 share 复制保存到任意安全的地方（笔记 / 密码管理器 / 截图）
- 必须勾选"我已保存"复选框 → 点红色销毁按钮 → 服务器 RLS-scoped DELETE 自己那条 `pending_shares` → 卡片消失，之后再也不能从服务器取回这把 share
- 卡片消失后，露出 `KingReveal` 输入框：粘贴刚才复制的 share → 浏览器本地 HKDF 出 personal_key → 解开 envelope → 看到自己的国王 + 3 条心愿
- 解密后的 personal_key 缓存在本机 IndexedDB（non-extractable CryptoKey），下次登录自动展示
- 12 小时后自动失效，需要重新输入
- 也可以点登出按钮手动清除

> ⏰ **7 天兜底**：`pg_cron` 任务 `cleanup-pending-shares` 每天 03:17 删除创建超过 7 天的 pending_shares 行。如果某位参与者一直不登录，他的 share 会被自动清掉——之后既看不到自己的国王，也无法参与揭示。封缄前要确保 N 位都能在 7 天内上线领取。

留言板和任务板**与 share 无关**，登录即用。

### 4.5 揭示仪式

活动结束时，**K 位以上**的同学**当面在同一台电脑上**：

1. 打开 `/reveal`
2. 每人依次粘贴自己的 share 到一个新格子
3. 点「合力揭示」
4. 浏览器本地用 Shamir combine 重组 `ACTIVITY_KEY`，解密 `sealed_pairing`，显示完整 N 对配对 + 心愿
5. 同时校验 `manifest_sha256`，防止数据库被篡改
6. 关闭页面后，揭示结果不写回数据库，下次需要再凑齐 K 人

---

## 5. 安全模型

| 谁 | 能看到什么 | 什么时候 |
|---|---|---|
| 运营者 / DBA | 心愿明文 | 仅限**封印前**的填写窗口（封印成功后立即销毁） |
| 运营者 / DBA | 留言 / 任务标题 / 任务描述 | 能看到内容（明文），但 DB 表无 sender/uploader 字段，看不到是谁发的 |
| 运营者 / DBA | 配对关系 | **永远看不到**（除非拿到 ≥ K 份 share） |
| 运营者 / DBA | 某位用户的 share | 仅限**封缄完成 → 该用户点销毁按钮**之间的窗口（最长 7 天）。RLS 阻止其他普通用户看到，但 service_role 可以读 |
| 某位参与者 | 自己的国王 + 3 条心愿 | 输入自己 share 后 |
| 某位参与者 | 其他人的国王 / 心愿 | **永远看不到** |
| 某位参与者 | 留言 / 任务 | 登录即可（无需 share） |
| 参与者集体 | 完整配对全貌 | 揭示仪式，≥ K 人合作 |
| 封印时的管理员 | 全部心愿明文 | 仅封印按钮那一瞬间（浏览器内存，一次性） |

**关键限制**：

- 如果用户把自己的 share 弄丢了（销毁按钮已经按过），活动期间**没法再看到自己的国王**——这是设计内的不可恢复。但只要不影响群体揭示（其他 K 人健在），最终仍能解锁全貌。
- 如果用户主动告诉别人自己的 share，那个人也能看到这位用户的国王。
- 如果 ≥ K 位参与者私下合谋，他们可以提前揭示完整配对——这正是 K / N 门槛的本意。
- 封印时管理员的浏览器在内存里短暂持有过完整配对。建议封印仪式当面进行，事后立即关闭浏览器、清理 history。
- **share 在 `pending_shares` 表里的窗口期**是这套机制相对最弱的一环。如果担心备份泄露，可以在 Supabase Dashboard → Settings → Database → Backups 缩短或关闭自动备份。

---

## 6. 部署

推荐部署方案：**Cloudflare Workers（前端，via OpenNext）+ Supabase（数据库 / 鉴权）**。完整步骤参考 [`DEPLOY.md`](./DEPLOY.md)。

最简部署（约 10 分钟）：

1. 在 Supabase 新建项目，按 §2 用 `supabase db push` 把 migrations 全部应用上去
2. `wrangler login`，然后 `wrangler secret put NEXT_PUBLIC_SUPABASE_URL --name king-and-angel`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY` 三个 secret 喂给 Worker
3. `npm run deploy`

无需修改任何代码文件，无需在控制台手动加 compatibility flag——`wrangler.toml` 和 `open-next.config.ts` 已写好。

---

## 7. 文件结构（核心）

```
app/
  auth/                    # 邀请码 + 邮箱 + 密码注册登录
  dashboard/
    page.tsx               # 按 sealed 状态二分布局：未封缄→心愿在顶；已封缄→留言/任务板在顶
    actions.ts             # 含 consumeOwnShareAction（用户销毁自己的 pending_share）
    WishEditor.tsx         # 3 条心愿
    KingReveal.tsx         # 输入 share → 解锁国王
    ShareClaim.tsx         # ⭐ 已封缄态：burn-after-read 的钥匙领取卡片
    LettersTabs.tsx        # ⭐ 已封缄态：其二·开启信笺 / 其一·三条心愿 tab 切换
    BoardTabs.tsx          # 其三·留言墙 / 其四·任务板 tab 切换
    MessageBoard.tsx       # 匿名留言板
    TaskBoard.tsx          # 匿名上传 / 实名接取 / 完成
  admin/seal/
    page.tsx
    actions.ts             # publishSealAction（3 参数：envelopes / pairing / shares）
    SealRunner.tsx         # 浏览器内的封印逻辑；不再显示 share，只显示分发完成名单
  reveal/
    page.tsx
    RevealClient.tsx       # K 份 share 合力解密
lib/
  config.ts                # ★ 单一真相源：PARTICIPANT_TOTAL / REVEAL_THRESHOLD
  dashboard.ts             # getParticipantDashboard 含 pending_share 拉取
  crypto/
    aead.ts                # AES-GCM
    hkdf.ts                # HKDF(share) → personal AES key
    sss.ts                 # Shamir 包装
    keystore.ts            # IndexedDB 缓存
    encoding.ts            # base64 / utf8 helpers
supabase/
  migrations/              # ⭐ 当前 schema 真相源；用 supabase db push 应用
    20260425000001_initial_schema.sql
    20260425000002_e2e_schema.sql
    20260425000003_pending_shares.sql      # 加 pending_shares 表 + 3 参 publish_seal + pg_cron
    20260425000004_scale_to_15.sql         # 把 expected_total 从 4 改到 15
  config.toml              # auth 配置（关闭邮箱确认 / site_url 等）；用 supabase config push 应用
sql/
  01_schema.sql            # 历史 baseline（migrations 001 来源），不要再编辑
  02_e2e_schema.sql        # 历史 baseline（migrations 002 来源），不要再编辑
```

---

## 8. 开发与调试小贴士

- 想快速重置封印状态：`update seal_state set status='open', sealed_at=null where id=1; delete from angel_envelopes; delete from sealed_pairing;`
- 想看到某人在 IndexedDB 里缓存的状态：DevTools → Application → IndexedDB → `king-angel-keystore` → `personal_keys`
- 想强制让所有用户重新输入 share：让 DBA 像上面一样重置封印，然后让管理员重新封印（会生成全新的 N 份 share）
- 想在本地造数据：`insert into invites (code, display_name, can_admin) values ('A1004','测试人',false), ...;` 然后注册

---

## 9. 切换活动规模

活动规模由 3 处决定，切换时三处都要改：

### 9.1 代码：`lib/config.ts`

```ts
export const PARTICIPANT_TOTAL = 15;  // 改成你想要的人数
export const REVEAL_THRESHOLD  = 10;  // 改成你想要的揭示门槛
```

代码里所有地方都从这里 import，改完即生效。

### 9.2 数据库：写一条新 migration

`publish_seal` RPC 里 `expected_total constant int := 15` 是函数内的硬编码常量。要改，**写一条新 migration**（不要直接编辑已应用的 migration 文件——那会让本地与远程的 schema_migrations 不一致）。

参考 `supabase/migrations/20260425000004_scale_to_15.sql` 的形式，把里面的 `:= 15` 替换成新数值，然后：

```bash
supabase db push --db-url "postgresql://postgres.<REF>:<PASSWORD>@aws-1-us-west-2.pooler.supabase.com:5432/postgres"
```

### 9.3 邀请码

进 Supabase Dashboard SQL Editor，对 `public.invites` 重新插入相应数量。或写一条 migration 做 upsert。

### 9.4 切换步骤汇总

1. 改 `lib/config.ts` 两个常量
2. 写新 migration 改 `expected_total`，`supabase db push`
3. 在 SQL Editor 里清旧数据 + 重置邀请码：
   ```sql
   begin;
   truncate table
     public.pre_seal_wishes,
     public.angel_envelopes,
     public.sealed_pairing,
     public.public_messages,
     public.tasks,
     public.pending_shares,
     public.profiles,
     public.invites
   restart identity cascade;
   update public.seal_state set status='open', sealed_at=null where id=1;
   delete from auth.users where id is not null;
   insert into public.invites (code, display_name, can_admin) values
     -- 你的新名单
     ;
   commit;
   ```
4. `npm run deploy`（记得先 `rm -rf .next .open-next` 防 Turbopack 字体缓存抽风）

### 9.5 参数约束

- `REVEAL_THRESHOLD` 必须 ≥ 2
- `REVEAL_THRESHOLD` 必须 ≤ `PARTICIPANT_TOTAL`
- 推荐 `REVEAL_THRESHOLD ≈ ⌈PARTICIPANT_TOTAL × 2/3⌉`：既有意义（难以合谋提前揭示），又留容错（允许丢失几份 share）
