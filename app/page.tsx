import Link from "next/link";
import { PARTICIPANT_TOTAL, REVEAL_THRESHOLD } from "@/lib/config";

const chapters = [
  {
    mark: "其一",
    title: "各自写下三条心愿",
    body: "不必宏大。一件被想起的小事，一个被在乎的小习惯。写下来，也就把陪伴的方向交给了对方。",
  },
  {
    mark: "其二",
    title: "封缄之后，各自收钥",
    body: `管理员在 ${PARTICIPANT_TOTAL} 人齐聚之日按下封印。每个人收到的钥匙独一无二——只开自己的那一格。`,
  },
  {
    mark: "其三",
    title: "以天使之姿默默陪伴",
    body: "知道自己的国王，也知道他许的三条心愿。在接下来的日子里，以匿名的方式一点点实现。",
  },
  {
    mark: "其四",
    title: "留言与任务，皆可匿名",
    body: "留言板与任务板对所有人开放。你的善意可以不署名，也可以被实名接取。",
  },
  {
    mark: "其五",
    title: `活动终章，${REVEAL_THRESHOLD} 人共启`,
    body: `尾声之时，需要 ${REVEAL_THRESHOLD} 个人同时将自己的钥匙并在一处，才能一次性看到这一季所有的配对。`,
  },
];

const principles = [
  {
    tag: "paper, not database",
    title: "写在纸上的心愿",
    body: "心愿只被写在加密的信笺里。网站的运营者、数据库的管理员，都不会看到它们的本来面目。",
  },
  {
    tag: "one key, one letter",
    title: "一人一钥，一钥一信",
    body: `${PARTICIPANT_TOTAL} 位参与者各自持有一把密钥——HKDF 衍生的个人子钥——只能开自己收到的那封信。`,
  },
  {
    tag: "ten of fifteen",
    title: "十人合启，方见全貌",
    body: `Shamir (n=${PARTICIPANT_TOTAL}, k=${REVEAL_THRESHOLD}) 秘密共享：${REVEAL_THRESHOLD} 把密钥合在一起才能还原主密钥，解开这一季完整的名册。`,
  },
];

export default function HomePage() {
  return (
    <main className="page-shell">
      <div className="container">
        <section className="stack-lg rise" style={{ marginBottom: 72 }}>
          <div className="row-between">
            <p className="meta-cap">北京大学爱心社 · 爱心万里行 · 2026</p>
            <span className="meta-cap">福建 永春路</span>
          </div>

          <div className="stack" style={{ gap: 22 }}>
            <h1 className="display-title">
              写一封<em>没有署名</em>的信，
              <br />
              悄悄陪一个人走一程。
            </h1>
            <p className="display-subtitle">
              — 为这一季国王与天使，书一纸信笺，封一枚朱印。
            </p>
          </div>

          <p className="lede">
            这里不是一个寻常的匿名互助平台。我们借用「信笺与封缄」的古意：
            每人写下三条心愿，交由管理员当面封缄成一封封彼此的信；
            每人再各自收到一把独一无二的钥匙，只能开自己的那一格。
            连网站的运营者都看不到配对。
          </p>

          <div className="row gap-md mt-2">
            <Link className="button" href="/auth">
              持邀请码前来登记
            </Link>
            <Link className="button-secondary" href="/dashboard">
              已在册者入内
            </Link>
          </div>
        </section>

        <div className="rule" aria-hidden="true">
          <span className="rule-dot" />
          <span className="meta-cap">五个章节</span>
          <span className="rule-dot" />
        </div>

        <section className="stack-lg rise" style={{ marginTop: 48, marginBottom: 72 }}>
          <div>
            <span className="eyebrow eyebrow-left">five chapters</span>
            <h2 className="section-title">这一季将如何发生</h2>
            <p className="section-subtitle">
              从写下心愿到揭示全貌，一共五个章节。每一章节都有明确的仪式，也都有留白。
            </p>
          </div>

          <ol className="grid grid-2" style={{ padding: 0, listStyle: "none", margin: 0 }}>
            {chapters.map((chapter) => (
              <li key={chapter.mark} className="feature-card">
                <div className="chapter-no">
                  <span className="chapter-label">{chapter.mark}</span>
                  <span>chapter</span>
                </div>
                <h3 className="feature-card-title">{chapter.title}</h3>
                <p className="feature-card-text">{chapter.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <div className="rule" aria-hidden="true">
          <span className="rule-dot" />
          <span className="meta-cap">何以称密</span>
          <span className="rule-dot" />
        </div>

        <section className="grid grid-2 rise" style={{ marginTop: 48, marginBottom: 72 }}>
          <div className="sheet sheet-xl">
            <span className="eyebrow eyebrow-left">cryptographic keepsake</span>
            <h2 className="section-title">一封被封缄的信，真的封住了</h2>
            <p className="lede mt-2">
              我们不是用语义上的「隐私」，而是用密码学上的「端到端加密」与「秘密共享」。
              运营者拿不到钥匙，也就读不到信。这既是技术承诺，也是一次关于信任的小型仪式。
            </p>

            <div className="rule-dashed" />

            <div className="stack" style={{ gap: 18 }}>
              {principles.map((item) => (
                <div key={item.title}>
                  <div className="feature-card-mark">{item.tag}</div>
                  <div className="feature-card-title" style={{ fontSize: 18, marginTop: 4 }}>
                    {item.title}
                  </div>
                  <p className="feature-card-text">{item.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="envelope-figure" aria-hidden="true">
            <div className="envelope-flap" />
            <div className="envelope-postmark">
              yongchun
              <br />
              · 2026 ·
            </div>
            <div className="envelope-seal">缄</div>
            <div className="envelope-address">
              致　国王 · 亲启
              <br />
              <span className="meta-cap">via angel, sub rosa</span>
            </div>
          </div>
        </section>

        <section className="sheet sheet-xl rise" style={{ marginBottom: 48 }}>
          <div className="stack" style={{ gap: 18 }}>
            <span className="eyebrow eyebrow-left">a small invitation</span>
            <h2 className="section-title">准备好了吗？</h2>
            <p className="lede">
              收到邀请码，便可前来登记。登记完成后，先去写下你的三条心愿——
              慢一点、具体一点、温柔一点。等 {PARTICIPANT_TOTAL} 位同行者都到齐，便是封缄之时。
            </p>

            <div className="row gap-md mt-2">
              <Link className="button" href="/auth">
                前去登记 →
              </Link>
              <Link className="btn-link" href="/reveal">
                或者，去看看揭示仪式
              </Link>
            </div>
          </div>
        </section>

        <footer className="text-center" style={{ marginTop: 64, color: "var(--ink-muted)", fontSize: 13, lineHeight: 2 }}>
          <div className="meta-cap">北京大学爱心社 · 2026</div>
          <div style={{ marginTop: 4, fontFamily: "var(--f-accent)", fontStyle: "italic" }}>
            with warmth and silence · 福建 永春路
          </div>
        </footer>
      </div>
    </main>
  );
}
