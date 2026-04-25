"use client";

import { useMemo, useState } from "react";
import {
  aesGcmEncryptString,
  exportRawAesKey,
  generateAesKey,
  importRawAesKey,
  sha256Hex,
} from "@/lib/crypto/aead";
import { utf8Encode, base64UrlToBytes } from "@/lib/crypto/encoding";
import { deriveAesKeyFromShare } from "@/lib/crypto/hkdf";
import { splitSecret } from "@/lib/crypto/sss";
import { PARTICIPANT_TOTAL, REVEAL_THRESHOLD, WISHES_PER_PERSON } from "@/lib/config";
import {
  publishSealAction,
  type PendingSharePayload,
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

type DeliveredRow = {
  participantId: string;
  participantName: string;
};

type RunState =
  | { kind: "idle" }
  | { kind: "running"; step: string }
  | { kind: "delivered"; rows: DeliveredRow[] }
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

  const wishMap = useMemo(() => groupWishes(wishes), [wishes]);
  const everyoneHasThree = useMemo(
    () => profiles.every((p) => (wishMap.get(p.id)?.filter(Boolean).length ?? 0) === 3),
    [profiles, wishMap],
  );

  if (alreadySealed && state.kind !== "delivered") {
    return (
      <div className="stack" style={{ gap: 18 }}>
        <div className="row gap-md" style={{ alignItems: "center" }}>
          <div className="seal-stamp" aria-hidden="true">
            缄
          </div>
          <div>
            <p className="meta-cap">already sealed</p>
            <h2 className="section-title">这一季已封缄完毕</h2>
          </div>
        </div>
        <p className="lede">
          钥匙已派发到对应参与者的 dashboard。任何管理员都无法在页面上再次执行封缄。
        </p>
      </div>
    );
  }

  if (!alreadySealed && profiles.length !== PARTICIPANT_TOTAL) {
    return (
      <div className="alert alert-error">
        <strong>人数未齐。</strong>当前已登记 {profiles.length} 人，需要 {PARTICIPANT_TOTAL} 位全部到齐才能封缄。
      </div>
    );
  }

  if (!alreadySealed && !everyoneHasThree) {
    return (
      <div className="alert alert-error">
        <strong>心愿未备。</strong>还有人未填满三条心愿——请等待全员完成后再来。
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
      setState({ kind: "running", step: `拆分 ${PARTICIPANT_TOTAL} 份密钥...` });
      const shareStrings = await splitSecret(activityKeyBytes, PARTICIPANT_TOTAL, REVEAL_THRESHOLD);

      // 3. Per-angel envelope: encrypt under HKDF(share_i)
      setState({ kind: "running", step: "为每位参与者生成专属密文..." });
      const envelopes: SealEnvelopePayload[] = [];
      const shares: PendingSharePayload[] = [];
      const deliveredRows: DeliveredRow[] = [];
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

        const shareBytes = base64UrlToBytes(shareStrings[i]);
        const personalKey = await deriveAesKeyFromShare(shareBytes);
        const ciphertext = await aesGcmEncryptString(personalKey, envelopePlaintext);

        envelopes.push({
          angel_user_id: angelId,
          ct: ciphertext.ct,
          iv: ciphertext.iv,
        });

        shares.push({
          user_id: angelId,
          share: shareStrings[i],
        });

        deliveredRows.push({
          participantId: angelId,
          participantName: angelName,
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
      // The server transaction inserts envelopes + sealed_pairing + pending_shares
      // in one go. After this, the admin's browser drops every shred of share
      // material from memory.
      setState({ kind: "running", step: "提交封印 · 写入各位 dashboard..." });
      const result = await publishSealAction({ envelopes, pairing, shares });

      if (!result.ok) {
        setState({ kind: "error", message: result.error });
        return;
      }

      // 6. Wipe local sensitive data.
      void activityKeyBytes.fill(0);
      shares.length = 0;
      shareStrings.length = 0;

      setState({ kind: "delivered", rows: deliveredRows });
    } catch (err) {
      const message = err instanceof Error ? err.message : "封印过程发生未知错误。";
      setState({ kind: "error", message });
    }
  }

  function exitToDashboard() {
    window.location.href = "/dashboard?success=" + encodeURIComponent("封印完成。");
  }

  return (
    <div className="stack" style={{ gap: 22 }}>
      {state.kind === "idle" ? (
        <>
          <div className="row gap-md" style={{ alignItems: "center" }}>
            <div className="seal-stamp" aria-hidden="true">
              印
            </div>
            <div>
              <p className="meta-cap">ready to seal</p>
              <h2 className="section-title">
                {PARTICIPANT_TOTAL} 位齐聚 · {PARTICIPANT_TOTAL * WISHES_PER_PERSON} 条心愿齐备
              </h2>
            </div>
          </div>

          <p className="lede">
            按下朱印之后，浏览器将在本地：生成配对、拆分主密钥为 {PARTICIPANT_TOTAL} 把、把每份心愿封入对应天使的信。
            随后，{PARTICIPANT_TOTAL} 把钥匙会被写入对应参与者的 dashboard，由他们各自登录领取后销毁。
          </p>

          <div className="alert alert-error">
            <strong>一次性仪式。</strong>执行之后任何管理员都无法再回到此页。
          </div>

          <div className="row gap-md">
            <button type="button" className="button-danger" onClick={runSeal}>
              按下朱印 · 封缄这一季
            </button>
            <span className="meta-cap">不可撤销</span>
          </div>
        </>
      ) : null}

      {state.kind === "running" ? (
        <div className="alert alert-success">
          <strong>仪式进行中：</strong>
          {state.step}
        </div>
      ) : null}

      {state.kind === "error" ? (
        <>
          <div className="alert alert-error">
            <strong>未能完成：</strong>
            {state.message}
          </div>
          <button
            type="button"
            className="button-secondary"
            onClick={() => setState({ kind: "idle" })}
          >
            回到入口
          </button>
        </>
      ) : null}

      {state.kind === "delivered" ? (
        <>
          <div className="row gap-md" style={{ alignItems: "center" }}>
            <div className="seal-stamp" aria-hidden="true">
              缄
            </div>
            <div>
              <p className="meta-cap">sealed · {PARTICIPANT_TOTAL} keys delivered</p>
              <h2 className="section-title">钥匙已分发到各位 dashboard</h2>
            </div>
          </div>

          <p className="lede">
            {PARTICIPANT_TOTAL} 把钥匙已写入对应参与者的 dashboard。
            请通知大家登录 <span className="meta-cap" style={{ fontFamily: "var(--f-han)" }}>/dashboard</span>
            ，把自己的那把钥匙复制保存到任意安全的地方（笔记 / 截图 / 密码管理器），
            然后在页面上点 “我已收下” 销毁。
          </p>

          <div className="registry sheet-plain" style={{ padding: 0 }}>
            {state.rows.map((row, idx) => (
              <div className="registry-row" style={{ padding: "16px 18px" }} key={row.participantId}>
                <div>
                  <div className="meta-cap">
                    №{(idx + 1).toString().padStart(2, "0")} · awaiting pickup
                  </div>
                  <div className="registry-name">{row.participantName}</div>
                </div>
                <div className="meta-cap" style={{ fontStyle: "normal", fontFamily: "var(--f-han)" }}>
                  已写入 dashboard
                </div>
              </div>
            ))}
          </div>

          <p className="footer-note">
            服务器会在 7 天后自动清空尚未被领取的钥匙——若有人未及时登录，钥匙会消失，活动需要重新封缄。
          </p>

          <div>
            <button type="button" className="button" onClick={exitToDashboard}>
              完成 · 离开
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
