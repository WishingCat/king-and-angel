"use client";

import { useMemo, useState } from "react";
import {
  aesGcmEncryptString,
  exportRawAesKey,
  generateAesKey,
  importRawAesKey,
  sha256Hex,
} from "@/lib/crypto/aead";
import { bytesToBase64, utf8Encode } from "@/lib/crypto/encoding";
import { deriveAesKeyFromShare } from "@/lib/crypto/hkdf";
import { splitSecret } from "@/lib/crypto/sss";
import {
  publishSealAction,
  type SealEnvelopePayload,
  type SealedPairingPayload,
} from "@/app/admin/seal/actions";

type ProfileLite = { id: string; display_name: string };
type WishRow = { user_id: string; wish_index: number; content: string };

type Props = {
  profiles: ProfileLite[];
  wishes: WishRow[];
  alreadySealed: boolean;
};

type ShareLine = {
  participantId: string;
  participantName: string;
  share: string;
};

type RunState =
  | { kind: "idle" }
  | { kind: "running"; step: string }
  | { kind: "ready"; shares: ShareLine[] }
  | { kind: "error"; message: string };

function buildDerangement(ids: string[]): string[] {
  if (ids.length < 2) {
    throw new Error("配对至少需要 2 人。");
  }

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const shuffled = [...ids];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    let valid = true;
    for (let i = 0; i < ids.length; i += 1) {
      if (shuffled[i] === ids[i]) {
        valid = false;
        break;
      }
    }
    if (valid) {
      return shuffled;
    }
  }

  // Fallback: rotate by 1 — guaranteed derangement for n >= 2.
  return ids.map((_, i) => ids[(i + 1) % ids.length]);
}

function groupWishes(wishes: WishRow[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  wishes.forEach((row) => {
    const arr = map.get(row.user_id) ?? [];
    arr[row.wish_index] = row.content;
    map.set(row.user_id, arr);
  });
  return map;
}

export function SealRunner({ profiles, wishes, alreadySealed }: Props) {
  const [state, setState] = useState<RunState>({ kind: "idle" });
  const [acknowledged, setAcknowledged] = useState(false);

  const wishMap = useMemo(() => groupWishes(wishes), [wishes]);
  const everyoneHasThree = useMemo(
    () => profiles.every((p) => (wishMap.get(p.id)?.filter(Boolean).length ?? 0) === 3),
    [profiles, wishMap],
  );

  if (alreadySealed) {
    return (
      <div className="alert alert-success">
        当前活动已经完成封印，任何管理员都无法再次执行。如确实需要重做，请联系数据库管理员手工处理。
      </div>
    );
  }

  if (profiles.length !== 15) {
    return (
      <div className="alert alert-error">
        当前已注册 {profiles.length} 人，需要 15 人齐全才能封印。
      </div>
    );
  }

  if (!everyoneHasThree) {
    return (
      <div className="alert alert-error">
        还有参与者未填满 3 条心愿，请等待全员完成后再来封印。
      </div>
    );
  }

  async function runSeal() {
    setState({ kind: "running", step: "生成配对..." });
    try {
      const ids = profiles.map((p) => p.id);
      const angels = ids;
      const kings = buildDerangement(ids);
      const profileMap = new Map(profiles.map((p) => [p.id, p.display_name]));

      // 1. ACTIVITY_KEY
      setState({ kind: "running", step: "生成主密钥..." });
      const activityKey = await generateAesKey(true);
      const activityKeyBytes = await exportRawAesKey(activityKey);

      // 2. Shamir split
      setState({ kind: "running", step: "拆分 15 份密钥..." });
      const shareStrings = await splitSecret(activityKeyBytes, 15, 10);

      // 3. Per-angel envelope: encrypt under HKDF(share_i)
      setState({ kind: "running", step: "为每位参与者生成专属密文..." });
      const envelopes: SealEnvelopePayload[] = [];
      const shareLines: ShareLine[] = [];
      const fullPairing: Array<{
        angel_id: string;
        angel_name: string;
        king_id: string;
        king_name: string;
        king_wishes: string[];
      }> = [];

      for (let i = 0; i < angels.length; i += 1) {
        const angelId = angels[i];
        const kingId = kings[i];
        const angelName = profileMap.get(angelId) ?? "未知";
        const kingName = profileMap.get(kingId) ?? "未知";
        const kingWishes = (wishMap.get(kingId) ?? []).slice(0, 3);
        if (kingWishes.length !== 3) {
          throw new Error(`${kingName} 的心愿数量不足 3 条，无法封印。`);
        }

        const envelopePlaintext = JSON.stringify({
          king_id: kingId,
          king_display_name: kingName,
          king_wishes: kingWishes,
        });

        const shareBytes = new Uint8Array(
          // base64url decode inline so we don't import helper here
          (await (async () => {
            const { base64UrlToBytes } = await import("@/lib/crypto/encoding");
            return base64UrlToBytes(shareStrings[i]);
          })()),
        );

        const personalKey = await deriveAesKeyFromShare(shareBytes);
        const ciphertext = await aesGcmEncryptString(personalKey, envelopePlaintext);

        envelopes.push({
          angel_user_id: angelId,
          ct: ciphertext.ct,
          iv: ciphertext.iv,
        });

        shareLines.push({
          participantId: angelId,
          participantName: angelName,
          share: shareStrings[i],
        });

        fullPairing.push({
          angel_id: angelId,
          angel_name: angelName,
          king_id: kingId,
          king_name: kingName,
          king_wishes: kingWishes,
        });
      }

      // 4. sealed_pairing under ACTIVITY_KEY (full map for /reveal)
      setState({ kind: "running", step: "封存完整配对..." });
      const fullJson = JSON.stringify({
        version: 1,
        pairs: fullPairing,
      });
      const activityKeyImported = await importRawAesKey(activityKeyBytes, false);
      const sealedCt = await aesGcmEncryptString(activityKeyImported, fullJson);
      const manifest = await sha256Hex(utf8Encode(fullJson));

      const pairing: SealedPairingPayload = {
        ct: sealedCt.ct,
        iv: sealedCt.iv,
        manifest_sha256: manifest,
      };

      // 5. Submit to server (atomic via publish_seal RPC).
      setState({ kind: "running", step: "提交封印..." });
      const result = await publishSealAction({ envelopes, pairing });

      if (!result.ok) {
        setState({ kind: "error", message: result.error });
        return;
      }

      // 6. Wipe local sensitive data — do this last so even crashes earlier
      //    don't leave half-published state.
      void activityKeyBytes.fill(0);

      setState({ kind: "ready", shares: shareLines });
    } catch (err) {
      const message = err instanceof Error ? err.message : "封印过程发生未知错误。";
      setState({ kind: "error", message });
    }
  }

  function wipeAndExit() {
    setState({ kind: "idle" });
    setAcknowledged(false);
    // Force a reload to ensure no in-memory share material lingers.
    window.location.href = "/dashboard?success=" + encodeURIComponent("封印完成。");
  }

  return (
    <div className="stack">
      {state.kind === "idle" ? (
        <>
          <div className="alert alert-error">
            <strong>这是一次性操作。</strong>
            执行后任何管理员都不能再分配。在你点击封印之前，请确认 15 位参与者都已完成 3 条心愿。
          </div>
          <button type="button" className="button-danger" onClick={runSeal}>
            执行封印（不可撤销）
          </button>
        </>
      ) : null}

      {state.kind === "running" ? (
        <div className="alert alert-success">封印进行中：{state.step}</div>
      ) : null}

      {state.kind === "error" ? (
        <>
          <div className="alert alert-error">{state.message}</div>
          <button type="button" className="button-secondary" onClick={() => setState({ kind: "idle" })}>
            返回重试
          </button>
        </>
      ) : null}

      {state.kind === "ready" ? (
        <>
          <div className="alert alert-success">
            封印成功。请将下面 15 把密钥**逐一线下分发**给对应参与者（建议纸条或一对一私聊）。
            离开本页面后这些密钥**不会再显示**——服务器和数据库都没有保存它们。
          </div>

          <div className="list">
            {state.shares.map((line) => (
              <div className="list-item" key={line.participantId}>
                <div style={{ fontWeight: 700 }}>{line.participantName}</div>
                <div
                  className="footer-note"
                  style={{
                    marginTop: 6,
                    fontFamily: "monospace",
                    wordBreak: "break-all",
                    userSelect: "all",
                  }}
                >
                  {line.share}
                </div>
              </div>
            ))}
          </div>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
            我已经把每位参与者的密钥分发出去，准备清空本页。
          </label>

          <button
            type="button"
            className="button"
            disabled={!acknowledged}
            onClick={wipeAndExit}
          >
            分发完毕，清空并返回
          </button>
        </>
      ) : null}
    </div>
  );
}
