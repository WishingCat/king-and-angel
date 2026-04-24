// Base64 / base64url helpers usable in both browser and Node 18+.
// Buffers/Uint8Array round-trip without padding noise.

const isBrowser = typeof window !== "undefined" && typeof window.btoa === "function";

export function bytesToBase64(bytes: Uint8Array): string {
  if (isBrowser) {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
  return Buffer.from(bytes).toString("base64");
}

export function base64ToBytes(value: string): Uint8Array {
  if (isBrowser) {
    const binary = window.atob(value);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  }
  return new Uint8Array(Buffer.from(value, "base64"));
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToBytes(value: string): Uint8Array {
  const padLen = (4 - (value.length % 4)) % 4;
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padLen);
  return base64ToBytes(padded);
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function utf8Encode(value: string): Uint8Array {
  return textEncoder.encode(value);
}

export function utf8Decode(bytes: Uint8Array): string {
  return textDecoder.decode(bytes);
}
