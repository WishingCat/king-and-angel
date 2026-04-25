# 匹配机制 · 15 人版分析

> 本文记录 King & Angel 平台在 15 人正式规模下的配对（matching）算法、密码学打包流程与可观测的概率特性，便于后续维护、改造或迁移到更大规模时回看。
>
> 当前线上配置已是 15 人正式版（`PARTICIPANT_TOTAL=15, REVEAL_THRESHOLD=10`）。要切回 4 人测试规模，按 `lib/config.ts` 顶部注释三步走（含写新 migration 把 publish_seal 的 expected_total 改回 4）。

---

## 一、规模参数

```
PARTICIPANT_TOTAL = 15
REVEAL_THRESHOLD  = 10        // 揭示门槛 K
WISHES_PER_PERSON = 3         // 每人写 3 条心愿
```

数学语义：**15 人，每人 3 条心愿，共 45 条。最少 10 人凑齐密钥才能集体揭示。**

---

## 二、"配对"是一个 N=15 的 derangement（错排）

核心算法在 `app/admin/seal/SealRunner.tsx:42-66` 的 `buildDerangement(ids)`：

```
function buildDerangement(ids):
  for attempt in 0..49:
    shuffled = Fisher-Yates 洗牌(ids 的副本)        // 每位平等
    if 任意 i 满足 shuffled[i] == ids[i]:           // 自配对则作废
      continue
    return shuffled                                  // 否则采用
  return ids.map(i => ids[(i + 1) % 15])             // 50 次仍失败的兜底：环形右移 1 位
```

### 输出语义

`angels = ids` 与 `kings = buildDerangement(ids)` 按下标对应：

```
angels[0] 是 kings[0] 的天使（送惊喜的）
kings[0]  是 angels[0] 的国王（被陪伴的）
angels[1] 是 kings[1] 的天使
...
angels[14] 是 kings[14] 的天使
```

也就是说这是一个**置换（permutation）**：每个人**恰好**当一次国王、当一次天使，1-to-1 严格对称。**不允许 self-pairing**（自己当自己的天使）。

### 视觉直观

15 人的关系图永远是有向图里若干个**不相交的环**。可能出现的两种典型构型：

```
A → B → C → D → E → F → G → H → I → J → K → L → M → N → O → A    （单一 15-环）

A → B → C → A     D → E → F → G → D    H → I → J → K → L → M → N → O → H
（3-环 + 4-环 + 8-环）
```

不会出现 2-环（A→B→A）这种"互相是对方的国王/天使"的情况吗？**会的**——derangement 只禁止"自己→自己"，不禁止 2-环互配。这是**算法的特性，不是 bug**：圣诞老人式的传递在小群体里允许互相给。

### 概率分布

- 50 次重试预算在 15 人下绰绰有余。理论概率：随机洗牌正好是 derangement 的概率 = `D(n)/n!`，n→∞ 极限收敛到 `1/e ≈ 36.8%`。15 人下 `D(15)/15! ≈ 36.7879%`。
- **单次成功率 ≈ 36.79%，50 次内全失败的概率 < 10⁻²²**，几乎不可能走到兜底分支。
- **公平性**：在 50 次预算内成功的情况下，产出**在所有 15-derangement 中均匀分布**（Fisher-Yates 是均匀置换 + reject 掉非 derangement 的子集仍均匀）。每个人当任何一个非自己的人的天使的概率都是 `1/14`。
- **兜底分支**（`(i+1) % 15`）只产出唯一一种构型：单一 15-环 `A→B→C→...→O→A`。这只在 50 次都失败时触发——实操中**几乎不会**遇到，但若理论上极小概率落到这里，配对会变成可预测的环形——值得知道这个边界。

### 不考虑的约束

```
✗ 不会避开熟人/不熟人——纯随机
✗ 不会均衡性别/年级
✗ 不能预设"某 A 不能配 B"
✗ 不会避开上一季的同款配对（没有跨季记忆）
```

如果以后需要"避开情侣 / 上一季配过的人"，要在 `buildDerangement` 之上加约束求解器。当前是最简版本。

---

## 三、配对结果如何变成"加密的活动"

配对算出来后，`SealRunner.tsx` 里的循环把它编码成两层密文：

### 第 1 层 · 主密钥 + Shamir 拆分

```
ACTIVITY_KEY = AES-GCM-256 随机生成              // 256 bit
shares[0..14] = Shamir.split(ACTIVITY_KEY, n=15, k=10)
```

15 把 share。**任意 10 把合并起来**就能在浏览器端用 Lagrange 插值还原出 ACTIVITY_KEY；少于 10 把则**信息论意义上**完全无法获取（不是计算不可行，是**根本没有信息**）。

### 第 2 层 · 每人一封专属信

对每个下标 `i`：

```
personal_key_i = HKDF-SHA256(share_i, info="personal-envelope-v1")    // 256 bit
envelope_i = AES-GCM(personal_key_i, JSON{ king_id, king_name, king_wishes[3] })
```

写入 `angel_envelopes` 表的 ciphertext 字段。**只有持 share_i 的人**能拆开 envelope_i 看到自己的国王是谁。其他 14 个 envelope 对他来说都是噪声。

### 第 3 层 · 一份全员配对底稿

```
sealed_pairing = AES-GCM(ACTIVITY_KEY, JSON{ pairs: [{angel, king, wishes}, ... 15 对] })
```

写入 `sealed_pairing` 表（singleton, id=1）。这份只在 `/reveal` 仪式上凑齐 ≥10 把 share 重组 ACTIVITY_KEY 后，才能在浏览器端解开。

---

## 四、"15 把钥匙"的实际流转

```
seal 仪式时，浏览器在内存里有 share[0..14]
    ↓
publish_seal RPC 一个事务里写入：
  - 15 条 angel_envelopes（密文）
  - 1  条 sealed_pairing（密文）
  - 15 条 pending_shares（明文 share，但 RLS 仅自己可读）
  - TRUNCATE pre_seal_wishes（销毁明文心愿）
    ↓
管理员浏览器丢掉所有 share，屏幕只显示"15 把钥匙已发"
    ↓
每位用户登录 dashboard
  ↓
看到 ShareClaim 卡片显示自己的 share
  ↓
复制保存 → 点销毁按钮 → 服务器立即 DELETE 自己那条 pending_shares
    ↓
（≤ 7 天内未点的，pg_cron 'cleanup-pending-shares' 自动删；超时未拿就丢失了）
    ↓
日后任何时刻，本人在 KingReveal 粘贴 share → 浏览器内 HKDF 出 personal_key
                                          → 解 envelope 看到自己的国王
    ↓
若 ≥10 人物理坐在同一台电脑前都贴 share，/reveal 解出 sealed_pairing
                                       → 屏幕展开整张配对图
```

---

## 五、4 人测试 vs 15 人正式 · 数学对比

|  | 4 人 (k=3) | 15 人 (k=10) |
|---|---|---|
| derangement 总数 D(n) | 9 | 481,066,515,734 |
| 单人当任一非己他人的天使概率 | 1/3 ≈ 33% | 1/14 ≈ 7.1% |
| 揭示门槛在总数中占比 | 75% | 66.7% |
| 揭示容错（最多丢失多少把仍能还原） | 1 | 5 |
| 凑不齐揭示的概率（每人独立 80% 到现场） | P(Bin(4,0.8)<3) ≈ **18.1%** | P(Bin(15,0.8)<10) ≈ **6.1%** |
| 单一 N-环出现的概率 | (n-1)!/D(n) = 6/9 ≈ **67%** | 14!/D(15) ≈ **18.1%** |

要点：
- **15 人的揭示风险反而比 4 人小**（6% vs 18%），因为 K 占总数比例更低，且 N 大数定律让二项分布更集中。
- **15 人的环结构更碎**：单一长环出现率从 4 人时的 67% 降到 18%，更可能拆成 2~3 个不相交的环。
- 4 人版本里若有人没到场就破局，这是测试时要记得的脆弱性；15 人正式版有更厚的容错。

---

## 六、潜在改进方向

| 想做的事 | 当前能不能做 | 改造成本 |
|---|---|---|
| 避免某两人互配（消除 2-环） | 否 | 在 derangement 验证里加：`shuffled[shuffled[i]] !== i` |
| 避免上一季配过的人 | 否 | 需要持久化历史配对，额外加表；本项目设计就是"一次性"，不存历史 |
| 强制单一大环（不出现拆环） | 否 | 改算法：用旋转法（rotation）或圆排列直接生成；牺牲一些均匀性 |
| 限制最小环长（不出现 2-环、3-环） | 否 | derangement 验证里加 cycle 检测 |
| 揭示时少于 K 人也能查自己的国王 | **已经能** | personal envelope 单 share 就能拆，与全员揭示无关 |
| 改 K（揭示门槛） | 改 `lib/config.ts` 一个常量即可 | 同步 `expected_total` 那个 RPC 常量需重新部署一次 migration |
| 加性别/年级均衡约束 | 否 | profiles 表加属性字段 + 在配对生成层加约束求解器（回溯/SAT） |

---

## 七、参考代码位置

| 关注点 | 文件 :line |
|---|---|
| `buildDerangement` 算法 | `app/admin/seal/SealRunner.tsx:42-66` |
| Shamir 拆分调用 | `app/admin/seal/SealRunner.tsx:137`（`splitSecret(...)`）|
| HKDF 派生 personal_key | `lib/crypto/hkdf.ts` |
| AES-GCM 包装 | `lib/crypto/aead.ts` |
| Shamir 包装 + base64url 编码 | `lib/crypto/sss.ts` |
| publish_seal 原子事务 | `supabase/migrations/20260425000003_pending_shares.sql` |
| 规模常量 | `lib/config.ts:15-16` |
| 揭示客户端解密 | `app/reveal/RevealClient.tsx` |
| 用户开信 | `app/dashboard/KingReveal.tsx` |
| 用户领钥匙 | `app/dashboard/ShareClaim.tsx` |
