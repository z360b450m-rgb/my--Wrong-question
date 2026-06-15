interface DesktopSource {
  id: string;
  name: string;
  thumbnail: string;
  appIcon: string | null;
}

interface Window {
  electronAPI?: {
    platform: string;
    getAll: () => Promise<any[]>;
    get: (id: string) => Promise<any | null>;
    put: (entry: any) => Promise<void>;
    delete: (id: string) => Promise<void>;
    putSnapshot: (snapshot: any) => Promise<void>;
    getSnapshot: (entryId: string) => Promise<any | null>;
    getAllSnapshots: () => Promise<any[]>;
    deleteSnapshot: (entryId: string) => Promise<void>;
    deleteAllSnapshots: () => Promise<void>;
    getDataDir: () => Promise<string>;
    setDataDir: () => Promise<string>;
    exportAll: () => Promise<string>;
    importAll: (entries: any[]) => Promise<void>;
    getAllReviewLogs: () => Promise<any[]>;
    addReviewLog: (log: any) => Promise<void>;
    deleteReviewLogsByEntry: (entryId: string) => Promise<void>;
    getAllNotebooks: () => Promise<any[]>;
    putNotebook: (notebook: any) => Promise<void>;
    deleteNotebook: (id: string) => Promise<void>;
    getDesktopSources: () => Promise<DesktopSource[]>;
  };
}
