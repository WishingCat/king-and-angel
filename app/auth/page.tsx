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
            ← 返回首页
          </Link>
        </div>

        <section className="hero">
          <div className="card">
            <h1 className="title">登录 / 注册</h1>
            <p className="subtitle">
              第一次使用时，请使用组织者发放的邀请码完成注册，并设置自己的登录密码。
              注册成功后，你可以进入活动控制台填写心愿、查看自己的国王，并在活动过程中完成留言和任务记录。
            </p>
            <FormMessage searchParams={params} />
          </div>

          <div className="card soft-card">
            <h2 className="section-title">邀请码说明</h2>
            <p className="section-subtitle">
              每位参与者对应一个邀请码。邀请码仅可使用一次，注册成功后会与你的账号绑定。
            </p>
            <div className="footer-note">
              如果你在注册时遇到“邀请码不存在”“邀请码已使用”或其他问题，请联系文建负责人进行核对。
              注册完成后，请牢记你填写的邮箱和密码；后续登录时，请直接使用该邮箱和密码进入系统。
            </div>
          </div>
        </section>

        <section className="grid grid-2">
          <div className="card">
            <h2 className="section-title">首次注册</h2>
            <p className="section-subtitle">需要邀请码、邮箱和密码。</p>
            <form action={signUpAction} className="stack">
              <div>
                <label className="label">邀请码</label>
                <input className="input" name="inviteCode" placeholder="例如 A1001" />
              </div>
              <div>
                <label className="label">邮箱</label>
                <input className="input" type="email" name="email" placeholder="name@example.com" />
              </div>
              <div>
                <label className="label">密码</label>
                <input className="input" type="password" name="password" placeholder="至少 6 位" />
              </div>
              <SubmitButton text="完成注册" pendingText="正在注册..." />
            </form>
          </div>

          <div className="card">
            <h2 className="section-title">已有账号，直接登录</h2>
            <p className="section-subtitle">使用注册时填写的邮箱和密码。</p>
            <form action={signInAction} className="stack">
              <div>
                <label className="label">邮箱</label>
                <input className="input" type="email" name="email" placeholder="name@example.com" />
              </div>
              <div>
                <label className="label">密码</label>
                <input className="input" type="password" name="password" placeholder="输入你的密码" />
              </div>
              <SubmitButton text="登录" pendingText="正在登录..." />
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
