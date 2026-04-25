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
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error || !data.user) {
    redirect(
      toUrlMessage(
        "/auth",
        "error",
        error?.message ?? "注册失败，请检查邮箱是否已被使用。",
      ),
    );
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    display_name: invite.display_name,
    can_admin: invite.can_admin,
  });

  if (profileError) {
    redirect(toUrlMessage("/auth", "error", "注册成功，但创建个人资料失败，请联系管理员。"));
  }

  await admin
    .from("invites")
    .update({
      claimed_by: data.user.id,
      claimed_at: new Date().toISOString(),
      email,
    })
    .eq("code", inviteCode);

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