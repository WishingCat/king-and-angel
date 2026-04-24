// HKDF-SHA256 derived AES-GCM CryptoKey, used to turn a Shamir share
// into a per-user "personal" envelope decryption key.

const PERSONAL_INFO = new TextEncoder().encode("king-angel:personal-envelope:v1");
const EMPTY_SALT = new Uint8Array(32);

export async function deriveAesKeyFromShare(
  shareBytes: Uint8Array,
  options?: { extractable?: boolean },
): Promise<CryptoKey> {
  const ikm = await crypto.subtle.importKey(
    "raw",
    shareBytes as unknown as BufferSource,
    "HKDF",
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: EMPTY_SALT as unknown as BufferSource,
      info: PERSONAL_INFO as unknown as BufferSource,
    },
    ikm,
    256,
  );

  return crypto.subtle.importKey(
    "raw",
    new Uint8Array(bits) as unknown as BufferSource,
    { name: "AES-GCM" },
    options?.extractable ?? false,
    ["encrypt", "decrypt"],
  );
}
