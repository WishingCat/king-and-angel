# King Angel Yongchun Road

北大爱心社｜爱心万里行 2026 福建永春路 · 「国王与天使」加密版网页

这一版把活动核心从「明文存储 + RLS 限读」升级成 **端到端加密 + Shamir 秘密共享**：

- 心愿和配对在封印之后，**网站运营者和数据库管理员都看不到**
- 每位参与者收到一把**专属密钥**（Shamir share），登录账户后输入密钥即可看到自己的国王和心愿
- 任何 10/15 份密钥合在一起，可以在浏览器内重组主密钥，解密完整配对（用于活动结束后的揭示仪式）

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

按你的设定：**15 个参与者中 2 个是管理员账号**，他们也参与配对。

---

## 4. 使用流程（活动 SOP）

### 4.1 注册阶段

- 把 15 个邀请码分发给同学
- 每人用邀请码 + 邮箱 + 密码注册
- 控制台顶部会显示「注册进度 X/15」

### 4.2 心愿阶段

- 每人在 dashboard 里填写 3 条心愿
- 可以反复修改
- 顶部显示「心愿填写 X/45」

### 4.3 封印仪式（一次性）

**仅当 15 人注册且 45 条心愿全部填写完毕**，控制台管理员面板才会出现「进入封印流程」入口。

> ⚠️ **封印是不可逆操作。** 一旦执行，任何管理员都无法在 UI 中再次进入封印页。如果遇到极端情况需要重做，只能由 DBA 手工 `update seal_state set status='open' where id=1` 并清空 `angel_envelopes`、`sealed_pairing`，重新填写心愿。

仪式步骤：

1. 一位管理员当面打开 `/admin/seal`
2. 点击「执行封印（不可撤销）」
3. 浏览器在本地：
   - 拉取 15 人 + 全部心愿
   - 生成配对（保证不自配）
   - 生成主密钥 `ACTIVITY_KEY`
   - Shamir 拆成 15 份（10/15 门槛）
   - 为每个人生成一份「envelope」：用 `HKDF(自己的 share)` 加密 `{国王名字, 国王 3 条心愿}`
   - 生成 `sealed_pairing`：用 `ACTIVITY_KEY` 加密完整配对
4. 通过单次原子事务上传：插入 envelopes + 插入 sealed_pairing + 翻转 `seal_state` 为 published + 删除全部 `pre_seal_wishes`
5. 页面显示 15 份 share 和参与者名字对照表
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

活动结束时，10 位以上的同学**当面在同一台电脑上**：

1. 打开 `/reveal`
2. 每人依次粘贴自己的 share 到一个新格子
3. 点「合力揭示」
4. 浏览器本地用 Shamir combine 重组 `ACTIVITY_KEY`，解密 `sealed_pairing`，显示完整 15 对配对 + 心愿
5. 同时校验 `manifest_sha256`，防止数据库被篡改
6. 关闭页面后，揭示结果不写回数据库，下次需要再凑齐 10 人

---

## 5. 安全模型

| 谁 | 能看到什么 | 什么时候 |
|---|---|---|
| 运营者 / DBA | 心愿明文 | 仅限**封印前**的填写窗口（封印成功后立即销毁） |
| 运营者 / DBA | 留言 / 任务标题 / 任务描述 | 能看到内容（明文），但 DB 表无 sender/uploader 字段，看不到是谁发的 |
| 运营者 / DBA | 配对关系 | **永远看不到**（除非拿到 ≥10 份 share） |
| 某位参与者 | 自己的国王 + 3 条心愿 | 输入自己 share 后 |
| 某位参与者 | 其他人的国王 / 心愿 | **永远看不到** |
| 某位参与者 | 留言 / 任务 | 登录即可（无需 share） |
| 参与者集体 | 完整配对全貌 | 揭示仪式，≥10 人合作 |
| 封印时的管理员 | 全部心愿明文 | 仅封印按钮那一瞬间（浏览器内存，一次性） |

**关键限制**：

- 如果用户把自己的 share 弄丢了，活动期间**没法再看到自己的国王**——这是设计内的不可恢复。但只要不影响群体揭示（其他 10 人健在），最终仍能解锁全貌。
- 如果用户主动告诉别人自己的 share，那个人也能看到这位用户的国王。
- 如果 ≥10 位参与者私下合谋，他们可以提前揭示完整配对——这正是 10/15 门槛的本意。
- 封印时管理员的浏览器在内存里短暂持有过完整配对。建议封印仪式当面进行，事后立即关闭浏览器、清理 history。

---

## 6. 部署到 Vercel

1. 把项目上传到 GitHub
2. Vercel → New Project → 导入仓库
3. 在 Project Settings 里填入 3 个环境变量
4. Deploy

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
    RevealClient.tsx     # 10 份 share 合力解密
lib/
  crypto/
    aead.ts              # AES-GCM
    hkdf.ts              # HKDF(share) → personal AES key
    sss.ts               # Shamir 包装
    keystore.ts          # IndexedDB 缓存
    encoding.ts          # base64 / utf8 helpers
sql/
  01_schema.sql          # 基础 profiles / invites
  02_e2e_schema.sql      # 加密版业务表 + RPC（含 publish_seal）
```

---

## 8. 开发与调试小贴士

- 想快速重置封印状态：`update seal_state set status='open', sealed_at=null where id=1; delete from angel_envelopes; delete from sealed_pairing;`
- 想看到某人在 IndexedDB 里缓存的状态：DevTools → Application → IndexedDB → `king-angel-keystore` → `personal_keys`
- 想强制让所有用户重新输入 share：让 DBA 像上面一样重置封印，然后让管理员重新封印（会生成全新的 15 份 share）
- 想在本地造数据：`insert into invites (code, display_name, can_admin) values ('A1004','测试人',false), ...;` 然后注册
