"use client";

import { useState } from "react";
import { KingReveal } from "@/app/dashboard/KingReveal";
import { ShareClaim } from "@/app/dashboard/ShareClaim";
import type { AngelEnvelope } from "@/lib/types";

type Tab = "king" | "wishes";

type Props = {
  angelEnvelope: AngelEnvelope | null;
  userId: string;
  ownWishCount: number;
  pendingShare: string | null;
};

export function LettersTabs({ angelEnvelope, userId, ownWishCount, pendingShare }: Props) {
  const [tab, setTab] = useState<Tab>("king");

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="stamp-tabs" role="tablist" aria-label="信笺切换">
        <button
          type="button"
          role="tab"
          aria-pressed={tab === "king"}
          className={`stamp-tab ${tab === "king" ? "is-active" : ""}`}
          onClick={() => setTab("king")}
        >
          其二 · 开启信笺
        </button>
        <button
          type="button"
          role="tab"
          aria-pressed={tab === "wishes"}
          className={`stamp-tab ${tab === "wishes" ? "is-active" : ""}`}
          onClick={() => setTab("wishes")}
        >
          其一 · 三条心愿
        </button>
      </div>

      {tab === "king" ? (
        <div className="stack" style={{ gap: 18 }}>
          {pendingShare ? <ShareClaim share={pendingShare} /> : null}

          <div className="sheet sheet-xl">
            <span className="chapter-no">
              <span className="chapter-label">其二</span>
              <span>开启信笺</span>
            </span>
            <h2 className="section-title">我的国王，在这封信里</h2>
            <p className="section-subtitle mb-3">
              用你刚才收下的那把钥匙，在这台浏览器拆开属于你的那封信。
            </p>
            {angelEnvelope ? (
              <KingReveal envelope={angelEnvelope} userId={userId} />
            ) : (
              <div className="alert alert-error">
                未在本账户找到专属信封——请联系管理员确认。
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="sheet sheet-xl">
          <span className="chapter-no">
            <span className="chapter-label">其一</span>
            <span>三条心愿</span>
          </span>
          <h2 className="section-title">已经封进对应的信里</h2>
          <p className="section-subtitle mb-3">
            封缄之时，你写下的三条心愿被加密分发给对应的那位天使。
            原文已从服务器抹去——只剩在那封专属于他/她的信里。
          </p>
          <div className="empty-note">
            — {ownWishCount > 0 ? `${ownWishCount} 条心愿已封存` : "无可显示的心愿记录"} —
          </div>
        </div>
      )}
    </div>
  );
}
