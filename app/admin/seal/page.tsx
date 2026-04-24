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
            管理员：<strong>{profile.display_name}</strong>
          </div>
          <Link className="button-secondary" href="/dashboard">
            返回控制台
          </Link>
        </div>

        <section className="card">
          <div className="section-heading">
            <div className="eyebrow">一次性操作</div>
            <h1 className="section-title">国王天使配对 · 封印流程</h1>
            <p className="section-subtitle">
              配对和加密完全在你的浏览器内完成。服务器只接收加密后的密文和 15 份密钥的公开表格。
              执行后 seal_state 会被锁定为 published，任何管理员都不能再次进入此页面执行。
            </p>
          </div>

          <SealRunner
            profiles={profiles}
            wishes={wishes}
            alreadySealed={sealStatus === "published"}
          />
        </section>
      </div>
    </main>
  );
}
