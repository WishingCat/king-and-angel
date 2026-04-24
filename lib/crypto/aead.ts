// AES-GCM helpers built on top of Web Crypto.

import { base64ToBytes, bytesToBase64, utf8Decode, utf8Encode } from "@/lib/crypto/encoding";

export type AeadCiphertext = {
  ct: string; // base64
  iv: string; // base64
};

export function randomIv(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(12));
}

export async function importRawAesKey(rawBytes: Uint8Array, extractable = false): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    rawBytes as unknown as BufferSource,
    { name: "AES-GCM" },
    extractable,
    ["encrypt", "decrypt"],
  );
}

export async function generateAesKey(extractable = true): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, extractable, [
    "encrypt",
    "decrypt",
  ]);
}

export async function aesGcmEncryptString(key: CryptoKey, plaintext: string): Promise<AeadCiphertext> {
  const iv = randomIv();
  const buffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    utf8Encode(plaintext) as unknown as BufferSource,
  );
  return {
    ct: bytesToBase64(new Uint8Array(buffer)),
    iv: bytesToBase64(iv),
  };
}

export async function aesGcmDecryptString(key: CryptoKey, payload: AeadCiphertext): Promise<string> {
  const buffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(payload.iv) as unknown as BufferSource },
    key,
    base64ToBytes(payload.ct) as unknown as BufferSource,
  );
  return utf8Decode(new Uint8Array(buffer));
}

export async function exportRawAesKey(key: CryptoKey): Promise<Uint8Array> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return new Uint8Array(raw);
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
