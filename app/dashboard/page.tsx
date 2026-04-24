import Link from "next/link";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { EditableImageCard } from "@/components/EditableImageCard";
import { KingReveal } from "@/app/dashboard/KingReveal";
import { MessageBoard } from "@/app/dashboard/MessageBoard";
import { TaskBoard } from "@/app/dashboard/TaskBoard";
import { WishEditor } from "@/app/dashboard/WishEditor";
import {
  getAdminSummary,
  getParticipantDashboard,
  PARTICIPANT_TOTAL,
} from "@/lib/dashboard";
import { getProfileOrThrow, requireUser } from "@/lib/auth";
import { siteAssets } from "@/lib/site-assets";
import { signOutFromDashboardAction } from "@/app/dashboard/actions";

type PageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const user = await requireUser();
  const profile = await getProfileOrThrow(user.id);
  const participant = await getParticipantDashboard(user.id);
  const adminSummary = profile.can_admin ? await getAdminSummary() : null;

  const sealed = participant.sealState.status === "published";
  const ownWishCount = participant.ownWishes.length;
  const ownWishesComplete = ownWishCount === 3;
  const fullyReady =
    participant.stats.participantCount === PARTICIPANT_TOTAL &&
    participant.stats.wishFilledCount === PARTICIPANT_TOTAL * 3;

  return (
    <main className="page-shell">
      <div className="container">
        <div className="topbar">
          <div className="pill">
            当前登录：<strong>{profile.display_name}</strong>
            {profile.can_admin ? "（管理员）" : ""}
          </div>
          <form action={signOutFromDashboardAction}>
            <SubmitButton
              text="退出登录"
              pendingText="退出中..."
              className="button-secondary"
            />
          </form>
        </div>

        <section className="hero hero-rich">
          <div className="card hero-copy-card">
            <div className="eyebrow">国王与天使 · 加密版</div>
            <h1 className="title">北大爱心社 · 爱心万里行 2026 · 福建永春路</h1>
            <p className="subtitle">
              填写 3 条心愿 · 等待封印 · 用你的专属密钥查看国王 · 活动结束时 10 人合力揭示全貌。
            </p>

            <div className="badge-row">
              <span className="badge">
                注册进度：{participant.stats.participantCount} / {PARTICIPANT_TOTAL}
              </span>
              <span className="badge">
                心愿填写：{participant.stats.wishFilledCount} / {PARTICIPANT_TOTAL * 3}
              </span>
              <span className="badge">
                封印状态：{sealed ? "已封印" : "未封印"}
              </span>
              <span className="badge">
                我的心愿：{ownWishesComplete ? "已完成" : `${ownWishCount}/3`}
              </span>
            </div>

            <div style={{ marginTop: 16 }}>
              <FormMessage searchParams={params} />
            </div>
          </div>

          <EditableImageCard
            src={siteAssets.dashboardBanner.src}
            alt={siteAssets.dashboardBanner.alt}
            title={siteAssets.dashboardBanner.title}
            hint={siteAssets.dashboardBanner.hint}
            className="dashboard-banner-card"
            priority
          />
        </section>

        <section className="grid grid-2" style={{ marginBottom: 24 }}>
          <div className="card">
            <div className="section-heading compact-heading">
              <div className="eyebrow">第一步</div>
              <h2 className="section-title">我的 3 条心愿</h2>
              <p className="section-subtitle">
                在封印前可以反复修改。一旦管理员执行封印，心愿会以加密形式分发给对应的天使，之后便无法再修改。
              </p>
            </div>

            <WishEditor
              initialWishes={participant.ownWishes}
              sealStatus={participant.sealState.status}
            />
          </div>

          <div className="card soft-card">
            <div className="section-heading compact-heading">
              <div className="eyebrow">第二步</div>
              <h2 className="section-title">我的国王</h2>
              <p className="section-subtitle">
                配对封印后，你会在这里输入自己的专属密钥，查看对应国王和 3 条心愿。
              </p>
            </div>

            {!sealed ? (
              <div className="list-item">
                <div className="small">尚未封印</div>
                <div style={{ marginTop: 6 }}>
                  等待全部 {PARTICIPANT_TOTAL} 人注册并填完心愿，管理员才能执行封印。
                </div>
                <div className="footer-note" style={{ marginTop: 8 }}>
                  距离齐全：参与者 {participant.stats.participantCount}/{PARTICIPANT_TOTAL}
                  ，心愿 {participant.stats.wishFilledCount}/{PARTICIPANT_TOTAL * 3}。
                </div>
              </div>
            ) : participant.angelEnvelope ? (
              <KingReveal envelope={participant.angelEnvelope} userId={user.id} />
            ) : (
              <div className="list-item">
                <div className="small">已封印</div>
                <div style={{ marginTop: 6 }}>
                  未在本账户找到专属 envelope，请联系管理员确认。
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="grid grid-2" style={{ marginBottom: 24 }}>
          <div className="card">
            <div className="section-heading compact-heading">
              <div className="eyebrow">留言区</div>
              <h2 className="section-title">匿名留言板</h2>
              <p className="section-subtitle">
                所有人都能看到全部留言，但平台不记录发送者身份。
              </p>
            </div>
            <MessageBoard messages={participant.messages} />
          </div>

          <div className="card">
            <div className="section-heading compact-heading">
              <div className="eyebrow">任务板</div>
              <h2 className="section-title">公共任务板</h2>
              <p className="section-subtitle">
                任何人都能匿名上传任务；任何人都能实名接取；接取者自己点击完成。
              </p>
            </div>
            <TaskBoard tasks={participant.tasks} currentUserId={user.id} />
          </div>
        </section>

        {adminSummary ? (
          <section className="card">
            <div className="section-heading">
              <div className="eyebrow">管理员面板</div>
              <h2 className="section-title">活动总览</h2>
              <p className="section-subtitle">
                管理员可以查看整体进度和状态，真正的配对内容对管理员也不可见（封印后只剩密文）。
              </p>
            </div>

            <section className="grid grid-3" style={{ marginBottom: 18 }}>
              <div className="list-item">
                <div className="small">注册人数</div>
                <div className="kv-value">
                  {adminSummary.participantCount} / {adminSummary.participantTotal}
                </div>
              </div>
              <div className="list-item">
                <div className="small">心愿填写行数</div>
                <div className="kv-value">
                  {adminSummary.wishRowCount} / {adminSummary.participantTotal * 3}
                </div>
              </div>
              <div className="list-item">
                <div className="small">封印状态</div>
                <div className="kv-value">
                  {adminSummary.sealState.status === "published" ? "已封印" : "未封印"}
                </div>
              </div>
            </section>

            <section className="grid grid-3" style={{ marginBottom: 18 }}>
              <div className="list-item">
                <div className="small">留言数</div>
                <div className="kv-value">{adminSummary.messageCount}</div>
              </div>
              <div className="list-item">
                <div className="small">任务数</div>
                <div className="kv-value">{adminSummary.taskCount}</div>
              </div>
              <div className="list-item">
                <div className="small">已分发 envelope</div>
                <div className="kv-value">
                  {adminSummary.envelopeCount} / {adminSummary.participantTotal}
                </div>
              </div>
            </section>

            <section className="list-item">
              <div className="small">封印入口</div>
              {adminSummary.sealState.status === "published" ? (
                <div className="footer-note" style={{ marginTop: 10 }}>
                  已经完成封印，任何管理员都无法再次执行。如需重来，只能由 DBA 手工操作数据库。
                </div>
              ) : fullyReady ? (
                <div style={{ marginTop: 10 }}>
                  <Link className="button" href="/admin/seal">
                    进入封印流程
                  </Link>
                  <div className="footer-note" style={{ marginTop: 8 }}>
                    注：封印是一次性操作，执行后任何管理员都不能再分配。
                  </div>
                </div>
              ) : (
                <div className="footer-note" style={{ marginTop: 10 }}>
                  等待 {PARTICIPANT_TOTAL} 人全部注册且每人填满 3 条心愿，封印入口才会开启。
                </div>
              )}
            </section>
          </section>
        ) : null}
      </div>
    </main>
  );
}
