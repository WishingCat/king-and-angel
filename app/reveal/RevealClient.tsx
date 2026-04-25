"use client";

import { useState } from "react";
import {
  aesGcmDecryptString,
  importRawAesKey,
  sha256Hex,
} from "@/lib/crypto/aead";
import { utf8Encode } from "@/lib/crypto/encoding";
import { combineShares } from "@/lib/crypto/sss";
import { REVEAL_THRESHOLD } from "@/lib/config";
import type { SealedPairing } from "@/lib/types";

const THRESHOLD = REVEAL_THRESHOLD;
const ORDINALS = ["其一", "其二", "其三"] as const;

type Pair = {
  angel_id: string;
  angel_name: string;
  king_id: string;
  king_name: string;
  king_wishes: string[];
};

type Decoded = {
  version: number;
  pairs: Pair[];
};

type Props = {
  sealed: SealedPairing | null;
};

type State =
  | { kind: "input" }
  | { kind: "decrypting" }
  | { kind: "done"; pairs: Pair[]; manifestOk: boolean }
  | { kind: "error"; message: string };

export function RevealClient({ sealed }: Props) {
  const [shares, setShares] = useState<string[]>([""]);
  const [state, setState] = useState<State>({ kind: "input" });

  if (!sealed) {
    return (
      <div className="empty-note">
        — 尚无封缄数据。请等待管理员完成封缄仪式后再来。 —
      </div>
    );
  }

  const sealedNonNull = sealed;

  function updateShare(index: number, value: string) {
    const next = [...shares];
    next[index] = value;
    setShares(next);
  }

  function addShareSlot() {
    setShares([...shares, ""]);
  }

  function removeShareSlot(index: number) {
    if (shares.length === 1) return;
    setShares(shares.filter((_, i) => i !== index));
  }

  async function attemptReveal() {
    const cleaned = shares.map((s) => s.trim()).filter((s) => s.length > 0);
    const unique = Array.from(new Set(cleaned));

    if (unique.length < THRESHOLD) {
      setState({
        kind: "error",
        message: `还差 ${THRESHOLD - unique.length} 把不同的钥匙。当前有效：${unique.length} 把。`,
      });
      return;
    }

    setState({ kind: "decrypting" });
    try {
      const activityKeyBytes = await combineShares(unique);
      const activityKey = await importRawAesKey(activityKeyBytes, false);
      const plaintext = await aesGcmDecryptString(activityKey, {
        ct: sealedNonNull.ct,
        iv: sealedNonNull.iv,
      });

      const manifestActual = await sha256Hex(utf8Encode(plaintext));
      const manifestOk = manifestActual === sealedNonNull.manifest_sha256;

      const decoded = JSON.parse(plaintext) as Decoded;
      setState({ kind: "done", pairs: decoded.pairs, manifestOk });
    } catch (err) {
      const message = err instanceof Error ? err.message : "解密失败。";
      setState({
        kind: "error",
        message: `揭示失败：${message}。请确认每把钥匙都正确粘贴。`,
      });
    }
  }

  function reset() {
    setShares([""]);
    setState({ kind: "input" });
  }

  if (state.kind === "done") {
    return (
      <div className="stack" style={{ gap: 22 }}>
        <div className="row gap-md" style={{ alignItems: "center" }}>
          <div className="seal-stamp" aria-hidden="true">
            启
          </div>
          <div>
            <p className="meta-cap">
              {state.manifestOk ? "verified · intact" : "warning · tampered?"}
            </p>
            <h2 className="section-title">
              {state.manifestOk
                ? `这一季的全貌 · ${state.pairs.length} 对`
                : "名册已解开，但校验不一致"}
            </h2>
          </div>
        </div>

        {!state.manifestOk ? (
          <div className="alert alert-error">
            <strong>manifest_sha256 不匹配。</strong>
            数据库中的密文可能被篡改过——请谨慎对待以下内容。
          </div>
        ) : null}

        <div className="registry sheet-plain" style={{ padding: 0 }}>
          {state.pairs.map((pair, index) => (
            <div
              className="registry-row"
              style={{ padding: "18px 20px", gridTemplateColumns: "1fr" }}
              key={index}
            >
              <div>
                <div className="row gap-md mb-1" style={{ alignItems: "baseline" }}>
                  <span className="meta-cap">
                    №{(index + 1).toString().padStart(2, "0")}
                  </span>
                  <span className="entry-title" style={{ margin: 0 }}>
                    天使 {pair.angel_name}
                  </span>
                  <span style={{ color: "var(--seal)", fontSize: 18 }}>→</span>
                  <span className="entry-title" style={{ margin: 0 }}>
                    国王 {pair.king_name}
                  </span>
                </div>
                <ol
                  className="stack"
                  style={{ paddingLeft: 0, listStyle: "none", gap: 8, marginTop: 8 }}
                >
                  {pair.king_wishes.map((wish, i) => (
                    <li key={i}>
                      <span className="wish-field-ordinal" style={{ fontSize: 14 }}>
                        {ORDINALS[i]}
                      </span>
                      <span
                        className="entry-body"
                        style={{
                          marginLeft: 10,
                          borderLeft: "2px solid var(--seal-wash)",
                          paddingLeft: 10,
                        }}
                      >
                        {wish}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          ))}
        </div>

        <div className="row-between">
          <span className="meta-cap">
            解密在本机完成 · 刷新即消失
          </span>
          <button type="button" className="button-secondary" onClick={reset}>
            清空 · 重新输入
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 22 }}>
      <p className="lede" style={{ fontSize: 15 }}>
        请至少 {THRESHOLD} 位参与者当面合作。每人将自己的那把钥匙粘贴到下方一格中。
        钥匙仅在本浏览器内运算，不会上传服务器。
      </p>

      <div className="stack" style={{ gap: 14 }}>
        {shares.map((value, index) => (
          <div className="key-box" key={index}>
            <div className="key-ribbon">
              key №{(index + 1).toString().padStart(2, "0")}
            </div>
            <div className="row gap-sm">
              <textarea
                className="textarea input-mono"
                value={value}
                onChange={(event) => updateShare(index, event.target.value)}
                placeholder="粘贴一把钥匙"
                rows={2}
                autoComplete="off"
                spellCheck={false}
                style={{ flex: 1 }}
              />
              {shares.length > 1 ? (
                <button
                  type="button"
                  className="button-secondary"
                  style={{ alignSelf: "flex-start" }}
                  onClick={() => removeShareSlot(index)}
                >
                  移除
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="row gap-md">
        <button type="button" className="button-secondary" onClick={addShareSlot}>
          再加一格
        </button>
        <button
          type="button"
          className="button"
          disabled={state.kind === "decrypting"}
          onClick={attemptReveal}
        >
          {state.kind === "decrypting"
            ? "正在拼合……"
            : `合力揭示 · 需 ≥${THRESHOLD} 把`}
        </button>
      </div>

      {state.kind === "error" ? (
        <div className="alert alert-error">{state.message}</div>
      ) : null}
    </div>
  );
}
