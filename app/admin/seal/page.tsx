import { redirect } from "next/navigation";
import Link from "next/link";
import { getProfileOrThrow, requireUser } from "@/lib/auth";
import { fetchSealInputsAction } from "@/app/admin/seal/actions";
import { SealRunner } from "@/app/admin/seal/SealRunner";

export default async function SealPage() {
  const user = await requireUser();
  const profile = await getProfileOrThrow(user.id);

  if (!profile.can_admin) {
    redirect("/dashboard");
  }

  const { profiles, wishes, sealStatus } = await fetchSealInputsAction();

  return (
    <main className="page-shell">
      <div className="container">
        <div className="topbar">
          <div className="pill">
            <span>封缄仪式 · 管理员</span>
            <strong>{profile.display_name}</strong>
          </div>
          <Link className="button-secondary" href="/dashboard">
            回到桌前
          </Link>
        </div>

        <section className="stack rise" style={{ gap: 20, marginBottom: 36 }}>
          <p className="meta-cap">once, and only once</p>
          <h1 className="display-title" style={{ fontSize: "clamp(32px, 4.6vw, 52px)" }}>
            为这一季，<em>按下朱印</em>
          </h1>
          <p className="lede">
            所有配对与加密都在你的这台浏览器内完成。服务器只会收到密文，以及 15 份分发名单。
            封缄一旦完成，<strong>任何管理员</strong>都不能再次进入这个页面重做。
          </p>
        </section>

        <div className="rule">
          <span className="rule-dot" />
          <span className="meta-cap">seal chamber</span>
          <span className="rule-dot" />
        </div>

        <section className="sheet sheet-xl rise" style={{ marginTop: 24 }}>
          <SealRunner
            profiles={profiles}
            wishes={wishes}
            alreadySealed={sealStatus === "published"}
          />
        </section>

        <footer className="text-center" style={{ marginTop: 48, color: "var(--ink-muted)", fontSize: 13, lineHeight: 2 }}>
          <div className="meta-cap">seal ceremony · for the custodian only</div>
        </footer>
      </div>
    </main>
  );
}
