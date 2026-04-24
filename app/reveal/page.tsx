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
          <div className="pill">
            <span>揭示仪式</span>
            <strong>the gathering</strong>
          </div>
          <Link className="button-secondary" href="/dashboard">
            回到桌前
          </Link>
        </div>

        <section className="stack rise" style={{ gap: 20, marginBottom: 36 }}>
          <p className="meta-cap">the last chapter</p>
          <h1 className="display-title" style={{ fontSize: "clamp(32px, 4.6vw, 52px)" }}>
            把钥匙<em>聚在一起</em>
          </h1>
          <p className="lede">
            一整季的心愿都被封在一张加密的名册里，只有把至少 10 把钥匙同时并在一处，
            才能把它拆开。请当面聚在同一台电脑前，依次粘贴各自的那一把。
          </p>
        </section>

        <div className="rule">
          <span className="rule-dot" />
          <span className="meta-cap">keys &amp; cipher</span>
          <span className="rule-dot" />
        </div>

        <section className="sheet sheet-xl rise" style={{ marginTop: 24 }}>
          <RevealClient sealed={(data as SealedPairing | null) ?? null} />
        </section>

        <footer className="text-center" style={{ marginTop: 48, color: "var(--ink-muted)", fontSize: 13, lineHeight: 2 }}>
          <div className="meta-cap">sub rosa · with gratitude</div>
        </footer>
      </div>
    </main>
  );
}
