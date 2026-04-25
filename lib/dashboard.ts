import { createAdminClient } from "@/lib/supabase/admin";
import { PARTICIPANT_TOTAL } from "@/lib/config";
import type {
  AngelEnvelope,
  PreSealWish,
  PublicMessage,
  SealState,
  Task,
  TaskWithClaimer,
} from "@/lib/types";

export { PARTICIPANT_TOTAL };

export async function getSealState(): Promise<SealState> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("seal_state")
    .select("id, status, sealed_at")
    .eq("id", 1)
    .single();

  if (error || !data) {
    throw new Error("Seal state row is missing.");
  }

  return data as SealState;
}

export async function getParticipantDashboard(userId: string) {
  const admin = createAdminClient();

  const [
    sealState,
    { count: participantCount },
    { count: wishFilledCount },
    { data: ownWishRows },
    { data: envelopeRow },
    { data: messages },
    { data: taskRows },
  ] = await Promise.all([
    getSealState(),
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin.from("pre_seal_wishes").select("user_id", { count: "exact", head: true }),
    admin
      .from("pre_seal_wishes")
      .select("user_id, wish_index, content, updated_at")
      .eq("user_id", userId)
      .order("wish_index", { ascending: true }),
    admin
      .from("angel_envelopes")
      .select("angel_user_id, ct, iv, created_at")
      .eq("angel_user_id", userId)
      .maybeSingle(),
    admin
      .from("public_messages")
      .select("id, content, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("tasks")
      .select("id, title, description, created_at, claimed_by, claimed_at, completed_at")
      .order("created_at", { ascending: false }),
  ]);

  const claimerIds = Array.from(
    new Set(
      ((taskRows ?? []) as Task[])
        .map((task) => task.claimed_by)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  let claimerMap = new Map<string, string>();
  if (claimerIds.length > 0) {
    const { data: claimers } = await admin
      .from("profiles")
      .select("id, display_name")
      .in("id", claimerIds);

    claimerMap = new Map(
      ((claimers ?? []) as Array<{ id: string; display_name: string }>).map((profile) => [
        profile.id,
        profile.display_name,
      ]),
    );
  }

  const tasks: TaskWithClaimer[] = ((taskRows ?? []) as Task[]).map((task) => ({
    ...task,
    claimer_display_name: task.claimed_by ? claimerMap.get(task.claimed_by) ?? null : null,
  }));

  return {
    sealState,
    stats: {
      participantCount: participantCount ?? 0,
      wishFilledCount: wishFilledCount ?? 0,
      participantTotal: PARTICIPANT_TOTAL,
    },
    ownWishes: (ownWishRows ?? []) as PreSealWish[],
    angelEnvelope: (envelopeRow as AngelEnvelope | null) ?? null,
    messages: (messages ?? []) as PublicMessage[],
    tasks,
  };
}

export async function getAdminSummary() {
  const admin = createAdminClient();
  const sealState = await getSealState();

  const [
    { count: participantCount },
    { count: distinctWishUserCount },
    { count: envelopeCount },
    { count: messageCount },
    { count: taskCount },
  ] = await Promise.all([
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin
      .from("pre_seal_wishes")
      .select("user_id", { count: "exact", head: true }),
    admin.from("angel_envelopes").select("*", { count: "exact", head: true }),
    admin.from("public_messages").select("*", { count: "exact", head: true }),
    admin.from("tasks").select("*", { count: "exact", head: true }),
  ]);

  return {
    sealState,
    participantCount: participantCount ?? 0,
    wishRowCount: distinctWishUserCount ?? 0,
    envelopeCount: envelopeCount ?? 0,
    messageCount: messageCount ?? 0,
    taskCount: taskCount ?? 0,
    participantTotal: PARTICIPANT_TOTAL,
  };
}
