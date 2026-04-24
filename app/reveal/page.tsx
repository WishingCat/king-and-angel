import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { RevealClient } from "@/app/reveal/RevealClient";
import type { SealedPairing } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RevealPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("sealed_pairing")
    .select("id, ct, iv, manifest_sha256, created_at")
    .eq("id", 1)
    .maybeSingle();

  return (
    <main className="page-shell">
      <div className="container">
        <div className="topbar">
          <div className="pill">揭示仪式</div>
          <Link className="button-secondary" href="/dashboard">
            返回控制台
          </Link>
        </div>

        <section className="card">
          <div className="section-heading">
            <div className="eyebrow">活动结束</div>
            <h1 className="section-title">国王天使揭示仪式</h1>
            <p className="section-subtitle">
              收齐至少 10 份密钥，本页将在浏览器内本地重组主密钥并解密完整配对。任何参与者、网站运营者
              和数据库管理员都没法少于 10 份完成揭示。
            </p>
          </div>

          <RevealClient sealed={(data as SealedPairing | null) ?? null} />
        </section>
      </div>
    </main>
  );
}
