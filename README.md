# King Angel Yongchun Road

北大爱心社｜爱心万里行 2026 福建永春路 · 「国王与天使」加密版网页

这一版把活动核心从「明文存储 + RLS 限读」升级成 **端到端加密 + Shamir 秘密共享**：

- 心愿和配对在封印之后，**网站运营者和数据库管理员都看不到**
- 每位参与者收到一把**专属密钥**（Shamir share），登录账户后输入密钥即可看到自己的国王和心愿
- 任意 **k / n** 份密钥合在一起，可以在浏览器内重组主密钥，解密完整配对（用于活动结束后的揭示仪式）

> ⚙️ **当前仓库已切到 4 人测试版**（n=4, k=3）。正式版为 15 人 / 45 心愿 / 10 揭示。
> 单一真相源：[`lib/config.ts`](./lib/config.ts)。详见「§9 切换活动规模」。

---

## 📚 文档导航

| 文档 | 给谁看 | 内容 |
|---|---|---|
| **[USER_GUIDE.md](./USER_GUIDE.md)** | **参与活动的同学** | 怎么注册 / 怎么写心愿 / 怎么用密钥解锁国王 / 怎么参加揭示仪式 |
| **[DEPLOY.md](./DEPLOY.md)** | 部署的人 | Cloudflare Pages + Supabase 完整部署步骤 |
| 本文档（README.md） | 开发者 / 维护者 | 项目架构、SQL 迁移、活动 SOP、安全模型、调试技巧 |

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

1. 新建 Supabase 项目
2. 打开 SQL Editor
3. **依次** 运行：
   - `sql/01_schema.sql`（仅用于建立 `profiles` / `invites` 等基础表，新版会丢弃其中的旧业务表）
   - `sql/02_e2e_schema.sql`（删除旧业务表 + 创建 `pre_seal_wishes`、`angel_envelopes`、`sealed_pairing`、`seal_state`、`public_messages`、`tasks` + 加密所需 RPC）
4. Authentication > Providers：保持邮箱/密码登录开启
5. Authentication > Settings：测试期可关闭邮箱确认

---

## 3. 邀请码与角色

`sql/01_schema.sql` 仍提供 `invites` 表。每位参与者一个邀请码，`can_admin = true` 的账号可以执行封印。

**当前测试版**：4 个预置邀请码（`ADMIN` 管理员 + `A1001`/`A1002`/`A1003` 普通）。
**正式版**：把 `01_schema.sql` 末尾示例邀请码扩展成 15 个真实名单，其中 2 个 `can_admin = true`，他们也参与配对。

---

## 4. 使用流程（活动 SOP）

> 下文用 N 表示 `PARTICIPANT_TOTAL`（当前 4，正式版 15），用 K 表示 `REVEAL_THRESHOLD`（当前 3，正式版 10）。

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
   - 生成配对（Fisher-Yates 洗牌 + 保证不自配）
   - 生成主密钥 `ACTIVITY_KEY`
   - Shamir 拆成 N 份（K / N 门槛）
   - 为每个人生成一份「envelope」：用 `HKDF(自己的 share)` 加密 `{国王名字, 国王 3 条心愿}`
   - 生成 `sealed_pairing`：用 `ACTIVITY_KEY` 加密完整配对
4. 通过单次原子事务上传：插入 envelopes + 插入 sealed_pairing + 翻转 `seal_state` 为 published + 删除全部 `pre_seal_wishes`
5. 页面显示 N 份 share 和参与者名字对照表
6. **当面把每份 share 分发给对应同学**（推荐写在纸条上、私聊、或当面口述）
7. 勾选「我已分发完毕」并点确认 → 页面跳转返回，share 在浏览器内存中销毁

### 4.4 活动期间

- 每人登录控制台 → 「我的国王」一栏显示密钥输入框
- 粘贴自己的 share → 浏览器本地解密 envelope → 看到国王 + 3 条心愿
- 解密后的 personal_key 缓存在本机 IndexedDB（non-extractable CryptoKey），下次登录自动展示
- 12 小时后自动失效，需要重新输入
- 也可以点「在此设备锁定 / 清除本地密钥」手动清除

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
| 某位参与者 | 自己的国王 + 3 条心愿 | 输入自己 share 后 |
| 某位参与者 | 其他人的国王 / 心愿 | **永远看不到** |
| 某位参与者 | 留言 / 任务 | 登录即可（无需 share） |
| 参与者集体 | 完整配对全貌 | 揭示仪式，≥ K 人合作 |
| 封印时的管理员 | 全部心愿明文 | 仅封印按钮那一瞬间（浏览器内存，一次性） |

**关键限制**：

- 如果用户把自己的 share 弄丢了，活动期间**没法再看到自己的国王**——这是设计内的不可恢复。但只要不影响群体揭示（其他 K 人健在），最终仍能解锁全貌。
- 如果用户主动告诉别人自己的 share，那个人也能看到这位用户的国王。
- 如果 ≥ K 位参与者私下合谋，他们可以提前揭示完整配对——这正是 K / N 门槛的本意。
- 封印时管理员的浏览器在内存里短暂持有过完整配对。建议封印仪式当面进行，事后立即关闭浏览器、清理 history。

---

## 6. 部署

推荐部署方案：**Cloudflare Workers（前端，via OpenNext）+ Supabase（数据库 / 鉴权）**。完整步骤参考 [`DEPLOY.md`](./DEPLOY.md)。

最简部署（约 10 分钟）：

1. 在 Supabase 新建项目，跑两份 `sql/*.sql`，抄 3 个 key
2. 在 Cloudflare Pages 新建项目 → Connect to Git → 填 4 个环境变量
3. Save and Deploy

无需修改任何代码文件，无需在控制台手动加 compatibility flag——`wrangler.toml` 和 `open-next.config.ts` 已写好。

---

## 7. 文件结构（核心）

```
app/
  auth/            # 邀请码 + 邮箱 + 密码注册登录（保持原样）
  dashboard/
    page.tsx
    actions.ts
    WishEditor.tsx       # 3 条心愿
    KingReveal.tsx       # 输入 share → 解锁国王
    MessageBoard.tsx     # 匿名留言板
    TaskBoard.tsx        # 匿名上传 / 实名接取 / 完成
  admin/seal/
    page.tsx
    actions.ts           # publishSealAction (调用 publish_seal RPC)
    SealRunner.tsx       # 浏览器内的全部封印逻辑
  reveal/
    page.tsx
    RevealClient.tsx     # K 份 share 合力解密
lib/
  config.ts              # ★ 单一真相源：PARTICIPANT_TOTAL / REVEAL_THRESHOLD
  crypto/
    aead.ts              # AES-GCM
    hkdf.ts              # HKDF(share) → personal AES key
    sss.ts               # Shamir 包装
    keystore.ts          # IndexedDB 缓存
    encoding.ts          # base64 / utf8 helpers
sql/
  01_schema.sql          # 基础 profiles / invites
  02_e2e_schema.sql      # 加密版业务表 + RPC（含 publish_seal，含硬编码的 expected_total）
```

---

## 8. 开发与调试小贴士

- 想快速重置封印状态：`update seal_state set status='open', sealed_at=null where id=1; delete from angel_envelopes; delete from sealed_pairing;`
- 想看到某人在 IndexedDB 里缓存的状态：DevTools → Application → IndexedDB → `king-angel-keystore` → `personal_keys`
- 想强制让所有用户重新输入 share：让 DBA 像上面一样重置封印，然后让管理员重新封印（会生成全新的 N 份 share）
- 想在本地造数据：`insert into invites (code, display_name, can_admin) values ('A1004','测试人',false), ...;` 然后注册

---

## 9. 切换活动规模（4 人测试版 ↔ 15 人正式版）

活动总人数和揭示阈值由 3 个地方共同决定。切换时三处都要改：

### 9.1 代码：`lib/config.ts`

```ts
export const PARTICIPANT_TOTAL = 4;   // 正式版改成 15
export const REVEAL_THRESHOLD  = 3;   // 正式版改成 10
```

代码里所有地方都从这里 import，改完即生效。

### 9.2 数据库：`sql/02_e2e_schema.sql` 的 `publish_seal` RPC

`publish_seal` 函数里有一行 `expected_total constant int := 4`（或 15）是 **Postgres 函数内的硬编码**——必须在 Supabase SQL Editor 里重新执行 `create or replace function publish_seal(...)` 块。

```sql
expected_total constant int := 4;   -- 测试版；正式版改成 15
```

### 9.3 邀请码：`sql/01_schema.sql` 末尾的 `insert into invites`

测试版已预置 4 个邀请码（1 管理员 + 3 普通）。正式版需要扩成 15 行真实名单，其中 2 个 `can_admin = true`。

### 9.4 切换步骤

1. 改 `lib/config.ts` 里两个常量
2. 改 `sql/02_e2e_schema.sql` 里的 `expected_total`
3. 在 Supabase SQL Editor 里**重新执行** `publish_seal` 的 `create or replace function` 块（只需要那一段，不需要整个文件）
4. 如果数据库已有旧测试数据想清空：
   ```sql
   delete from public.angel_envelopes;
   delete from public.sealed_pairing;
   delete from public.pre_seal_wishes;
   delete from public.public_messages;
   delete from public.tasks;
   update public.seal_state set status='open', sealed_at=null where id=1;
   -- 清理已注册的测试账号
   delete from auth.users where email like '%test%';
   delete from public.invites;
   ```
5. 用 9.3 写好的新邀请码重新填表
6. `git add && git commit && git push` → Cloudflare Pages 自动重建

### 9.5 参数约束

- `REVEAL_THRESHOLD` 必须 ≥ 2
- `REVEAL_THRESHOLD` 必须 ≤ `PARTICIPANT_TOTAL`
- 推荐 `REVEAL_THRESHOLD ≈ ⌈PARTICIPANT_TOTAL × 2/3⌉`：既有意义（难以合谋提前揭示），又留容错（允许丢失几份 share）
