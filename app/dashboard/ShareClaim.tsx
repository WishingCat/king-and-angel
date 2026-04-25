"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { consumeOwnShareAction } from "@/app/dashboard/actions";

type Props = {
  share: string;
};

type State =
  | { kind: "idle" }
  | { kind: "destroying" }
  | { kind: "error"; message: string };

export function ShareClaim({ share }: Props) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [copied, setCopied] = useState(false);
  const [confirmedSaved, setConfirmedSaved] = useState(false);

  async function copyShare() {
    try {
      await navigator.clipboard.writeText(share);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setState({ kind: "error", message: "复制失败——请手动选中下面那一行复制。" });
    }
  }

  async function destroy() {
    setState({ kind: "destroying" });
    const result = await consumeOwnShareAction();
    if (!result.ok) {
      setState({ kind: "error", message: `销毁失败：${result.error}` });
      return;
    }
    // Re-fetch the dashboard so the share card disappears and KingReveal
    // becomes the natural next step.
    router.refresh();
  }

  return (
    <div
      className="sheet sheet-xl"
      style={{
        borderColor: "var(--ink)",
        background: "var(--paper-soft)",
      }}
    >
      <span className="chapter-no">
        <span className="chapter-label">领钥匙</span>
        <span>your key, once</span>
      </span>
      <h2 className="section-title">这是属于你的那一把</h2>

      <p className="section-subtitle mb-3">
        把它复制保存到任意安全的地方——笔记、密码管理器、截图都可以。
        点下方的 “我已收下” 之后，服务器会立刻销毁它，<strong>无法再次取回</strong>。
        你之后用这把钥匙在「其二·开启信笺」拆开你的那封信。
      </p>

      <div
        style={{
          fontFamily: "var(--f-mono, ui-monospace, SFMono-Regular, monospace)",
          fontSize: 14,
          padding: "14px 16px",
          background: "var(--paper)",
          border: "1px solid var(--rule)",
          borderRadius: "var(--r-md)",
          wordBreak: "break-all",
          userSelect: "all",
          marginBottom: 14,
        }}
      >
        {share}
      </div>

      <div className="row gap-md" style={{ flexWrap: "wrap", marginBottom: 18 }}>
        <button type="button" className="button-secondary" onClick={copyShare}>
          {copied ? "已复制 ✓" : "一键复制"}
        </button>
      </div>

      <label
        className="row gap-md"
        style={{
          padding: "12px 14px",
          border: "1px dashed var(--rule)",
          borderRadius: "var(--r-md)",
          background: "var(--paper)",
          marginBottom: 14,
        }}
      >
        <input
          type="checkbox"
          checked={confirmedSaved}
          onChange={(event) => setConfirmedSaved(event.target.checked)}
          style={{ width: 16, height: 16 }}
        />
        <span style={{ fontSize: 14 }}>
          我已把这把钥匙复制到安全的地方，确认可以销毁服务器上的副本。
        </span>
      </label>

      {state.kind === "error" ? (
        <div className="alert alert-error" style={{ marginBottom: 14 }}>
          {state.message}
        </div>
      ) : null}

      <div>
        <button
          type="button"
          className="button-danger"
          disabled={!confirmedSaved || state.kind === "destroying"}
          onClick={destroy}
        >
          {state.kind === "destroying" ? "正在销毁..." : "我已收下 · 销毁服务器副本"}
        </button>
      </div>

      <p className="footer-note" style={{ marginTop: 14 }}>
        若 7 天内你没点这个按钮，服务器会自动清掉这把钥匙——
        到时候没有任何方式找回，只能让管理员重新封缄。
      </p>
    </div>
  );
}
