"use client";

import { useTransition } from "react";
import { signOutFromDashboardAction } from "@/app/dashboard/actions";
import { clearAllKeys } from "@/lib/crypto/keystore";

/**
 * Wraps the sign-out server action with a client-side step that clears
 * the IndexedDB keystore first. Without this, a personal_key cached on
 * a shared device would survive the cookie-only signOut and leak the
 * previous user's king + wishes to whoever logs in next.
 */
export function SignOutButton() {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        await clearAllKeys();
      } catch {
        // IndexedDB may be unavailable (private mode, etc.) — proceed anyway.
      }
      await signOutFromDashboardAction();
    });
  }

  return (
    <button
      type="button"
      className="button-secondary"
      onClick={handleClick}
      disabled={pending}
    >
      {pending ? "离席中……" : "离席"}
    </button>
  );
}
