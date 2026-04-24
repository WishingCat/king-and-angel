import Link from "next/link";
import { EditableImageCard } from "@/components/EditableImageCard";
import { siteAssets } from "@/lib/site-assets";

const participationSteps = [
  {
    title: "填写心愿",
    description:
      "每位参与者先填写一个希望天使帮助完成的小心愿。心愿不需要很大，具体、清楚、可执行即可。",
  },
  {
    title: "等待配对",
    description:
      "文建后台会在准备完成后统一生成配对。配对结果在活动结束前不会向后台公开。",
  },
  {
    title: "查看信息",
    description:
      "配对完成后，每位天使可以看到自己的国王，以及国王填写的心愿内容。",
  },
  {
    title: "完成陪伴",
    description:
      "活动期间，大家可以通过匿名留言、日常帮助和随机任务，逐步完成对方的心愿。",
  },
  {
    title: "活动结束",
    description:
      "活动结束后，系统会开放查看配对结果和整体推进情况，方便大家统一回顾。",
  },
];

const activityHighlights = [
  {
    title: "心愿先行",
    description:
      "这次活动不是先抽签再想做什么，而是先写下希望被帮助完成的事情，再进入配对流程。",
  },
  {
    title: "匿名进行",
    description:
      "天使知道自己国王的心愿，但不公开身份。活动中的帮助尽量自然完成，不需要刻意说明来源。",
  },
  {
    title: "后台盲视角",
    description:
      "文建负责人在活动结束前看不到配对结果，也看不到具体心愿内容，只负责流程管理。",
  },
];

export default function HomePage() {
  return (
    <main className="page-shell">
      <div className="container">
        <section className="hero hero-rich">
          <div className="card hero-copy-card">
            <div className="eyebrow">北京大学爱心社 · 爱心万里行</div>
            <h1 className="title">2026 福建永春路｜国王与天使</h1>
            <p className="subtitle">
              这是本次“国王与天使”活动的线上平台。活动开始前，每位参与者需要先填写一个希望天使帮助完成的心愿。
              配对完成后，对应的天使可以看到自己国王的心愿，并在接下来的活动过程中围绕这个心愿进行帮助。
            </p>

            <div className="badge-row">
              <span className="badge">配对前填写心愿</span>
              <span className="badge">活动中匿名进行</span>
              <span className="badge">支持任务记录</span>
              <span className="badge">结束后统一揭晓</span>
            </div>

            <div className="button-row hero-button-row">
              <Link className="button" href="/auth">
                去登录 / 注册
              </Link>
              <Link className="button-secondary" href="/dashboard">
                进入控制台
              </Link>
            </div>

            <div className="footer-note">
              第一次使用时，请先前往“登录 / 注册”页面，使用组织者发放的邀请码完成注册。
            </div>
          </div>

          <div className="hero-visual-grid">
            <EditableImageCard
              src={siteAssets.homeHeroMain.src}
              alt={siteAssets.homeHeroMain.alt}
              title="活动主图"
              hint="国王与天使活动页面"
              className="hero-visual-large"
              priority
            />
            <EditableImageCard
              src={siteAssets.homeHeroSideOne.src}
              alt={siteAssets.homeHeroSideOne.alt}
              title="活动过程"
              hint="记录活动中的日常场景"
              className="hero-visual-small"
            />
            <EditableImageCard
              src={siteAssets.homeHeroSideTwo.src}
              alt={siteAssets.homeHeroSideTwo.alt}
              title="福建永春路"
              hint="可放项目照片或活动现场图"
              className="hero-visual-small"
            />
          </div>
        </section>

        <section className="section-block">
          <div className="section-heading">
            <div className="eyebrow">参与流程</div>
            <h2 className="section-title">活动怎么进行</h2>
            <p className="section-subtitle">
              如果你是第一次参加，可以先看这里。整个流程大致分为下面几个步骤。
            </p>
          </div>

          <div className="grid grid-3">
            {participationSteps.map((item) => (
              <article className="card feature-card" key={item.title}>
                <div className="feature-card-dot" />
                <h3 className="feature-card-title">{item.title}</h3>
                <p className="feature-card-text">{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block">
          <div className="section-heading">
            <div className="eyebrow">活动说明</div>
            <h2 className="section-title">这个版本和以往的区别</h2>
            <p className="section-subtitle">
              这次的重点不只是匿名互动，而是让每位天使在活动中有一个更明确的帮助方向。
            </p>
          </div>

          <div className="grid grid-3">
            {activityHighlights.map((item) => (
              <article className="card feature-card" key={item.title}>
                <div className="feature-card-dot" />
                <h3 className="feature-card-title">{item.title}</h3>
                <p className="feature-card-text">{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block">
          <div className="section-heading">
            <div className="eyebrow">活动图片</div>
            <h2 className="section-title">活动相关图片展示</h2>
            <p className="section-subtitle">
              这里可以展示爱心万里行活动中的照片、项目地图片或活动现场记录。
            </p>
          </div>

          <div className="gallery-grid">
            <EditableImageCard
              src={siteAssets.journeyMoments[0].src}
              alt={siteAssets.journeyMoments[0].alt}
              title="活动记录 1"
              hint="活动场景展示"
              className="gallery-card"
            />
            <EditableImageCard
              src={siteAssets.journeyMoments[1].src}
              alt={siteAssets.journeyMoments[1].alt}
              title="活动记录 2"
              hint="活动场景展示"
              className="gallery-card"
            />
            <EditableImageCard
              src={siteAssets.journeyMoments[2].src}
              alt={siteAssets.journeyMoments[2].alt}
              title="活动记录 3"
              hint="活动场景展示"
              className="gallery-card"
            />

            <div className="card quick-edit-card">
              <div className="eyebrow">活动提示</div>
              <h3 className="section-title" style={{ fontSize: "24px" }}>
                使用前请先确认
              </h3>

              <div className="quick-edit-list">
                <div className="quick-edit-item">
                  每位同学需要先完成注册，并填写自己的心愿后，活动才会进入正式配对阶段。
                </div>
                <div className="quick-edit-item">
                  配对完成后，心愿会锁定；对应天使可以看到国王的心愿，并在后续活动中执行。
                </div>
                <div className="quick-edit-item">
                  如遇到邀请码、登录或内容填写问题，请联系文建负责人统一处理。
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
