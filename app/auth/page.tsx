import Link from "next/link";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { signInAction, signUpAction } from "@/app/auth/actions";

type PageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function AuthPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};

  return (
    <main className="page-shell">
      <div className="container">
        <div className="topbar">
          <Link className="pill" href="/">
            ← 返回封面
          </Link>
          <span className="meta-cap">2026 · 福建 永春路</span>
        </div>

        <section className="stack rise" style={{ gap: 22, marginBottom: 36 }}>
          <p className="meta-cap">register · sign in</p>
          <h1 className="display-title" style={{ fontSize: "clamp(34px, 5vw, 54px)" }}>
            登记，<em>或者归位</em>
          </h1>
          <p className="lede">
            首次前来，请用组织者当面交付的邀请码完成登记；之后凭注册时的邮箱和密码归位即可。
            邀请码只能用一次——登记完成便与账户绑定。
          </p>
          <FormMessage searchParams={params} />
        </section>

        <div className="rule">
          <span className="rule-dot" />
          <span className="meta-cap">two doors</span>
          <span className="rule-dot" />
        </div>

        <section className="grid grid-2 rise" style={{ marginTop: 24 }}>
          <div className="sheet sheet-xl">
            <span className="chapter-no">
              <span className="chapter-label">其一</span>
              <span>first time here</span>
            </span>
            <h2 className="section-title">凭邀请码登记</h2>
            <p className="section-subtitle mb-3">
              三件物事：一枚邀请码、一个邮箱、一组至少六位的密码。
            </p>

            <form action={signUpAction} className="stack" style={{ gap: 14 }}>
              <div>
                <label className="label">邀请码</label>
                <input
                  className="input input-mono"
                  name="inviteCode"
                  placeholder="例如 A1001"
                  autoCapitalize="characters"
                />
              </div>
              <div>
                <label className="label">邮箱</label>
                <input
                  className="input"
                  type="email"
                  name="email"
                  placeholder="name@example.com"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="label">密码</label>
                <input
                  className="input"
                  type="password"
                  name="password"
                  placeholder="至少 6 位"
                  autoComplete="new-password"
                />
              </div>
              <div className="row gap-md mt-1">
                <SubmitButton text="完成登记" pendingText="正在登记……" />
                <span className="meta-cap">邀请码仅可使用一次</span>
              </div>
            </form>
          </div>

          <div className="sheet sheet-xl">
            <span className="chapter-no">
              <span className="chapter-label">其二</span>
              <span>welcome back</span>
            </span>
            <h2 className="section-title">已有账户 · 归位</h2>
            <p className="section-subtitle mb-3">
              使用登记时填写的邮箱与密码即可。
            </p>

            <form action={signInAction} className="stack" style={{ gap: 14 }}>
              <div>
                <label className="label">邮箱</label>
                <input
                  className="input"
                  type="email"
                  name="email"
                  placeholder="name@example.com"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="label">密码</label>
                <input
                  className="input"
                  type="password"
                  name="password"
                  placeholder="输入你的密码"
                  autoComplete="current-password"
                />
              </div>
              <div className="row gap-md mt-1">
                <SubmitButton text="归位 · 进入桌前" pendingText="正在登录……" />
              </div>
            </form>
          </div>
        </section>

        <section className="sheet sheet-xl rise mt-4" style={{ marginTop: 32 }}>
          <span className="chapter-no">
            <span className="chapter-label">附记</span>
            <span>about your invite code</span>
          </span>
          <h2 className="section-title">关于邀请码</h2>
          <p className="lede mt-2">
            每位参与者对应一枚邀请码——它决定了你在登记表上的姓名与是否拥有管理员权限。
            如遇「邀请码不存在」「邀请码已被使用」等情况，请联系组织者核对。
            登记完成后请妥善保管邮箱与密码。
          </p>
        </section>

        <footer className="text-center" style={{ marginTop: 64, color: "var(--ink-muted)", fontSize: 13, lineHeight: 2 }}>
          <div className="meta-cap">北京大学爱心社 · 2026 王键豪 涂增基</div>
          <div style={{ marginTop: 4 }}>
            with warmth and silence
          </div>
        </footer>
      </div>
    </main>
  );
}
