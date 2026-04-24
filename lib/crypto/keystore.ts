// IndexedDB-backed cache for the user's decrypted personal AES key
// (CryptoKey objects are structured-cloneable, so we store them as non-extractable).

const DB_NAME = "king-angel-keystore";
const DB_VERSION = 1;
const STORE = "personal_keys";
const STALE_AFTER_MS = 12 * 60 * 60 * 1000; // 12h

type StoredEntry = {
  key: CryptoKey;
  storedAt: number;
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

async function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
  });
}

export async function putPersonalKey(userId: string, key: CryptoKey): Promise<void> {
  if (!isBrowser()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ key, storedAt: Date.now() } satisfies StoredEntry, userId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getPersonalKey(userId: string): Promise<CryptoKey | null> {
  if (!isBrowser()) return null;
  const db = await openDb();
  const entry = await new Promise<StoredEntry | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(userId);
    request.onsuccess = () => resolve(request.result as StoredEntry | undefined);
    request.onerror = () => reject(request.error);
  });
  db.close();

  if (!entry) return null;

  if (Date.now() - entry.storedAt > STALE_AFTER_MS) {
    await clearPersonalKey(userId);
    return null;
  }

  return entry.key;
}

export async function clearPersonalKey(userId: string): Promise<void> {
  if (!isBrowser()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(userId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function clearAllKeys(): Promise<void> {
  if (!isBrowser()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
