import type { AudioAsset, CricketProject, StudioAsset } from '../types/studio';

const DB_NAME = 'cricket_creator_studio_assets_v1';
const STORE_NAME = 'asset_blobs';

export interface StoredBlobRecord {
  id: string;
  blob: Blob;
  mimeType: string;
  name: string;
  sizeBytes: number;
  updatedAt: string;
}

const memoryFallbackStore = new Map<string, StoredBlobRecord>();

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openAssetsDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB AssetBlobStore'));
  });
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) return null;
    const header = dataUrl.slice(0, commaIdx);
    const body = dataUrl.slice(commaIdx + 1);
    const mimeMatch = header.match(/data:([^;]+)/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const isBase64 = header.includes(';base64');
    if (isBase64) {
      const binary = atob(body);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new Blob([bytes], { type: mime });
    }
    return new Blob([decodeURIComponent(body)], { type: mime });
  } catch {
    return null;
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

export const AssetBlobStore = {
  async putAsset(
    id: string,
    blob: Blob,
    meta?: { name?: string; mimeType?: string }
  ): Promise<void> {
    const record: StoredBlobRecord = {
      id,
      blob,
      mimeType: meta?.mimeType || blob.type || 'application/octet-stream',
      name: meta?.name || id,
      sizeBytes: blob.size,
      updatedAt: new Date().toISOString(),
    };
    memoryFallbackStore.set(id, record);

    if (!hasIndexedDb()) return;
    try {
      const db = await openAssetsDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB put failed'));
      });
      db.close();
    } catch {
      // Memory fallback already saved
    }
  },

  async getAsset(id: string): Promise<Blob | null> {
    if (!id) return null;
    if (!hasIndexedDb()) {
      return memoryFallbackStore.get(id)?.blob ?? null;
    }
    try {
      const db = await openAssetsDb();
      const rec = await new Promise<StoredBlobRecord | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(id);
        req.onsuccess = () => resolve(req.result as StoredBlobRecord | undefined);
        req.onerror = () => reject(req.error);
      });
      db.close();
      if (rec?.blob) return rec.blob;
    } catch {
      // Fallback to memory store
    }
    return memoryFallbackStore.get(id)?.blob ?? null;
  },

  async deleteAsset(id: string): Promise<void> {
    memoryFallbackStore.delete(id);
    if (!hasIndexedDb()) return;
    try {
      const db = await openAssetsDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch {
      // Ignore
    }
  },

  async hasAsset(id: string): Promise<boolean> {
    if (!id) return false;
    if (memoryFallbackStore.has(id)) return true;
    const blob = await AssetBlobStore.getAsset(id);
    return blob !== null;
  },

  async listAssets(): Promise<Omit<StoredBlobRecord, 'blob'>[]> {
    if (!hasIndexedDb()) {
      return Array.from(memoryFallbackStore.values()).map(({ blob: _omit, ...meta }) => meta);
    }
    try {
      const db = await openAssetsDb();
      const all = await new Promise<StoredBlobRecord[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => resolve((req.result as StoredBlobRecord[]) ?? []);
        req.onerror = () => reject(req.error);
      });
      db.close();
      return all.map(({ blob: _omit, ...meta }) => meta);
    } catch {
      return Array.from(memoryFallbackStore.values()).map(({ blob: _omit, ...meta }) => meta);
    }
  },
};

export async function resolveAssetBlob(asset: {
  id: string;
  assetId?: string;
  dataUrl?: string;
}): Promise<Blob | null> {
  const key = asset.assetId || asset.id;
  const fromDb = await AssetBlobStore.getAsset(key);
  if (fromDb) return fromDb;
  if (asset.dataUrl) {
    const blob = dataUrlToBlob(asset.dataUrl);
    if (blob) {
      await AssetBlobStore.putAsset(key, blob);
      return blob;
    }
  }
  return null;
}

/**
 * Migrates Phase 2 inline Data URL blobs from StudioAsset & AudioAsset into IndexedDB
 * AssetBlobStore, linking each record by `assetId` and slimming localStorage payloads
 * while keeping small thumbnail dataUrls if below threshold or retaining references safely.
 */
export async function migrateProjectAssetsToIndexedDB(
  project: CricketProject
): Promise<{ project: CricketProject; migratedCount: number }> {
  let migratedCount = 0;

  const nextAssets: StudioAsset[] = [];
  for (const asset of project.assets ?? []) {
    const blobKey = asset.assetId || `blob-${asset.id}`;
    if (asset.dataUrl) {
      const existing = await AssetBlobStore.hasAsset(blobKey);
      if (!existing) {
        const blob = dataUrlToBlob(asset.dataUrl);
        if (blob) {
          await AssetBlobStore.putAsset(blobKey, blob, {
            name: asset.name,
            mimeType: asset.mimeType,
          });
          migratedCount++;
        }
      }
      nextAssets.push({
        ...asset,
        assetId: blobKey,
        // Retain small image dataUrls (< 64KB) for instant SVG/img preview; offload large blobs
        dataUrl: asset.dataUrl.length < 65_536 ? asset.dataUrl : undefined,
      });
    } else {
      nextAssets.push({ ...asset, assetId: blobKey });
    }
  }

  const nextAudioAssets: AudioAsset[] = [];
  for (const audio of project.audioAssets ?? []) {
    const blobKey = audio.assetId || `blob-${audio.id}`;
    if (audio.dataUrl) {
      const existing = await AssetBlobStore.hasAsset(blobKey);
      if (!existing) {
        const blob = dataUrlToBlob(audio.dataUrl);
        if (blob) {
          await AssetBlobStore.putAsset(blobKey, blob, {
            name: audio.name,
            mimeType: blob.type || 'audio/mpeg',
          });
          migratedCount++;
        }
      }
      nextAudioAssets.push({
        ...audio,
        assetId: blobKey,
        dataUrl: undefined,
      });
    } else {
      nextAudioAssets.push({ ...audio, assetId: blobKey });
    }
  }

  if (migratedCount === 0 && nextAssets.every((a, i) => a === project.assets[i])) {
    return { project, migratedCount: 0 };
  }

  return {
    migratedCount,
    project: {
      ...project,
      assets: nextAssets,
      audioAssets: nextAudioAssets,
    },
  };
}
