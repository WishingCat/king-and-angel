"use client";

import { useEffect, useState } from "react";
import { aesGcmDecryptString } from "@/lib/crypto/aead";
import { base64UrlToBytes } from "@/lib/crypto/encoding";
import { deriveAesKeyFromShare } from "@/lib/crypto/hkdf";
import {
  clearPersonalKey,
  getPersonalKey,
  putPersonalKey,
} from "@/lib/crypto/keystore";
import type { AngelEnvelope } from "@/lib/types";

type RevealedEnvelope = {
  king_id: string;
  king_display_name: string;
  king_wishes: string[];
};

type Props = {
  envelope: AngelEnvelope;
  userId: string;
};

type UiState =
  | { kind: "loading" }
  | { kind: "need_share"; error?: string }
  | { kind: "decrypting" }
  | { kind: "unlocked"; payload: RevealedEnvelope };

const ORDINALS = ["其一", "其二", "其三"] as const;

export function KingReveal({ envelope, userId }: Props) {
  const [state, setState] = useState<UiState>({ kind: "loading" });
  const [shareInput, setShareInput] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cached = await getPersonalKey(userId);
        if (cancelled) return;
        if (!cached) {
          setState({ kind: "need_share" });
          return;
        }
        const plaintext = await aesGcmDecryptString(cached, {
          ct: envelope.ct,
          iv: envelope.iv,
        });
        const parsed = JSON.parse(plaintext) as RevealedEnvelope;
        if (!cancelled) {
          setState({ kind: "unlocked", payload: parsed });
        }
      } catch {
        await clearPersonalKey(userId);
        if (!cancelled) {
          setState({
            kind: "need_share",
            error: "本地缓存的钥匙已失效，请再输入一次。",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [envelope.ct, envelope.iv, userId]);

  async function attemptUnlock(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = shareInput.trim();
    if (!trimmed) {
      setState({ kind: "need_share", error: "请先把钥匙粘贴进来。" });
      return;
    }
    setState({ kind: "decrypting" });
    try {
      const shareBytes = base64UrlToBytes(trimmed);
      const personalKey = await deriveAesKeyFromShare(shareBytes);
      const plaintext = await aesGcmDecryptString(personalKey, {
        ct: envelope.ct,
        iv: envelope.iv,
      });
      const parsed = JSON.parse(plaintext) as RevealedEnvelope;
      await putPersonalKey(userId, personalKey);
      setShareInput("");
      setState({ kind: "unlocked", payload: parsed });
    } catch {
      setState({
        kind: "need_share",
        error: "这把钥匙打不开这封信——请确认粘贴的是你自己的那一把。",
      });
    }
  }

  async function lockLocally() {
    await clearPersonalKey(userId);
    setShareInput("");
    setState({ kind: "need_share" });
  }

  if (state.kind === "loading") {
    return <div className="empty-note">正在寻找本机留存的钥匙……</div>;
  }

  if (state.kind === "need_share" || state.kind === "decrypting") {
    return (
      <form onSubmit={attemptUnlock} className="stack" style={{ gap: 14 }}>
        <div className="key-box">
          <div className="key-ribbon">your personal key</div>
          <label className="label">请将收到的钥匙粘贴在此</label>
          <textarea
            className="textarea input-mono"
            value={shareInput}
            onChange={(event) => setShareInput(event.target.value)}
            placeholder="一长串字符，来自管理员当面分发的那一条"
            rows={3}
            autoComplete="off"
            spellCheck={false}
            disabled={state.kind === "decrypting"}
          />
        </div>

        {state.kind === "need_share" && state.error ? (
          <div className="alert alert-error">{state.error}</div>
        ) : null}

        <div className="row gap-md">
          <button type="submit" className="button" disabled={state.kind === "decrypting"}>
            {state.kind === "decrypting" ? "正在拆开……" : "拆开我的信"}
          </button>
          <span className="meta-cap">解密在本机完成 · 不上传服务器</span>
        </div>
      </form>
    );
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="row gap-md" style={{ alignItems: "flex-start" }}>
        <div className="seal-stamp seal-stamp-sm" aria-hidden="true">
          启
        </div>
        <div style={{ flex: 1 }}>
          <p className="meta-cap">your king</p>
          <h3
            className="section-title"
            style={{ fontSize: 32, marginTop: 4, letterSpacing: "-0.01em" }}
          >
            {state.payload.king_display_name}
          </h3>
        </div>
      </div>

      <div className="rule-dashed" />

      <div>
        <p className="meta-cap">三条心愿</p>
        <ol className="stack" style={{ marginTop: 10, paddingLeft: 0, listStyle: "none", gap: 14 }}>
          {state.payload.king_wishes.map((wish, index) => (
            <li key={index}>
              <div className="wish-field-label" style={{ marginBottom: 4 }}>
                <span className="wish-field-ordinal">{ORDINALS[index]}</span>
              </div>
              <p
                className="entry-body"
                style={{
                  borderLeft: "2px solid var(--seal)",
                  paddingLeft: 14,
                  margin: 0,
                }}
              >
                {wish}
              </p>
            </li>
          ))}
        </ol>
      </div>

      <div className="rule-dashed" />

      <div className="row-between">
        <span className="meta-cap">
          在这台设备上已缓存 · 可随时锁回
        </span>
        <button type="button" className="btn-link" onClick={lockLocally}>
          在此设备上锁
        </button>
      </div>
    </div>
  );
}
