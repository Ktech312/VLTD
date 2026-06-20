const DB_NAME = "vltd-media-v1";
const DB_VERSION = 1;
const STORE_NAME = "images";

type StoredImageRecord = {
  key: string;
  blob: Blob;
  createdAt: number;
  contentType: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB."));
  });
}

function readAsImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not decode image."));
    };

    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to convert image."));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });
}

export function generateVaultImageKey(itemId: string, index = 0) {
  return `item_${String(itemId)}_${index}_${Date.now()}`;
}

export async function prepareImageBlob(
  file: File,
  options?: {
    maxDimension?: number;
    quality?: number;
    mimeType?: string;
  }
): Promise<Blob> {
  const maxDimension = options?.maxDimension ?? 1600;
  const quality = options?.quality ?? 0.82;
  const mimeType = options?.mimeType ?? "image/jpeg";

  const image = await readAsImageElement(file);

  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  if (!width || !height) {
    throw new Error("Image has invalid dimensions.");
  }

  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas is not available.");
  }

  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

  return canvasToBlob(canvas, mimeType, quality);
}

export async function saveImageBlobToIndexedDb(blob: Blob, key: string) {
  const db = await openDb();

  return new Promise<string>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const record: StoredImageRecord = {
      key,
      blob,
      createdAt: Date.now(),
      contentType: blob.type || "application/octet-stream",
    };

    const request = store.put(record);

    request.onsuccess = () => resolve(key);
    request.onerror = () => reject(request.error ?? new Error("Failed to store image."));
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error ?? new Error("Failed to store image."));
  });
}

export async function saveImageFileToIndexedDb(file: File, key: string) {
  const blob = await prepareImageBlob(file);
  return saveImageBlobToIndexedDb(blob, key);
}

export async function getImageBlobFromIndexedDb(key: string): Promise<Blob | undefined> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => {
      const result = request.result as StoredImageRecord | undefined;
      resolve(result?.blob);
    };
    request.onerror = () => reject(request.error ?? new Error("Failed to load image."));
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error ?? new Error("Failed to load image."));
  });
}

export async function getImageObjectUrlFromIndexedDb(key: string): Promise<string | undefined> {
  const blob = await getImageBlobFromIndexedDb(key);
  if (!blob) return undefined;
  return URL.createObjectURL(blob);
}

export async function deleteImageFromIndexedDb(key: string) {
  const db = await openDb();

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Failed to delete image."));
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error ?? new Error("Failed to delete image."));
  });
}

export function revokeImageObjectUrl(url?: string) {
  if (!url) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    // ignore
  }
}
