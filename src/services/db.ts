// ===================================================================
// @AI-CRITICAL-RULES: 核心数据库访问层
//
// 本文件实现了系统的持久化数据访问逻辑，是唯一允许直接操作存储的模块。
// 采用双后端架构：Electron 文件存储（主） + IndexedDB（浏览器后备）。
//
// ■ 绝对禁止的操作：
//   1. 修改 STORE / SNAP_STORE / REVIEW_LOG_STORE / NOTEBOOK_STORE 的
//      名称或结构 —— 这等同于数据库迁移，会导致已有数据不可访问。
//   2. 修改 DB_VERSION —— 除非你明确知道如何编写 onupgradeneeded 迁移
//      逻辑，且同步更新 Electron 端文件格式。
//   3. 在 IndexedDB 的 onupgradeneeded 中删除或修改已有 Object Store
//      的 schema —— 只能通过新建 Store 或追加索引来扩展。
//   4. 绕过 db 统一导出直接调用 fileDb 或 idbDb —— 所有数据操作必须
//      通过 db 对象进行。
//
// ■ 允许的扩展方式：
//   1. 新增 Object Store：在 DB_VERSION 递增后，于 onupgradeneeded 中
//      添加 createObjectStore；同步在 Electron main.cjs 文件存储中
//      添加对应的 JSON 键和 CRUD 操作。
//   2. 为已有 Store 追加新索引（不影响现有数据）。
//   3. 追加新的数据访问函数（如 getByIndex），不可改变现有函数签名。
//
// ■ 修改前必读文件：
//   - src/types/index.ts（数据接口定义 —— 两者必须保持同步）
//   - electron/main.cjs（Electron 端文件存储实现 & IPC 处理程序）
//   - electron/preload.cjs（暴露给渲染进程的 API 桥接）
//
// VIOLATION OF THESE RULES WILL CAUSE DATA CORRUPTION.
// ===================================================================

import type { NoteEntry, ReviewLog, Notebook } from '@/types';

const STORE = 'entries';
const SNAP_STORE = 'snapshots';
const REVIEW_LOG_STORE = 'reviewLogs';
const NOTEBOOK_STORE = 'notebooks';

// ── Electron file-based storage (primary) ──────────────────────

function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI;
}

const fileDb = {
  async getAll(): Promise<NoteEntry[]> {
    return window.electronAPI!.getAll();
  },

  async get(id: string): Promise<NoteEntry | undefined> {
    const entry = await window.electronAPI!.get(id);
    return entry ?? undefined;
  },

  async put(entry: NoteEntry): Promise<void> {
    await window.electronAPI!.put(entry);
  },

  async delete(id: string): Promise<void> {
    await window.electronAPI!.delete(id);
  },

  async putSnapshot(entryId: string, data: NoteEntry): Promise<void> {
    await window.electronAPI!.putSnapshot({ entryId, data, savedAt: Date.now() });
  },

  async getSnapshot(
    entryId: string,
  ): Promise<{ entryId: string; data: NoteEntry; savedAt: number } | undefined> {
    const snap = await window.electronAPI!.getSnapshot(entryId);
    return snap ?? undefined;
  },

  async getAllSnapshots(): Promise<{ entryId: string; data: NoteEntry; savedAt: number }[]> {
    return window.electronAPI!.getAllSnapshots();
  },

  async deleteSnapshot(entryId: string): Promise<void> {
    await window.electronAPI!.deleteSnapshot(entryId);
  },

  async deleteAllSnapshots(): Promise<void> {
    await window.electronAPI!.deleteAllSnapshots();
  },

  async getAllReviewLogs(): Promise<ReviewLog[]> {
    return window.electronAPI!.getAllReviewLogs();
  },

  async addReviewLog(log: ReviewLog): Promise<void> {
    await window.electronAPI!.addReviewLog(log);
  },

  async deleteReviewLogsByEntry(entryId: string): Promise<void> {
    await window.electronAPI!.deleteReviewLogsByEntry(entryId);
  },

  async getAllNotebooks(): Promise<Notebook[]> {
    return window.electronAPI!.getAllNotebooks();
  },

  async putNotebook(notebook: Notebook): Promise<void> {
    await window.electronAPI!.putNotebook(notebook);
  },

  async deleteNotebook(id: string): Promise<void> {
    await window.electronAPI!.deleteNotebook(id);
  },
};

// ── IndexedDB fallback (browser dev mode) ───────────────────────

const DB_NAME = 'CuotiDB';
const DB_VERSION = 5;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('subject', 'subject', { unique: false });
      }
      if (!db.objectStoreNames.contains(SNAP_STORE)) {
        db.createObjectStore(SNAP_STORE, { keyPath: 'entryId' });
      }
      if (!db.objectStoreNames.contains(REVIEW_LOG_STORE)) {
        const rlStore = db.createObjectStore(REVIEW_LOG_STORE, { keyPath: 'id' });
        rlStore.createIndex('entryId', 'entryId', { unique: false });
      }
      if (!db.objectStoreNames.contains(NOTEBOOK_STORE)) {
        db.createObjectStore(NOTEBOOK_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
  storeName = STORE,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const store = t.objectStore(storeName);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

const idbDb = {
  getAll(): Promise<NoteEntry[]> {
    return tx('readonly', (s) => s.getAll());
  },

  get(id: string): Promise<NoteEntry | undefined> {
    return tx('readonly', (s) => s.get(id));
  },

  put(entry: NoteEntry): Promise<void> {
    return tx('readwrite', (s) => s.put(entry)).then(() => undefined);
  },

  delete(id: string): Promise<void> {
    return tx('readwrite', (s) => s.delete(id)).then(() => undefined);
  },

  putSnapshot(entryId: string, data: NoteEntry): Promise<void> {
    return tx('readwrite', (s) => s.put({ entryId, data, savedAt: Date.now() }), SNAP_STORE).then(
      () => undefined,
    );
  },

  getSnapshot(
    entryId: string,
  ): Promise<{ entryId: string; data: NoteEntry; savedAt: number } | undefined> {
    return tx('readonly', (s) => s.get(entryId), SNAP_STORE);
  },

  getAllSnapshots(): Promise<{ entryId: string; data: NoteEntry; savedAt: number }[]> {
    return tx('readonly', (s) => s.getAll(), SNAP_STORE);
  },

  deleteSnapshot(entryId: string): Promise<void> {
    return tx('readwrite', (s) => s.delete(entryId), SNAP_STORE).then(() => undefined);
  },

  deleteAllSnapshots(): Promise<void> {
    return tx('readwrite', (s) => s.clear(), SNAP_STORE).then(() => undefined);
  },

  getAllReviewLogs(): Promise<ReviewLog[]> {
    return tx('readonly', (s) => s.getAll(), REVIEW_LOG_STORE);
  },

  addReviewLog(log: ReviewLog): Promise<void> {
    return tx('readwrite', (s) => s.put(log), REVIEW_LOG_STORE).then(() => undefined);
  },

  deleteReviewLogsByEntry(entryId: string): Promise<void> {
    return tx(
      'readwrite',
      (s) => {
        const idx = s.index('entryId');
        return idx.getAllKeys(entryId);
      },
      REVIEW_LOG_STORE,
    ).then((keys) => {
      const deletePromises = (keys as string[]).map((key) =>
        tx('readwrite', (s2) => s2.delete(key), REVIEW_LOG_STORE),
      );
      return Promise.all(deletePromises).then(() => undefined);
    });
  },

  getAllNotebooks(): Promise<Notebook[]> {
    return tx('readonly', (s) => s.getAll(), NOTEBOOK_STORE);
  },

  putNotebook(notebook: Notebook): Promise<void> {
    return tx('readwrite', (s) => s.put(notebook), NOTEBOOK_STORE).then(() => undefined);
  },

  deleteNotebook(id: string): Promise<void> {
    return tx('readwrite', (s) => s.delete(id), NOTEBOOK_STORE).then(() => undefined);
  },
};

// ── Unified export ─────────────────────────────────────────────

export const db = isElectron() ? fileDb : idbDb;

// ── Migration: IndexedDB → file storage ─────────────────────────

export async function migrateFromIndexedDB(): Promise<number> {
  if (!isElectron()) return 0;

  // If migration was already done, skip entirely — no IDB open needed
  try {
    const alreadyMigrated = await window.electronAPI!.isIndexedDBMigrated();
    if (alreadyMigrated) return 0;
  } catch {
    /* proceed */
  }

  const existing = await fileDb.getAll();
  if (existing.length > 0) {
    // Already has file data — mark migrated so future starts skip IDB
    try {
      await window.electronAPI!.markIndexedDBMigrated();
    } catch {
      /* ignore */
    }
    return 0;
  }

  try {
    const idbEntries = await idbDb.getAll();
    if (idbEntries.length === 0) {
      // No IDB data either — mark migrated so future starts skip IDB
      try {
        await window.electronAPI!.markIndexedDBMigrated();
      } catch {
        /* ignore */
      }
      return 0;
    }
    for (const entry of idbEntries) {
      await fileDb.put(entry);
    }
    try {
      await window.electronAPI!.markIndexedDBMigrated();
    } catch {
      /* ignore */
    }
    return idbEntries.length;
  } catch {
    return 0;
  }
}
