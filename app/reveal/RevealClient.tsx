"use client";

import { useState } from "react";
import {
  aesGcmDecryptString,
  importRawAesKey,
  sha256Hex,
} from "@/lib/crypto/aead";
import { utf8Encode } from "@/lib/crypto/encoding";
import { combineShares } from "@/lib/crypto/sss";
import type { SealedPairing } from "@/lib/types";

const THRESHOLD = 10;

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
      <div className="alert alert-error">
        当前还没有可揭示的封印数据。请等待管理员完成封印后再来。
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
        message: `还差 ${THRESHOLD - unique.length} 份不同的密钥。当前有效密钥：${unique.length} 份。`,
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
        message: `揭示失败：${message}。请确认每份密钥都正确粘贴。`,
      });
    }
  }

  function reset() {
    setShares([""]);
    setState({ kind: "input" });
  }

  if (state.kind === "done") {
    return (
      <div className="stack">
        <div className={state.manifestOk ? "alert alert-success" : "alert alert-error"}>
          {state.manifestOk
            ? `揭示成功，共 ${state.pairs.length} 对配对。`
            : `揭示完成但 manifest_sha256 校验不一致——数据可能在数据库里被篡改过。`}
        </div>

        <div className="list">
          {state.pairs.map((pair, index) => (
            <div className="list-item" key={index}>
              <div style={{ fontWeight: 700 }}>
                天使 {pair.angel_name} → 国王 {pair.king_name}
              </div>
              <ol style={{ paddingLeft: 20, marginTop: 8 }}>
                {pair.king_wishes.map((wish, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    {wish}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        <button type="button" className="button-secondary" onClick={reset}>
          清空并重新输入
        </button>

        <div className="footer-note">
          本页解密完全在浏览器内完成，密钥不会上传服务器。刷新页面后这些信息会消失。
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="footer-note">
        本仪式需要至少 {THRESHOLD} 位参与者**当面合作**，每人将自己拿到的那份密钥粘贴到下方一格中。
        密钥仅在本浏览器内运算，不会上传服务器或写入数据库。
      </div>

      {shares.map((value, index) => (
        <div key={index}>
          <label className="label">第 {index + 1} 份密钥</label>
          <div style={{ display: "flex", gap: 8 }}>
            <textarea
              className="textarea"
              value={value}
              onChange={(event) => updateShare(index, event.target.value)}
              placeholder="粘贴你那份密钥"
              rows={2}
              autoComplete="off"
              spellCheck={false}
              style={{ fontFamily: "monospace", flex: 1 }}
            />
            {shares.length > 1 ? (
              <button
                type="button"
                className="button-secondary"
                onClick={() => removeShareSlot(index)}
              >
                删除
              </button>
            ) : null}
          </div>
        </div>
      ))}

      <div className="button-row">
        <button type="button" className="button-secondary" onClick={addShareSlot}>
          再加一格
        </button>
        <button
          type="button"
          className="button"
          disabled={state.kind === "decrypting"}
          onClick={attemptReveal}
        >
          {state.kind === "decrypting" ? "解密中..." : `合力揭示（≥${THRESHOLD} 份）`}
        </button>
      </div>

      {state.kind === "error" ? (
        <div className="alert alert-error">{state.message}</div>
      ) : null}
    </div>
  );
}
