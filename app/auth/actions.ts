"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function toUrlMessage(path: string, key: string, value: string) {
  return `${path}?${key}=${encodeURIComponent(value)}`;
}

export async function signUpAction(formData: FormData) {
  const inviteCode = String(formData.get("inviteCode") ?? "").trim().toUpperCase();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "").trim();

  if (!inviteCode || !email || password.length < 6) {
    redirect(toUrlMessage("/auth", "error", "请完整填写邀请码、邮箱和至少 6 位密码。"));
  }

  const admin = createAdminClient();
  const { data: invite, error: inviteError } = await admin
    .from("invites")
    .select("code, display_name, can_admin, claimed_by")
    .eq("code", inviteCode)
    .single();

  if (inviteError || !invite) {
    redirect(
      toUrlMessage(
        "/auth",
        "error",
        inviteError
          ? "邀请码查询失败，请稍后重试。"
          : "这个邀请码不存在。",
      ),
    );
  }


  if (invite.claimed_by) {
    redirect(toUrlMessage("/auth", "error", "这个邀请码已经被使用了。"));
  }

  const supabase = await createClient();
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError || !signUpData.user) {
    redirect(
      toUrlMessage(
        "/auth",
        "error",
        signUpError?.message ?? "注册失败，请检查邮箱是否已被使用。",
      ),
    );
  }

  const userId = signUpData.user.id;

  // Two-step partial-state recovery: if either profiles insert or invite
  // update fails, roll back the auth.users row so the user can retry
  // (or someone else can claim the invite code) without DBA intervention.
  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    display_name: invite.display_name,
    can_admin: invite.can_admin,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    redirect(toUrlMessage("/auth", "error", "注册失败，请稍后重试或联系管理员。"));
  }

  const { error: inviteUpdateError } = await admin
    .from("invites")
    .update({
      claimed_by: userId,
      claimed_at: new Date().toISOString(),
      email,
    })
    .eq("code", inviteCode);

  if (inviteUpdateError) {
    // profiles row already exists, but invites isn't marked claimed —
    // a different user could later use the same code. Roll back both
    // to keep state consistent.
    try {
      await admin.from("profiles").delete().eq("id", userId);
    } catch {
      // best-effort
    }
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    redirect(toUrlMessage("/auth", "error", "注册失败，请稍后重试或联系管理员。"));
  }

  redirect(toUrlMessage("/auth", "success", "注册成功，现在可以直接登录。"));
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "").trim();

  if (!email || !password) {
    redirect(toUrlMessage("/auth", "error", "请输入邮箱和密码。"));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(toUrlMessage("/auth", "error", "登录失败，请检查邮箱和密码。"));
  }

  redirect("/dashboard");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth?success=已退出登录。");
}