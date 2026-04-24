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
        // Stored key no longer decrypts (e.g. seal was reset server-side).
        await clearPersonalKey(userId);
        if (!cancelled) {
          setState({
            kind: "need_share",
            error: "本地缓存的密钥已失效，请重新输入。",
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
      setState({ kind: "need_share", error: "请先粘贴你的密钥。" });
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
        error: "密钥不正确，解锁失败。请确认粘贴的是你自己的那一把。",
      });
    }
  }

  async function lockLocally() {
    await clearPersonalKey(userId);
    setShareInput("");
    setState({ kind: "need_share" });
  }

  if (state.kind === "loading") {
    return (
      <div className="list-item">
        <div className="small">正在检查本地密钥...</div>
      </div>
    );
  }

  if (state.kind === "need_share" || state.kind === "decrypting") {
    return (
      <form onSubmit={attemptUnlock} className="stack">
        <div>
          <label className="label">请输入你收到的密钥</label>
          <textarea
            className="textarea"
            value={shareInput}
            onChange={(event) => setShareInput(event.target.value)}
            placeholder="把管理员发给你的那串字符粘贴到这里"
            rows={3}
            autoComplete="off"
            spellCheck={false}
            style={{ fontFamily: "monospace" }}
            disabled={state.kind === "decrypting"}
          />
        </div>

        {state.kind === "need_share" && state.error ? (
          <div className="alert alert-error">{state.error}</div>
        ) : null}

        <button type="submit" className="button" disabled={state.kind === "decrypting"}>
          {state.kind === "decrypting" ? "解密中..." : "解锁我的国王"}
        </button>

        <div className="footer-note">
          密钥在本机浏览器内完成解密，不会上传服务器。解锁后会在本设备缓存，下次登录自动展示。
        </div>
      </form>
    );
  }

  // unlocked
  return (
    <div className="stack">
      <div className="list-item">
        <div className="small">我的国王</div>
        <div className="big-inline-value">{state.payload.king_display_name}</div>
      </div>

      <div className="list-item">
        <div className="small">国王的 3 条心愿</div>
        <ol style={{ paddingLeft: 20, marginTop: 8 }}>
          {state.payload.king_wishes.map((wish, index) => (
            <li key={index} style={{ marginBottom: 8 }}>
              {wish}
            </li>
          ))}
        </ol>
      </div>

      <button type="button" className="button-secondary" onClick={lockLocally}>
        在此设备锁定 / 清除本地密钥
      </button>

      <div className="footer-note">
        如果你更换了设备，或想让这台设备不再自动展示国王信息，点击上方按钮即可清除本地缓存。
      </div>
    </div>
  );
}
