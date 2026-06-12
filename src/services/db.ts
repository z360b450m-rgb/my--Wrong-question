import type { NoteEntry } from '@/types'

const DB_NAME = 'CuotiDB'
const DB_VERSION = 1
const STORE = 'entries'

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
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const store = t.objectStore(STORE)
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
}
