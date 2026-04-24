// Shamir Secret Sharing wrapper.
// `shamir-secret-sharing` operates on Uint8Array secrets and returns Uint8Array shares.
// We base64url-encode shares for human-friendly distribution and storage.

import { combine, split } from "shamir-secret-sharing";
import { base64UrlToBytes, bytesToBase64Url } from "@/lib/crypto/encoding";

export type Share = string; // base64url-encoded share bytes

export async function splitSecret(
  secret: Uint8Array,
  shares: number,
  threshold: number,
): Promise<Share[]> {
  if (threshold > shares || threshold < 2) {
    throw new Error(`Invalid Shamir parameters: shares=${shares}, threshold=${threshold}`);
  }
  const rawShares = await split(secret, shares, threshold);
  return rawShares.map((bytes) => bytesToBase64Url(bytes));
}

export async function combineShares(shares: Share[]): Promise<Uint8Array> {
  if (shares.length < 2) {
    throw new Error("Need at least 2 shares to attempt combine.");
  }
  const decoded = shares.map((value) => base64UrlToBytes(value.trim()));
  return combine(decoded);
}
