import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/types";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  return user;
}

export async function getProfileOrThrow(userId: string): Promise<Profile> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, display_name, can_admin, created_at")
    .eq("id", userId)
    .single();

  if (error || !data) {
    throw new Error("Profile not found. Please complete sign up first.");
  }

  return data as Profile;
}