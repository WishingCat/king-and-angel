import Link from "next/link";
import { FormMessage } from "@/components/FormMessage";
import { SignOutButton } from "@/components/SignOutButton";
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
            <span>当前持信人</span>
            <strong>{profile.display_name}</strong>
            {profile.can_admin ? <span className="meta-cap">· 管理员</span> : null}
          </div>
          <SignOutButton />
        </div>

        <section className="stack rise" style={{ gap: 22, marginBottom: 48 }}>
          <p className="meta-cap">北京大学爱心社 · 爱心万里行 · 2026 · 福建 永春路</p>
          <h1 className="display-title" style={{ fontSize: "clamp(32px, 4.6vw, 52px)" }}>
            <em>持信人</em> 桌前
          </h1>
          <p className="lede">
            在这里写下三条心愿，等待封缄；封缄之后，用你的钥匙开启自己的那封信；
            其余时候，任意往来——留一句话，贴一件任务。
          </p>

          <div className="badge-row">
            <span className="badge">
              登记 · {participant.stats.participantCount}
              <span style={{ color: "var(--ink-faded)" }}> / {PARTICIPANT_TOTAL}</span>
            </span>
            <span className="badge">
              心愿 · {participant.stats.wishFilledCount}
              <span style={{ color: "var(--ink-faded)" }}> / {PARTICIPANT_TOTAL * 3}</span>
            </span>
            <span className="badge">封缄 · {sealed ? "已封" : "未封"}</span>
            <span className="badge">
              我的心愿 · {ownWishesComplete ? "三条已备" : `已写 ${ownWishCount} / 3`}
            </span>
          </div>

          {Object.keys(params).length > 0 ? (
            <FormMessage searchParams={params} />
          ) : null}
        </section>

        <div className="rule">
          <span className="rule-dot" />
          <span className="meta-cap">the letters</span>
          <span className="rule-dot" />
        </div>

        <section className="sheet sheet-xl rise" style={{ marginBottom: 32 }}>
          <div className="row-between mb-2" style={{ alignItems: "baseline" }}>
            <div>
              <span className="chapter-no">
                <span className="chapter-label">其一</span>
                <span>三条心愿</span>
              </span>
              <h2 className="section-title">写一封给自己国王的预告</h2>
            </div>
            <span className="meta-cap">{ownWishCount} / 3 writ</span>
          </div>
          <p className="section-subtitle mb-3">
            不必工整，不必完美。一件想被陪伴的小事就够了。封缄前可反复修改；封缄之后，
            这三条心愿只出现在对应天使的信里。
          </p>

          <WishEditor
            initialWishes={participant.ownWishes}
            sealStatus={participant.sealState.status}
          />
        </section>

        <section className="sheet sheet-xl rise" style={{ marginBottom: 32 }}>
          <div className="row-between mb-2" style={{ alignItems: "baseline" }}>
            <div>
              <span className="chapter-no">
                <span className="chapter-label">其二</span>
                <span>开启信笺</span>
              </span>
              <h2 className="section-title">我的国王，在这封信里</h2>
            </div>
          </div>
          <p className="section-subtitle mb-3">
            封缄之后，你将收到一把专属的钥匙。只有这把钥匙能在这台浏览器上拆开你那封信。
          </p>

          {!sealed ? (
            <div className="empty-note">
              — 尚未封缄。等待 {PARTICIPANT_TOTAL} 人齐聚，且每人都备好三条心愿。 —
              <div className="mt-1 meta-cap" style={{ fontStyle: "normal", fontFamily: "var(--f-han)" }}>
                登记 {participant.stats.participantCount} / {PARTICIPANT_TOTAL}
                　·　心愿 {participant.stats.wishFilledCount} / {PARTICIPANT_TOTAL * 3}
              </div>
            </div>
          ) : participant.angelEnvelope ? (
            <KingReveal envelope={participant.angelEnvelope} userId={user.id} />
          ) : (
            <div className="alert alert-error">
              未在本账户找到专属信封——请联系管理员确认。
            </div>
          )}
        </section>

        <div className="rule">
          <span className="rule-dot" />
          <span className="meta-cap">the wall & the board</span>
          <span className="rule-dot" />
        </div>

        <section className="grid grid-2 rise" style={{ marginTop: 32, marginBottom: 32 }}>
          <div className="sheet sheet-xl">
            <span className="chapter-no">
              <span className="chapter-label">其三</span>
              <span>留言墙</span>
            </span>
            <h2 className="section-title">不署名的一面墙</h2>
            <p className="section-subtitle mb-3">
              所有人都能看，所有人都能写。这面墙不记录是谁贴上去的。
            </p>
            <MessageBoard messages={participant.messages} />
          </div>

          <div className="sheet sheet-xl">
            <span className="chapter-no">
              <span className="chapter-label">其四</span>
              <span>任务板</span>
            </span>
            <h2 className="section-title">公共任务板</h2>
            <p className="section-subtitle mb-3">
              匿名贴上任务条；任何人都可以接取。完成由接取者本人勾选。
            </p>
            <TaskBoard tasks={participant.tasks} currentUserId={user.id} />
          </div>
        </section>

        {adminSummary ? (
          <>
            <div className="rule">
              <span className="rule-dot" />
              <span className="meta-cap">register desk</span>
              <span className="rule-dot" />
            </div>

            <section className="sheet sheet-xl rise" style={{ marginTop: 32 }}>
              <div>
                <span className="chapter-no">
                  <span className="chapter-label">登记台</span>
                  <span>for administrators</span>
                </span>
                <h2 className="section-title">总览与封缄入口</h2>
                <p className="section-subtitle mb-3">
                  管理员看不到任何一封信的内容——只看到总体进度。封缄按钮仅在全员齐备时开启。
                </p>
              </div>

              <div className="grid grid-3 mt-2">
                <div className="stat">
                  <div className="stat-label">registered</div>
                  <div className="stat-value">
                    {adminSummary.participantCount}
                    <span className="slash">/</span>
                    <span style={{ color: "var(--ink-faded)" }}>{adminSummary.participantTotal}</span>
                  </div>
                </div>
                <div className="stat">
                  <div className="stat-label">wishes filed</div>
                  <div className="stat-value">
                    {adminSummary.wishRowCount}
                    <span className="slash">/</span>
                    <span style={{ color: "var(--ink-faded)" }}>{adminSummary.participantTotal * 3}</span>
                  </div>
                </div>
                <div className="stat">
                  <div className="stat-label">seal state</div>
                  <div className="stat-value">
                    {adminSummary.sealState.status === "published" ? "sealed" : "open"}
                  </div>
                </div>
              </div>

              <div className="grid grid-3 mt-2">
                <div className="stat">
                  <div className="stat-label">wall posts</div>
                  <div className="stat-value">{adminSummary.messageCount}</div>
                </div>
                <div className="stat">
                  <div className="stat-label">task cards</div>
                  <div className="stat-value">{adminSummary.taskCount}</div>
                </div>
                <div className="stat">
                  <div className="stat-label">envelopes out</div>
                  <div className="stat-value">
                    {adminSummary.envelopeCount}
                    <span className="slash">/</span>
                    <span style={{ color: "var(--ink-faded)" }}>{adminSummary.participantTotal}</span>
                  </div>
                </div>
              </div>

              <div className="rule-dashed" />

              <div className="row-between">
                <div>
                  <p className="meta-cap">封缄仪式</p>
                  <p className="footer-note" style={{ marginTop: 4 }}>
                    {adminSummary.sealState.status === "published"
                      ? "已完成封缄，任何管理员无法再次执行。如确需重做，请联系 DBA 手工处理。"
                      : fullyReady
                        ? "全员齐备——可以前往封缄了。封缄为一次性操作。"
                        : "等待全员到齐且每人心愿三条齐备后，封缄入口才会亮起。"}
                  </p>
                </div>
                {adminSummary.sealState.status !== "published" && fullyReady ? (
                  <Link className="button" href="/admin/seal">
                    前往封缄仪式 →
                  </Link>
                ) : null}
              </div>
            </section>
          </>
        ) : null}

        <footer className="text-center" style={{ marginTop: 64, color: "var(--ink-muted)", fontSize: 13, lineHeight: 2 }}>
          <div className="meta-cap">北京大学爱心社 · 2026</div>
          <div style={{ marginTop: 4 }}>
            with warmth and silence · 福建 永春路
          </div>
        </footer>
      </div>
    </main>
  );
}
