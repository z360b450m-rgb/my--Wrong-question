import type { NoteEntry } from '@/types'

const DB_NAME = 'CuotiDB'
const DB_VERSION = 2
const STORE = 'entries'
const SNAP_STORE = 'snapshots'

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

export const db = {
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

  // Snapshot store for crash protection
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
