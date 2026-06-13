import type { NoteEntry } from '@/types'

const STORE = 'entries'
const SNAP_STORE = 'snapshots'

// ── Electron file-based storage (primary) ──────────────────────

function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI
}

const fileDb = {
  async getAll(): Promise<NoteEntry[]> {
    return window.electronAPI!.getAll()
  },

  async get(id: string): Promise<NoteEntry | undefined> {
    const entry = await window.electronAPI!.get(id)
    return entry ?? undefined
  },

  async put(entry: NoteEntry): Promise<void> {
    await window.electronAPI!.put(entry)
  },

  async delete(id: string): Promise<void> {
    await window.electronAPI!.delete(id)
  },

  async putSnapshot(entryId: string, data: NoteEntry): Promise<void> {
    await window.electronAPI!.putSnapshot({ entryId, data, savedAt: Date.now() })
  },

  async getSnapshot(entryId: string): Promise<{ entryId: string; data: NoteEntry; savedAt: number } | undefined> {
    const snap = await window.electronAPI!.getSnapshot(entryId)
    return snap ?? undefined
  },

  async getAllSnapshots(): Promise<{ entryId: string; data: NoteEntry; savedAt: number }[]> {
    return window.electronAPI!.getAllSnapshots()
  },

  async deleteSnapshot(entryId: string): Promise<void> {
    await window.electronAPI!.deleteSnapshot(entryId)
  },

  async deleteAllSnapshots(): Promise<void> {
    await window.electronAPI!.deleteAllSnapshots()
  },
}

// ── IndexedDB fallback (browser dev mode) ───────────────────────

const DB_NAME = 'CuotiDB'
const DB_VERSION = 2

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('updatedAt', 'updatedAt', { unique: false })
        store.createIndex('subject', 'subject', { unique: false })
      }
      if (!db.objectStoreNames.contains(SNAP_STORE)) {
        db.createObjectStore(SNAP_STORE, { keyPath: 'entryId' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
  storeName = STORE,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(storeName, mode)
        const store = t.objectStore(storeName)
        const req = fn(store)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

const idbDb = {
  getAll(): Promise<NoteEntry[]> {
    return tx('readonly', (s) => s.getAll())
  },

  get(id: string): Promise<NoteEntry | undefined> {
    return tx('readonly', (s) => s.get(id))
  },

  put(entry: NoteEntry): Promise<void> {
    return tx('readwrite', (s) => s.put(entry)).then(() => undefined)
  },

  delete(id: string): Promise<void> {
    return tx('readwrite', (s) => s.delete(id)).then(() => undefined)
  },

  putSnapshot(entryId: string, data: NoteEntry): Promise<void> {
    return tx('readwrite', (s) => s.put({ entryId, data, savedAt: Date.now() }), SNAP_STORE).then(() => undefined)
  },

  getSnapshot(entryId: string): Promise<{ entryId: string; data: NoteEntry; savedAt: number } | undefined> {
    return tx('readonly', (s) => s.get(entryId), SNAP_STORE)
  },

  getAllSnapshots(): Promise<{ entryId: string; data: NoteEntry; savedAt: number }[]> {
    return tx('readonly', (s) => s.getAll(), SNAP_STORE)
  },

  deleteSnapshot(entryId: string): Promise<void> {
    return tx('readwrite', (s) => s.delete(entryId), SNAP_STORE).then(() => undefined)
  },

  deleteAllSnapshots(): Promise<void> {
    return tx('readwrite', (s) => s.clear(), SNAP_STORE).then(() => undefined)
  },
}

// ── Unified export ─────────────────────────────────────────────

export const db = isElectron() ? fileDb : idbDb

// ── Migration: IndexedDB → file storage ─────────────────────────

export async function migrateFromIndexedDB(): Promise<number> {
  if (!isElectron()) return 0
  const existing = await fileDb.getAll()
  if (existing.length > 0) return 0 // Already has file data, skip

  try {
    const idbEntries = await idbDb.getAll()
    if (idbEntries.length === 0) return 0
    for (const entry of idbEntries) {
      await fileDb.put(entry)
    }
    return idbEntries.length
  } catch {
    return 0
  }
}
