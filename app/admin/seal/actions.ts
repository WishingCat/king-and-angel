"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfileOrThrow, requireUser } from "@/lib/auth";
import { PARTICIPANT_TOTAL } from "@/lib/config";

export type SealEnvelopePayload = {
  angel_user_id: string;
  ct: string;
  iv: string;
};

export type SealedPairingPayload = {
  ct: string;
  iv: string;
  manifest_sha256: string;
};

type PublishSealInput = {
  envelopes: SealEnvelopePayload[];
  pairing: SealedPairingPayload;
};

export type PublishSealResult = { ok: true } | { ok: false; error: string };

export async function publishSealAction(input: PublishSealInput): Promise<PublishSealResult> {
  const user = await requireUser();
  const profile = await getProfileOrThrow(user.id);

  if (!profile.can_admin) {
    return { ok: false, error: "你没有管理员权限。" };
  }

  if (!Array.isArray(input?.envelopes) || input.envelopes.length !== PARTICIPANT_TOTAL) {
    return { ok: false, error: `envelope 数量必须等于 ${PARTICIPANT_TOTAL}。` };
  }

  if (!input.pairing?.ct || !input.pairing.iv || !input.pairing.manifest_sha256) {
    return { ok: false, error: "sealed_pairing 缺少字段。" };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("publish_seal", {
    envelopes: input.envelopes,
    pairing: input.pairing,
  });

  if (error) {
    return { ok: false, error: `封印失败：${error.message}` };
  }

  return { ok: true };
}

export async function fetchSealInputsAction() {
  const user = await requireUser();
  const profile = await getProfileOrThrow(user.id);

  if (!profile.can_admin) {
    redirect("/dashboard?error=" + encodeURIComponent("你没有管理员权限。"));
  }

  const admin = createAdminClient();
  const [
    { data: profiles, error: profilesError },
    { data: wishes, error: wishesError },
    { data: sealState, error: sealError },
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("id, display_name")
      .order("created_at", { ascending: true }),
    admin
      .from("pre_seal_wishes")
      .select("user_id, wish_index, content"),
    admin
      .from("seal_state")
      .select("status")
      .eq("id", 1)
      .single(),
  ]);

  if (profilesError || wishesError || sealError) {
    throw new Error("加载封印数据失败。");
  }

  return {
    profiles: profiles ?? [],
    wishes: wishes ?? [],
    sealStatus: (sealState?.status ?? "open") as "open" | "published",
  };
}
