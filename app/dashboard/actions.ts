"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSealState } from "@/lib/dashboard";
import { requireUser } from "@/lib/auth";

function nextUrl(path: string, key: string, value: string) {
  return `${path}?${key}=${encodeURIComponent(value)}`;
}

export async function saveWishesAction(formData: FormData) {
  const user = await requireUser();

  const raw = [
    String(formData.get("wish_0") ?? ""),
    String(formData.get("wish_1") ?? ""),
    String(formData.get("wish_2") ?? ""),
  ].map((value) => value.trim());

  if (raw.some((value) => value.length === 0)) {
    redirect(nextUrl("/dashboard", "error", "请填写全部 3 条心愿。"));
  }

  if (raw.some((value) => value.length > 200)) {
    redirect(nextUrl("/dashboard", "error", "单条心愿请控制在 200 字以内。"));
  }

  const sealState = await getSealState();
  if (sealState.status === "published") {
    redirect(nextUrl("/dashboard", "error", "配对已封印，心愿不能再修改。"));
  }

  const admin = createAdminClient();
  const rows = raw.map((content, index) => ({
    user_id: user.id,
    wish_index: index,
    content,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await admin
    .from("pre_seal_wishes")
    .upsert(rows, { onConflict: "user_id,wish_index" });

  if (error) {
    redirect(nextUrl("/dashboard", "error", `保存心愿失败：${error.message}`));
  }

  redirect(nextUrl("/dashboard", "success", "3 条心愿已保存。"));
}

export async function sendMessageAction(formData: FormData) {
  await requireUser();
  const content = String(formData.get("content") ?? "").trim();

  if (!content) {
    redirect(nextUrl("/dashboard", "error", "留言内容不能为空。"));
  }

  if (content.length > 500) {
    redirect(nextUrl("/dashboard", "error", "留言请控制在 500 字以内。"));
  }

  // Use the authenticated server client so RLS insert policy applies.
  // Do NOT write auth.uid() anywhere — anonymity relies on the absence of a sender column.
  const supabase = await createClient();
  const { error } = await supabase.from("public_messages").insert({ content });

  if (error) {
    redirect(nextUrl("/dashboard", "error", `留言发送失败：${error.message}`));
  }

  redirect(nextUrl("/dashboard", "success", "留言已发送。"));
}

export async function uploadTaskAction(formData: FormData) {
  await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!title || !description) {
    redirect(nextUrl("/dashboard", "error", "请填写任务标题和说明。"));
  }

  if (title.length > 80) {
    redirect(nextUrl("/dashboard", "error", "任务标题请控制在 80 字以内。"));
  }

  if (description.length > 500) {
    redirect(nextUrl("/dashboard", "error", "任务说明请控制在 500 字以内。"));
  }

  // Anonymous upload: RLS policy "create tasks" accepts any authenticated user;
  // we write via the user's SSR client so auth.uid() is present in the session only,
  // but the tasks table has no column that captures it.
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({ title, description });

  if (error) {
    redirect(nextUrl("/dashboard", "error", `上传任务失败：${error.message}`));
  }

  redirect(nextUrl("/dashboard", "success", "任务已匿名上传。"));
}

export async function claimTaskAction(formData: FormData) {
  await requireUser();
  const raw = String(formData.get("task_id") ?? "");
  const taskId = Number(raw);

  if (!Number.isFinite(taskId) || taskId <= 0) {
    redirect(nextUrl("/dashboard", "error", "任务编号无效。"));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("claim_task", { task_id: taskId });

  if (error) {
    const msg = error.message.includes("task_unavailable")
      ? "任务已被其他人接取。"
      : `接取失败：${error.message}`;
    redirect(nextUrl("/dashboard", "error", msg));
  }

  redirect(nextUrl("/dashboard", "success", "已接取任务。"));
}

export async function completeTaskAction(formData: FormData) {
  await requireUser();
  const raw = String(formData.get("task_id") ?? "");
  const taskId = Number(raw);

  if (!Number.isFinite(taskId) || taskId <= 0) {
    redirect(nextUrl("/dashboard", "error", "任务编号无效。"));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_task", { task_id: taskId });

  if (error) {
    const msg = error.message.includes("task_not_completable")
      ? "只能完成自己接取且未完成的任务。"
      : `标记完成失败：${error.message}`;
    redirect(nextUrl("/dashboard", "error", msg));
  }

  redirect(nextUrl("/dashboard", "success", "任务已完成。"));
}

export async function signOutFromDashboardAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth?success=已退出登录。");
}

// Burn-after-read: caller deletes their own pending_shares row.
// RLS scopes the DELETE to user_id = auth.uid(), so even if someone passed
// arbitrary args the policy would reject any other user's row.
export async function consumeOwnShareAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("pending_shares")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
